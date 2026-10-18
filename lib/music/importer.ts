"use client";

import { parseBlob, selectCover } from "music-metadata";
import { apiFetch } from "@/lib/api-client";
import { analyzeSamples, type AudioFeatures } from "@/lib/music/analysis";
import { buildFeatureVector } from "@/lib/music/similarity";
import { parseReleaseDate } from "@/lib/music/metadata-sources";
import { PROTECTED_EXTENSIONS, audioExtension, audioMimeType, extensionOf } from "@/lib/music/formats";
import type { Track } from "@/lib/music/types";

// Browser-side library import. For each audio file: hash it (so re-running
// skips songs already in the library), read its tags and album art, analyse
// the audio for similarity, upload it straight to storage with a presigned
// URL, then record it. Nothing large ever goes through the app server.

export type ImportOutcome = "added" | "exists" | "failed" | "unsupported";

export type ImportEvent =
  | { type: "start"; file: File }
  | { type: "done"; file: File; outcome: ImportOutcome; track?: Track; error?: string };

export type SortedSelection = {
  audio: File[]; // still to import
  alreadyImported: number; // matched to the library by name + size, skipped without reading
  protectedFiles: File[];
  ignored: number;
  totalBytes: number;
};

/** Cheap identity for a file already in the library: name + exact byte size. */
export function fileFingerprint(name: string, size: number): string {
  return `${name.toLowerCase()}|${size}`;
}

/**
 * Splits a folder selection into audio still to import, songs already in the
 * library, DRM-protected files, and everything else. `known` holds
 * fingerprints of imported tracks, so re-running after an interruption skips
 * them instantly instead of re-reading and re-hashing gigabytes of audio.
 */
export function sortSelection(files: File[], known: Set<string> = new Set()): SortedSelection {
  const audio: File[] = [];
  const protectedFiles: File[] = [];
  let ignored = 0;
  let alreadyImported = 0;
  for (const f of files) {
    if (f.name.startsWith("._")) ignored += 1; // macOS resource forks copied onto Windows drives
    else if (audioExtension(f.name)) {
      if (known.has(fileFingerprint(f.name, f.size))) alreadyImported += 1;
      else audio.push(f);
    } else if (PROTECTED_EXTENSIONS.has(extensionOf(f.name))) protectedFiles.push(f);
    else ignored += 1;
  }
  audio.sort((a, b) => pathOf(a).localeCompare(pathOf(b)));
  return { audio, alreadyImported, protectedFiles, ignored, totalBytes: audio.reduce((s, f) => s + f.size, 0) };
}

export function pathOf(f: File): string {
  return (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
}

async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  const view = data instanceof Uint8Array ? data : new Uint8Array(data);
  const digest = await crypto.subtle.digest("SHA-256", view as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const ANALYSIS_RATE = 22050;
/** Larger files (long lossless tracks) skip analysis: decoding them can use hundreds of MB of RAM. */
export const ANALYSIS_MAX_BYTES = 80 * 1024 * 1024;

// Only one decode at a time across all workers — decoding is the memory-heavy step.
let analysisQueue: Promise<unknown> = Promise.resolve();

function analyzeOneAtATime(buffer: ArrayBuffer): Promise<AudioFeatures | null> {
  const run = analysisQueue.then(() => analyze(buffer));
  analysisQueue = run.catch(() => null);
  return run;
}

/**
 * Decodes with Web Audio (resampled to 22.05 kHz) and analyses a mono mixdown.
 * Takes ownership of `buffer` (decodeAudioData detaches it) to avoid a copy.
 */
async function analyze(buffer: ArrayBuffer): Promise<AudioFeatures | null> {
  try {
    const ctx = new OfflineAudioContext(1, 1, ANALYSIS_RATE);
    const decoded = await ctx.decodeAudioData(buffer);
    const mono = new Float32Array(decoded.length);
    for (let c = 0; c < decoded.numberOfChannels; c++) {
      const ch = decoded.getChannelData(c);
      for (let i = 0; i < mono.length; i++) mono[i] += ch[i] / decoded.numberOfChannels;
    }
    return analyzeSamples(mono, decoded.sampleRate);
  } catch {
    // Some formats (e.g. Apple Lossless in Chrome) can't be decoded in the browser.
    // The song still imports and plays; similarity falls back to its tags.
    return null;
  }
}

async function putWithRetry(url: string, body: Blob | Uint8Array, contentType: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { method: "PUT", body: body as BodyInit, headers: { "Content-Type": contentType } });
      if (res.ok) return;
      lastError = new Error(`Storage rejected the upload (${res.status})`);
    } catch (err) {
      // A CORS misconfiguration on the bucket surfaces as a network TypeError.
      lastError = err instanceof TypeError ? new Error("Couldn't reach storage — check the bucket's CORS settings") : err;
    }
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
  }
  throw lastError;
}

function joinTag(values: string[] | undefined): string | null {
  const joined = [...new Set((values ?? []).map((v) => v.trim()).filter(Boolean))].join(", ");
  return joined ? joined.slice(0, 500) : null;
}

/** Unsynchronised lyrics embedded in the file (ID3 USLT / MP4 ©lyr). */
function firstLyrics(tags: unknown): string | null {
  if (!Array.isArray(tags)) return null;
  for (const t of tags) {
    const text = typeof t === "string" ? t : (t as { text?: string })?.text;
    if (text?.trim()) return text.trim().slice(0, 20000);
  }
  return null;
}

