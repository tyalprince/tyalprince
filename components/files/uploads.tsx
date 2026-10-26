"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Loader2, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";
import { formatBytes } from "@/lib/files/names";
import { UploadCancelled, isJunk, makeThumbnail, putBlob, withRetry, type Picked } from "@/lib/files/upload-client";
import type { UploadTicket } from "@/lib/files/uploads";

type Status = "waiting" | "uploading" | "done" | "skipped" | "failed" | "cancelled";
type Job = { key: number; name: string; size: number; status: Status; loaded: number; error?: string };

/** Files sent to storage at once, and parts at once within one big file. */
const FILE_SLOTS = 3;
const PART_SLOTS = 4;
const REGISTER_BATCH = 100;

/**
 * Upload queue for Files: registers files with the API in batches (which
 * creates their folders), then sends the bytes straight to storage a few at
 * a time. Big files go in parts; every request retries on its own, and a
 * failed or interrupted file can be retried — it resumes from the parts
 * already stored.
 */
export function useUploads(onFinished: () => void) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const nextKey = useRef(1);
  const sources = useRef(new Map<number, { picked: Picked; parentId: string | null }>());
  const loaded = useRef(new Map<number, number>());
  const controllers = useRef(new Map<number, AbortController>());
  const cancelled = useRef(new Set<number>());
  const slots = useRef({ active: 0, waiting: [] as (() => void)[] });
  const finished = useRef(onFinished);
  useEffect(() => {
    finished.current = onFinished;
  }, [onFinished]);

  const patch = useCallback((key: number, change: Partial<Job>) => {
    setJobs((list) => list.map((j) => (j.key === key ? { ...j, ...change } : j)));
  }, []);

  const acquire = useCallback(async () => {
    const s = slots.current;
    if (s.active < FILE_SLOTS) {
      s.active += 1;
      return;
    }
    await new Promise<void>((resolve) => s.waiting.push(resolve));
  }, []);
  const release = useCallback(() => {
    const s = slots.current;
    const next = s.waiting.shift();
    if (next) next();
    else s.active -= 1;
  }, []);

  const send = useCallback(
    async (key: number, file: File, ticket: UploadTicket & { status: "upload" }) => {
      const controller = new AbortController();
      controllers.current.set(key, controller);
      if (cancelled.current.has(key)) controller.abort();
      const { signal } = controller;
      try {
        await acquire();
        try {
          if (signal.aborted) throw new UploadCancelled();
          patch(key, { status: "uploading" });
          if (ticket.url) {
            const url = ticket.url;
            await withRetry(
              () => putBlob(url, file, { contentType: file.type || "application/octet-stream", signal, onProgress: (n) => loaded.current.set(key, n) }),
              signal,
            );
          } else if (ticket.multipart) {
            const { partSize, count, done } = ticket.multipart;
            const partBytes = (n: number) => Math.min(file.size, n * partSize) - (n - 1) * partSize;
            const inFlight = new Map<number, number>();
            let finishedBytes = done.reduce((sum, n) => sum + partBytes(n), 0);
            const report = () => loaded.current.set(key, finishedBytes + [...inFlight.values()].reduce((a, b) => a + b, 0));
            report();
            const todo = Array.from({ length: count }, (_, i) => i + 1).filter((n) => !done.includes(n));
            for (let i = 0; i < todo.length; i += 50) {
              const chunk = todo.slice(i, i + 50);
              const { urls } = await withRetry(
                () => apiFetch<{ urls: Record<number, string> }>(`/api/files/${ticket.id}/parts`, { method: "POST", body: JSON.stringify({ partNumbers: chunk }) }),
                signal,
              );
              const queue = [...chunk];
              const worker = async () => {
                for (let n = queue.shift(); n !== undefined; n = queue.shift()) {
                  const part = n;
                  const blob = file.slice((part - 1) * partSize, Math.min(file.size, part * partSize));
                  await withRetry(
                    () =>
                      putBlob(urls[part], blob, {
                        signal,
                        onProgress: (b) => {
                          inFlight.set(part, b);
                          report();
                        },
                      }),
                    signal,
                  );
                  inFlight.delete(part);
                  finishedBytes += blob.size;
                  report();
                }
              };
              await Promise.all(Array.from({ length: PART_SLOTS }, worker));
            }
          }
          let thumbnail = false;
          if (ticket.thumbnailUrl) {
            const blob = await makeThumbnail(file);
            if (blob) thumbnail = await putBlob(ticket.thumbnailUrl, blob, { contentType: "image/jpeg", signal }).then(() => true, () => false);
          }
          await withRetry(
            () => apiFetch(`/api/files/${ticket.id}/complete`, { method: "POST", body: JSON.stringify({ thumbnail }) }),
            signal,
            3,
          );
          loaded.current.set(key, file.size);
          patch(key, { status: "done", loaded: file.size });
          sources.current.delete(key);
        } finally {
          release();
        }
      } catch (err) {
        if (err instanceof UploadCancelled || signal.aborted) {
          patch(key, { status: "cancelled" });
          // Drop the unfinished file (and any stored parts).
          await apiFetch(`/api/files/${ticket.id}`, { method: "DELETE" }).catch(() => {});
        } else {
          patch(key, { status: "failed", error: err instanceof Error ? err.message : "Upload failed" });
        }
      } finally {
        controllers.current.delete(key);
      }
    },
    [acquire, release, patch],
  );

  /** Registers and sends files; `keys` reuses existing rows (for retries). */
  const run = useCallback(
    async (entries: { key: number; picked: Picked }[], parentId: string | null) => {
      const sends: Promise<void>[] = [];
      for (let i = 0; i < entries.length; i += REGISTER_BATCH) {
        const batch = entries.slice(i, i + REGISTER_BATCH).filter((e) => !cancelled.current.has(e.key));
        if (!batch.length) continue;
        try {
          const { tickets } = await withRetry(
            () =>
              apiFetch<{ tickets: UploadTicket[] }>("/api/files/uploads", {
                method: "POST",
                body: JSON.stringify({
                  parentId,
                  files: batch.map(({ picked }) => ({
                    name: picked.file.name,
                    size: picked.file.size,
                    contentType: picked.file.type || undefined,
                    relativePath: picked.relativePath,
                  })),
                }),
              }),
            undefined,
            3,
          );
          tickets.forEach((ticket, n) => {
            const { key, picked } = batch[n];
            if (ticket.status === "skipped") {
              patch(key, { status: "skipped", loaded: picked.file.size });
              sources.current.delete(key);
            } else sends.push(send(key, picked.file, ticket));
          });
        } catch (err) {
          const error = err instanceof Error ? err.message : "Couldn't start the upload";
          for (const { key } of batch) patch(key, { status: "failed", error });
        }
      }
      await Promise.all(sends);
      finished.current();
    },
    [patch, send],
  );

  const upload = useCallback(
    (picked: Picked[], parentId: string | null) => {
      const files = picked.filter((p) => !isJunk(p.file.name));
      if (!files.length) return;
      const entries = files.map((p) => ({ key: nextKey.current++, picked: p }));
      for (const e of entries) sources.current.set(e.key, { picked: e.picked, parentId });
      setJobs((list) => [
        ...list.filter((j) => j.status === "waiting" || j.status === "uploading" || j.status === "failed"),
        ...entries.map((e) => ({ key: e.key, name: e.picked.relativePath || e.picked.file.name, size: e.picked.file.size, status: "waiting" as const, loaded: 0 })),
      ]);
      void run(entries, parentId);
    },
    [run],
  );

  const retryFailed = useCallback(() => {
    const failed = jobs.filter((j) => j.status === "failed" && sources.current.has(j.key));
    const byParent = new Map<string, { key: number; picked: Picked }[]>();
    for (const j of failed) {
      const src = sources.current.get(j.key)!;
      const group = src.parentId ?? "";
      byParent.set(group, [...(byParent.get(group) ?? []), { key: j.key, picked: src.picked }]);
      patch(j.key, { status: "waiting", error: undefined });
    }
    for (const [parent, entries] of byParent) void run(entries, parent || null);
  }, [jobs, patch, run]);

  const cancelAll = useCallback(() => {
    for (const j of jobs) if (j.status === "waiting" || j.status === "uploading") cancelled.current.add(j.key);
    for (const c of controllers.current.values()) c.abort();
    setJobs((list) => list.map((j) => (j.status === "waiting" ? { ...j, status: "cancelled" } : j)));
  }, [jobs]);

  const clear = useCallback(() => {
    setJobs((list) => list.filter((j) => j.status === "waiting" || j.status === "uploading"));
  }, []);

  const active = jobs.some((j) => j.status === "waiting" || j.status === "uploading");

  // Progress lives in a ref (XHR fires it constantly); fold it into state a few times a second.
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      setJobs((list) => {
        let changed = false;
        const next = list.map((j) => {
          const n = loaded.current.get(j.key);
          if (j.status !== "uploading" || n === undefined || n === j.loaded) return j;
          changed = true;
          return { ...j, loaded: n };
        });
        return changed ? next : list;
      });
    }, 400);
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => {
      clearInterval(timer);
      window.removeEventListener("beforeunload", warn);
    };
  }, [active]);

  return { jobs, active, upload, retryFailed, cancelAll, clear };
}

