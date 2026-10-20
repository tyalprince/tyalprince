import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { musicTracks } from "@/lib/db/schema";
import { trackColumns } from "@/lib/music/queries";
import { artworkObjectKey, audioObjectKey, putObject } from "@/lib/music/storage";
import { fromJamendo, genreLabel, JAMENDO_GENRES, type ExploreView, type JamendoTrack } from "@/lib/music/jamendo";
import type { Track } from "@/lib/music/types";

const API = "https://api.jamendo.com/v3.0";
const PAGE = 30;
const MAX_DOWNLOAD_BYTES = 60 * 1024 * 1024;

export function jamendoClientId(): string | null {
  return process.env.JAMENDO_CLIENT_ID?.trim() || null;
}

type JamendoResponse = { headers?: { status?: string; error_message?: string }; results?: JamendoTrack[] };

async function callJamendo(params: Record<string, string>, revalidate: number | false): Promise<JamendoTrack[]> {
  const clientId = jamendoClientId();
  if (!clientId) throw new Error("Jamendo isn't connected");
  const query = new URLSearchParams({
    client_id: clientId,
    format: "json",
    audioformat: "mp32",
    imagesize: "300",
    include: "musicinfo",
    ...params,
  });
  const res = await fetch(`${API}/tracks/?${query}`, {
    signal: AbortSignal.timeout(10_000),
    ...(revalidate === false ? { cache: "no-store" as const } : { next: { revalidate } }),
  });
  if (!res.ok) throw new Error(`Jamendo answered ${res.status}`);
  const data = (await res.json()) as JamendoResponse;
  if (data.headers?.status && data.headers.status !== "success") throw new Error(data.headers.error_message || "Jamendo error");
  return data.results ?? [];
}

/** One page of Explore results; lists other than search are cached for 10 minutes. */
export async function exploreTracks(view: ExploreView, opts: { q?: string; genre?: string; offset?: number }) {
  const base = { limit: String(PAGE), offset: String(opts.offset ?? 0) };
  let params: Record<string, string>;
  switch (view) {
    case "trending":
      params = { ...base, order: "popularity_week", groupby: "artist_id" };
      break;
    case "new":
      params = { ...base, order: "releasedate_desc", boost: "popularity_month" };
      break;
    case "genre": {
      const genre = JAMENDO_GENRES.find((g) => g === opts.genre) ?? "pop";
      params = { ...base, tags: genre, order: "popularity_month", groupby: "artist_id" };
      break;
    }
    case "search":
      params = { ...base, search: (opts.q ?? "").slice(0, 100), order: "relevance" };
      break;
  }
  const results = await callJamendo(params, view === "search" ? false : 600);
  return { tracks: results.map(fromJamendo).filter((t) => t.remote?.audioUrl), hasMore: results.length === PAGE };
}

const isJamendoHost = (url: string) => {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && /(^|\.)jamendo\.com$/.test(u.hostname);
  } catch {
    return false;
  }
};

async function download(url: string, maxBytes: number): Promise<{ bytes: Uint8Array; type: string } | null> {
  if (!isJamendoHost(url)) return null;
  const res = await fetch(url, { signal: AbortSignal.timeout(45_000), cache: "no-store" });
  if (!res.ok) return null;
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > maxBytes) return null;
  const bytes = new Uint8Array(await res.arrayBuffer());
  return bytes.length && bytes.length <= maxBytes ? { bytes, type: res.headers.get("content-type") ?? "" } : null;
}

const sha256 = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

/**
 * Copies a Jamendo song into the user's library (audio + cover into their
 * storage, details into the catalog). Only songs the artist allows to be
 * downloaded. Returns the library track, or the existing one if already saved.
 */
export async function saveJamendoTrack(userId: string, jamendoId: string): Promise<Track> {
  const [raw] = await callJamendo({ id: jamendoId }, false);
  if (!raw) throw new Error("That song isn't on Jamendo anymore.");
  if (!raw.audiodownload_allowed || !raw.audiodownload) throw new Error("The artist doesn't allow downloads of this song.");

  const audio = await download(raw.audiodownload, MAX_DOWNLOAD_BYTES);
  if (!audio) throw new Error("Couldn't download the song from Jamendo.");
  const contentHash = sha256(audio.bytes);
  const objectKey = audioObjectKey(userId, contentHash, "mp3");
  await putObject(objectKey, audio.bytes, "audio/mpeg");

  let artworkKey: string | null = null;
  const imageUrl = raw.album_image || raw.image;
  if (imageUrl) {
    const image = await download(imageUrl.replace(/width=\d+/, "width=600"), 5 * 1024 * 1024).catch(() => null);
    if (image?.type.startsWith("image/")) {
      const ext = image.type.includes("png") ? "png" : "jpg";
      artworkKey = artworkObjectKey(userId, sha256(image.bytes), ext);
      await putObject(artworkKey, image.bytes, ext === "png" ? "image/png" : "image/jpeg");
    }
  }

  const t = fromJamendo(raw);
  const genre = raw.musicinfo?.tags?.genres?.[0];
  const [inserted] = await db
    .insert(musicTracks)
    .values({
      userId,
      objectKey,
      contentHash,
      fileName: `${raw.artist_name ?? "Jamendo"} - ${raw.name}.mp3`.slice(0, 500),
      fileSize: audio.bytes.length,
      mimeType: "audio/mpeg",
      title: raw.name.slice(0, 500),
      artist: raw.artist_name?.slice(0, 500) ?? null,
      album: raw.album_name?.slice(0, 500) || null,
      genre: genre ? genreLabel(genre) : null,
      year: t.year,
      releaseDate: t.releaseDate,
      durationSeconds: raw.duration ? String(raw.duration) : null,
      artworkKey,
      copyright: t.remote?.license ? `${t.remote.license} (Jamendo)` : null,
      external: {
        source: "jamendo",
        jamendoId: raw.id,
        ...(t.remote?.pageUrl ? { jamendoUrl: t.remote.pageUrl } : {}),
        ...(t.remote?.licenseUrl ? { licenseUrl: t.remote.licenseUrl } : {}),
      },
    })
    .onConflictDoNothing({ target: [musicTracks.userId, musicTracks.contentHash] })
    .returning(trackColumns);
  if (inserted) return inserted as unknown as Track;

  const [existing] = await db
    .select(trackColumns)
    .from(musicTracks)
    .where(and(eq(musicTracks.userId, userId), eq(musicTracks.contentHash, contentHash)))
    .limit(1);
  return existing as unknown as Track;
}