function firstNumber(n: number | null | undefined): number | null {
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

type UploadDecision =
  | { status: "exists" }
  | { status: "unsupported" }
  | { status: "upload"; uploadUrl: string; contentType: string };

export class LibraryImporter {
  private paused = false;
  private stopped = false;
  private resumeWaiters: (() => void)[] = [];
  private artworkCache = new Map<string, Promise<string | null>>();

  constructor(
    private onEvent: (e: ImportEvent) => void,
    // Two at a time keeps uploads flowing without overloading the PC.
    private concurrency = 2,
  ) {}

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
    this.resumeWaiters.splice(0).forEach((r) => r());
  }

  stop() {
    this.stopped = true;
    this.resume();
  }

  private async gate() {
    while (this.paused && !this.stopped) await new Promise<void>((r) => this.resumeWaiters.push(r));
  }

  async run(files: File[]) {
    let cursor = 0;
    const worker = async () => {
      while (!this.stopped) {
        await this.gate();
        if (this.stopped) return;
        const file = files[cursor++];
        if (!file) return;
        this.onEvent({ type: "start", file });
        try {
          const result = await this.importOne(file);
          this.onEvent({ type: "done", file, ...result });
        } catch (err) {
          this.onEvent({ type: "done", file, outcome: "failed", error: err instanceof Error ? err.message : String(err) });
        }
      }
    };
    await Promise.all(Array.from({ length: this.concurrency }, worker));
  }

  private async importOne(file: File): Promise<{ outcome: ImportOutcome; track?: Track }> {
    const buffer = await file.arrayBuffer();
    const contentHash = await sha256Hex(buffer);
    const mimeType = audioMimeType(file.name, file.type);

    const { results } = await apiFetch<{ results: ({ contentHash: string } & UploadDecision)[] }>("/api/music/uploads", {
      method: "POST",
      body: JSON.stringify({ files: [{ contentHash, fileName: file.name, size: file.size, mimeType }] }),
    });
    const decision = results[0];
    if (decision.status === "exists") return { outcome: "exists" };
    if (decision.status === "unsupported") return { outcome: "unsupported" };

    // The hash is taken, so the buffer can be handed to the decoder (no copy).
    const [tags, features] = await Promise.all([
      parseBlob(file, { duration: true }).catch(() => null),
      file.size <= ANALYSIS_MAX_BYTES ? analyzeOneAtATime(buffer) : Promise.resolve(null),
    ]);
    const common = tags?.common;
    const artworkKey = await this.uploadArtwork(selectCover(common?.picture));

    await putWithRetry(decision.uploadUrl, file, decision.contentType);

    const fallbackTitle = file.name.replace(/\.[^.]+$/, "").replace(/^\d+[\s.-]+/, "");
    const { track } = await apiFetch<{ track: Track | null }>("/api/music/tracks", {
      method: "POST",
      body: JSON.stringify({
        contentHash,
        fileName: file.name,
        fileSize: file.size,
        mimeType,
        title: (common?.title || fallbackTitle).slice(0, 500),
        artist: common?.artist?.slice(0, 500) ?? null,
        albumArtist: common?.albumartist?.slice(0, 500) ?? null,
        album: common?.album?.slice(0, 500) ?? null,
        genre: common?.genre?.[0]?.slice(0, 200) ?? null,
        year: common?.year && common.year >= 1000 && common.year <= 3000 ? common.year : null,
        trackNumber: firstNumber(common?.track?.no),
        discNumber: firstNumber(common?.disk?.no),
        durationSeconds: tags?.format.duration ? Math.round(tags.format.duration * 100) / 100 : null,
        bitrate: firstNumber(tags?.format.bitrate),
        artworkKey,
        features,
        featureVector: features ? buildFeatureVector(features) : null,
        // Credits, label and lyrics the file already carries (online lookups fill gaps later).
        releaseDate: parseReleaseDate(common?.date ?? common?.originaldate ?? null),
        composer: joinTag(common?.composer ?? common?.writer),
        lyricist: joinTag(common?.lyricist),
        producer: joinTag(common?.producer),
        label: joinTag(common?.label),
        copyright: common?.copyright?.slice(0, 500) ?? null,
        lyrics: firstLyrics(common?.lyrics),
      }),
    });
    return { outcome: track ? "added" : "exists", track: track ?? undefined };
  }

  /** Uploads each distinct cover image once per run (albums share art). */
  private uploadArtwork(cover: { format: string; data: Uint8Array } | null): Promise<string | null> {
    if (!cover?.data?.length) return Promise.resolve(null);
    const ext = cover.format.includes("png") ? "png" : cover.format.includes("webp") ? "webp" : "jpg";
    const job = (async () => {
      const hash = await sha256Hex(cover.data);
      const cached = this.artworkCache.get(hash);
      if (cached) return cached;
      const promise = (async () => {
        try {
          const res = await apiFetch<{ key: string; exists: boolean; uploadUrl?: string; contentType?: string }>(
            "/api/music/artwork",
            { method: "POST", body: JSON.stringify({ hash, ext }) },
          );
          if (!res.exists && res.uploadUrl) await putWithRetry(res.uploadUrl, cover.data, res.contentType!);
          return res.key;
        } catch {
          return null; // Missing art never blocks a song.
        }
      })();
      this.artworkCache.set(hash, promise);
      return promise;
    })();
    return job;
  }
}