export function UploadPanel({ uploads }: { uploads: ReturnType<typeof useUploads> }) {
  const { jobs, active } = uploads;
  const [open, setOpen] = useState(true);
  const totals = useMemo(() => {
    const counted = jobs.filter((j) => j.status !== "cancelled" && j.status !== "skipped");
    return {
      bytes: counted.reduce((s, j) => s + j.size, 0),
      loaded: counted.reduce((s, j) => s + (j.status === "done" ? j.size : j.loaded), 0),
      done: jobs.filter((j) => j.status === "done" || j.status === "skipped").length,
      skipped: jobs.filter((j) => j.status === "skipped").length,
      failed: jobs.filter((j) => j.status === "failed").length,
    };
  }, [jobs]);
  if (!jobs.length) return null;
  const pct = totals.bytes ? Math.min(100, (totals.loaded / totals.bytes) * 100) : 100;
  const title = active
    ? `Uploading ${totals.done.toLocaleString()} of ${jobs.length.toLocaleString()}`
    : totals.failed
      ? `${totals.failed.toLocaleString()} upload${totals.failed === 1 ? "" : "s"} failed`
      : "Uploads complete";
  // Busiest first: in progress, then failed, waiting, finished.
  const order: Record<Status, number> = { uploading: 0, failed: 1, waiting: 2, done: 3, skipped: 4, cancelled: 5 };
  const shown = [...jobs].sort((a, b) => order[a.status] - order[b.status]).slice(0, 200);

  return (
    <div className="fixed bottom-36 right-3 z-40 w-[calc(100%-1.5rem)] max-w-sm overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-900 md:bottom-24">
      <div className="flex items-center gap-2 px-3 py-2">
        {active ? (
          <Loader2 className="h-4 w-4 animate-spin text-sky-500" />
        ) : totals.failed ? (
          <AlertCircle className="h-4 w-4 text-red-500" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{title}</p>
          <p className="text-xs text-neutral-500">
            {formatBytes(totals.loaded)} of {formatBytes(totals.bytes)}
            {totals.skipped ? ` · ${totals.skipped.toLocaleString()} already there` : ""}
          </p>
        </div>
        {totals.failed > 0 && !active && (
          <button onClick={uploads.retryFailed} className="rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800" aria-label="Retry failed uploads">
            <RotateCcw className="h-4 w-4" />
          </button>
        )}
        <button onClick={() => setOpen((o) => !o)} className="rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800" aria-label={open ? "Collapse" : "Expand"}>
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
        <button
          onClick={active ? uploads.cancelAll : uploads.clear}
          className="rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          aria-label={active ? "Cancel all uploads" : "Close"}
          title={active ? "Cancel all" : "Close"}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="h-1 bg-neutral-100 dark:bg-neutral-800">
        <div className="h-full bg-sky-500 transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      {open && (
        <ul className="max-h-64 divide-y divide-neutral-100 overflow-y-auto text-xs dark:divide-neutral-800">
          {shown.map((j) => (
            <li key={j.key} className="flex items-center gap-2 px-3 py-1.5">
              <span className="min-w-0 flex-1 truncate" title={j.name}>
                {j.name}
              </span>
              <span
                className={cn(
                  "shrink-0",
                  j.status === "failed" ? "text-red-600" : j.status === "done" ? "text-emerald-600" : "text-neutral-500",
                )}
                title={j.error}
              >
                {j.status === "uploading"
                  ? `${j.size ? Math.floor((j.loaded / j.size) * 100) : 0}%`
                  : j.status === "skipped"
                    ? "Already there"
                    : j.status === "failed"
                      ? "Failed"
                      : j.status === "done"
                        ? formatBytes(j.size)
                        : j.status === "cancelled"
                          ? "Cancelled"
                          : "Waiting"}
              </span>
            </li>
          ))}
          {jobs.length > shown.length && <li className="px-3 py-1.5 text-neutral-400">…and {(jobs.length - shown.length).toLocaleString()} more</li>}
        </ul>
      )}
    </div>
  );
}
