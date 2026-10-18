"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, FolderOpen, Pause, Play, Square, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLibrary } from "./library-context";
import {
  LibraryImporter,
  fileFingerprint,
  pathOf,
  sortSelection,
  type ImportEvent,
  type SortedSelection,
} from "@/lib/music/importer";
import { DuplicateIndex } from "@/lib/music/duplicates";
import { formatBytes, type Track } from "@/lib/music/types";

type Stats = { done: number; added: number; exists: number; duplicate: number; failed: number; unsupported: number; bytes: number };
const EMPTY: Stats = { done: 0, added: 0, exists: 0, duplicate: 0, failed: 0, unsupported: 0, bytes: 0 };


function eta(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  const m = Math.round(seconds / 60);
  return m >= 60 ? `~${Math.floor(m / 60)}h ${m % 60}m left` : `~${Math.max(1, m)} min left`;
}

export function ImportPanel() {
  const library = useLibrary();
  const folderInput = useRef<HTMLInputElement | null>(null);
  const filesInput = useRef<HTMLInputElement | null>(null);
  const importer = useRef<LibraryImporter | null>(null);
  const pending = useRef<Track[]>([]);
  const [selection, setSelection] = useState<SortedSelection | null>(null);
  const [state, setState] = useState<"idle" | "running" | "paused" | "finished">("idle");
  const [stats, setStats] = useState<Stats>(EMPTY);
  const [current, setCurrent] = useState<string[]>([]);
  const [failures, setFailures] = useState<{ path: string; error: string }[]>([]);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [skipped, setSkipped] = useState<{ path: string; duplicateOf: string }[]>([]);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);

  // React doesn't type the non-standard folder-picker attribute.
  useEffect(() => {
    folderInput.current?.setAttribute("webkitdirectory", "");
  }, []);

  // Keep the screen awake and warn before closing the tab mid-import.
  useEffect(() => {
    if (state !== "running") return;
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => {});
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    const tick = setInterval(() => setNow(Date.now()), 2000);
    return () => {
      lock?.release().catch(() => {});
      window.removeEventListener("beforeunload", warn);
      clearInterval(tick);
    };
  }, [state]);

  function choose(list: FileList | null) {
    if (!list?.length) return;
    const known = new Set((library.tracks ?? []).map((t) => fileFingerprint(t.fileName, t.fileSize)));
    setSelection(sortSelection([...list], known));
    setStats(EMPTY);
    setFailures([]);
    setSkipped([]);
    setState("idle");
  }

  function flushAdded() {
    if (pending.current.length) {
      library.addTracks(pending.current);
      pending.current = [];
    }
  }

  async function start(files: File[], checkDuplicates = skipDuplicates) {
    setState("running");
    setStartedAt(Date.now());
    setNow(Date.now());
    const runner = new LibraryImporter((e: ImportEvent) => {
      const path = pathOf(e.file);
      if (e.type === "start") {
        setCurrent((c) => [...c.slice(-2), path]);
        return;
      }
      setCurrent((c) => c.filter((p) => p !== path));
      setStats((s) => ({
        ...s,
        done: s.done + 1,
        bytes: s.bytes + e.file.size,
        [e.outcome]: s[e.outcome] + 1,
      }));
      if (e.outcome === "failed") setFailures((f) => [...f, { path, error: e.error ?? "Unknown error" }]);
      if (e.outcome === "duplicate") setSkipped((d) => [...d, { path, duplicateOf: e.duplicateOf ?? "" }]);
      if (e.track) {
        pending.current.push(e.track);
        if (pending.current.length >= 20) flushAdded();
      }
    }, checkDuplicates ? new DuplicateIndex(library.tracks ?? []) : null);
    importer.current = runner;
    await runner.run(files);
    flushAdded();
    setCurrent([]);
    setState("finished");
  }

  if (library.storageConfigured === false) return <StorageSetup />;

  const total = selection?.audio.length ?? 0;
  const pct = total ? stats.done / total : 0;
  const elapsed = (now - startedAt) / 1000;
  const remaining = stats.bytes > 0 && selection ? ((selection.totalBytes - stats.bytes) / stats.bytes) * elapsed : NaN;
  const busy = state === "running" || state === "paused";

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-dashed border-neutral-300 p-5 text-center dark:border-neutral-700">
        <Upload className="mx-auto mb-2 h-8 w-8 text-neutral-400" />
        <p className="text-sm font-medium">Add music from your computer</p>
        <p className="mx-auto mt-1 max-w-md text-xs text-neutral-500">
          Pick your iTunes / Apple Music folder (usually <code>Music\iTunes\iTunes Media\Music</code>). Songs upload
          straight to your storage; songs already in your library are skipped, so you can stop and re-run any time.
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <Button onClick={() => folderInput.current?.click()} disabled={busy}>
            <FolderOpen className="h-4 w-4" />
            Choose music folder
          </Button>
          <Button variant="secondary" onClick={() => filesInput.current?.click()} disabled={busy}>
            Choose files
          </Button>
        </div>
        <input ref={folderInput} type="file" multiple className="hidden" onChange={(e) => choose(e.target.files)} />
        <input
          ref={filesInput}
          type="file"
          multiple
          accept="audio/*,.m4a,.flac,.aiff,.aif,.opus"
          className="hidden"
          onChange={(e) => choose(e.target.files)}
        />
      </div>

      {selection && (
        <div className="space-y-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <div className="text-sm">
            <p>
              {total > 0 ? (
                <>
                  <span className="font-semibold">{total.toLocaleString()}</span> {selection.alreadyImported ? "new " : ""}songs (
                  {formatBytes(selection.totalBytes)}) ready to import
                </>
              ) : (
                <span className="font-semibold">Everything in this folder is already in your library.</span>
              )}
            </p>
            {selection.protectedFiles.length > 0 && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {selection.protectedFiles.length === 1
                  ? "1 copy-protected Apple Music file (.m4p) will be skipped"
                  : `${selection.protectedFiles.length} copy-protected Apple Music files (.m4p) will be skipped`}{" "}
                — they only play in Apple&apos;s apps.
              </p>
            )}
            {selection.alreadyImported > 0 && (
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                {selection.alreadyImported.toLocaleString()} songs already in your library — skipped without re-reading.
              </p>
            )}
            {selection.ignored > 0 && <p className="text-xs text-neutral-500">{selection.ignored} non-audio files ignored.</p>}
          </div>

          {state === "idle" && total > 0 && (
            <div className="space-y-2">
              <label className="flex items-start gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={skipDuplicates}
                  onChange={(e) => setSkipDuplicates(e.target.checked)}
                />
                <span>
                  Skip likely duplicates automatically — same song and artist with the same length, even if the file
                  name, album or tags differ. You&apos;ll see a list afterwards.
                </span>
              </label>
              <Button onClick={() => start(selection.audio)}>
                <Play className="h-4 w-4" />
                Start import
              </Button>
            </div>
          )}

          {state !== "idle" && (
            <div className="space-y-2">
              <div className="h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${Math.round(pct * 100)}%` }} />
              </div>
              <div className="flex flex-wrap justify-between gap-2 text-xs text-neutral-500">
                <span>
                  {stats.done.toLocaleString()} / {total.toLocaleString()} · {formatBytes(stats.bytes)} of {formatBytes(selection.totalBytes)}
                </span>
                <span>{state === "running" ? eta(remaining) : state === "paused" ? "Paused" : ""}</span>
              </div>
              <p className="text-xs">
                <span className="text-emerald-600">{stats.added} added</span> ·{" "}
                <span>{stats.exists} already in library</span>
                {stats.duplicate > 0 && <> · {stats.duplicate} duplicates skipped</>}
                {stats.unsupported > 0 && <> · {stats.unsupported} unsupported</>}
                {stats.failed > 0 && <span className="text-red-600"> · {stats.failed} failed</span>}
              </p>
              {current.length > 0 && (
                <p className="truncate text-xs text-neutral-400">Working on: {current.join(", ")}</p>
              )}
              {busy && (
                <div className="flex gap-2">
                  {state === "running" ? (
                    <Button variant="secondary" onClick={() => { importer.current?.pause(); setState("paused"); }}>
                      <Pause className="h-4 w-4" />
                      Pause
                    </Button>
                  ) : (
                    <Button variant="secondary" onClick={() => { importer.current?.resume(); setState("running"); }}>
                      <Play className="h-4 w-4" />
                      Resume
                    </Button>
                  )}
                  <Button variant="ghost" onClick={() => importer.current?.stop()}>
                    <Square className="h-4 w-4" />
                    Stop
                  </Button>
                </div>
              )}
              {busy && (
                <p className="text-xs text-neutral-500">
                  Keep this tab open. You can switch to other apps on your computer; the screen stays awake while importing.
                </p>
              )}
              {state === "finished" && (
                <p className="flex items-center gap-1.5 text-sm text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                  {stats.done < total ? "Import stopped." : "Import finished."} {stats.added} songs added.
                </p>
              )}
              {skipped.length > 0 && !busy && (
                <div className="space-y-2">
                  <details className="text-xs">
                    <summary className="cursor-pointer text-neutral-600 dark:text-neutral-400">
                      {skipped.length.toLocaleString()} likely duplicates skipped — see which
                    </summary>
                    <ul className="mt-1 max-h-48 space-y-0.5 overflow-y-auto text-neutral-500">
                      {skipped.slice(0, 500).map((d) => (
                        <li key={d.path}>
                          <span className="font-mono">{d.path}</span> → same as {d.duplicateOf}
                        </li>
                      ))}
                    </ul>
                  </details>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const paths = new Set(skipped.map((d) => d.path));
                      setSkipped([]);
                      setFailures([]);
                      setStats(EMPTY);
                      start(selection.audio.filter((f) => paths.has(pathOf(f))), false);
                    }}
                  >
                    Import these anyway
                  </Button>
                </div>
              )}
              {failures.length > 0 && !busy && (
                <div className="space-y-2">
                  <details className="text-xs">
                    <summary className="cursor-pointer text-red-600">{failures.length} files failed — see why</summary>
                    <ul className="mt-1 max-h-48 space-y-0.5 overflow-y-auto text-neutral-500">
                      {failures.slice(0, 200).map((f) => (
                        <li key={f.path}>
                          <span className="font-mono">{f.path}</span>: {f.error}
                        </li>
                      ))}
                    </ul>
                  </details>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const failedPaths = new Set(failures.map((f) => f.path));
                      setFailures([]);
                      setStats(EMPTY);
                      start(selection.audio.filter((f) => failedPaths.has(pathOf(f))));
                    }}
                  >
                    Retry failed files
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StorageSetup() {
  return (
    <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950/40">
      <p className="font-semibold">Connect storage to import music</p>
      <p className="text-xs text-neutral-600 dark:text-neutral-300">
        Your songs are stored in a Cloudflare R2 bucket (free for 10 GB, no streaming fees). One-time setup, about 5 minutes:
      </p>
      <ol className="list-decimal space-y-1 pl-5 text-xs text-neutral-700 dark:text-neutral-300">
        <li>In Cloudflare → R2, create a bucket (e.g. <code>music</code>).</li>
        <li>R2 → Manage API tokens → create a token with Object Read &amp; Write on that bucket.</li>
        <li>Bucket → Settings → CORS policy: allow <code>PUT</code> and <code>GET</code> from your app&apos;s URL.</li>
        <li>
          In Vercel → Settings → Environment Variables, add <code>MUSIC_STORAGE_ENDPOINT</code>, <code>MUSIC_STORAGE_BUCKET</code>,{" "}
          <code>MUSIC_STORAGE_ACCESS_KEY_ID</code>, <code>MUSIC_STORAGE_SECRET_ACCESS_KEY</code>, then redeploy.
        </li>
      </ol>
    </div>
  );
}
