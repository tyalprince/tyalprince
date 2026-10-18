"use client";

import { useMemo, useState } from "react";
import { Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useLibrary } from "./library-context";
import { findDuplicateGroups } from "@/lib/music/duplicates";
import { extensionOf } from "@/lib/music/formats";
import { displayArtist, formatTime, type Track } from "@/lib/music/types";

/**
 * Copies of the same song already in the library (same title, artist and
 * length). The best copy is pre-selected — tap another to keep that instead —
 * and one button removes every extra copy. Playlists, likes and play counts
 * move to the copy that's kept.
 */
export function DuplicatesPanel() {
  const library = useLibrary();
  const groups = useMemo(() => findDuplicateGroups(library.tracks ?? []), [library.tracks]);
  const [chosen, setChosen] = useState<Record<string, string>>({}); // group id → track to keep
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const plan = groups.map((g) => {
    const all = [g.keep, ...g.extras];
    const id = all.map((t) => t.id).sort().join(",");
    const keepId = all.some((t) => t.id === chosen[id]) ? chosen[id] : g.keep.id;
    return { id, all, keepId, removeIds: all.filter((t) => t.id !== keepId).map((t) => t.id) };
  });
  const extraCount = plan.reduce((s, p) => s + p.removeIds.length, 0);

  async function merge(items: typeof plan) {
    const count = items.reduce((s, p) => s + p.removeIds.length, 0);
    if (!confirm(`Remove ${count} extra ${count === 1 ? "copy" : "copies"}? Playlists, likes and plays move to the copy you keep.`)) return;
    setBusy(true);
    setResult(null);
    try {
      const removed = await library.mergeDuplicates(items.map(({ keepId, removeIds }) => ({ keepId, removeIds })));
      setResult(`Removed ${removed} extra ${removed === 1 ? "copy" : "copies"}.`);
    } catch {
      setResult("Something went wrong — try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!groups.length && !result) return null;

  return (
    <div className="mt-6 space-y-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex items-start gap-3">
        <Copy className="mt-0.5 h-5 w-5 shrink-0 text-neutral-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Duplicates</p>
          <p className="text-xs text-neutral-500">
            {groups.length
              ? `${groups.length} songs have more than one copy. The best copy (highest quality, with artwork, most played) is picked — tap another to keep that one instead.`
              : "No duplicates left."}
          </p>
        </div>
      </div>
      {result && <p className="text-xs text-emerald-600">{result}</p>}
      {groups.length > 0 && (
        <>
          <Button variant="danger" disabled={busy} onClick={() => merge(plan)}>
            {busy ? "Removing…" : `Remove all ${extraCount} extra ${extraCount === 1 ? "copy" : "copies"}`}
          </Button>
          <ul className="max-h-[28rem] space-y-3 overflow-y-auto">
            {plan.map((p) => (
              <li key={p.id} className="rounded-md bg-neutral-50 p-2 dark:bg-neutral-900">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-medium">
                    {p.all[0].title} <span className="font-normal text-neutral-500">· {displayArtist(p.all[0])}</span>
                  </p>
                  <button
                    disabled={busy}
                    onClick={() => merge([p])}
                    className="shrink-0 text-xs text-red-600 hover:underline disabled:opacity-50"
                  >
                    Remove {p.removeIds.length}
                  </button>
                </div>
                <div className="mt-1 space-y-1">
                  {p.all.map((t) => (
                    <CopyRow
                      key={t.id}
                      track={t}
                      keep={t.id === p.keepId}
                      onKeep={() => setChosen((c) => ({ ...c, [p.id]: t.id }))}
                    />
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function CopyRow({ track, keep, onKeep }: { track: Track; keep: boolean; onKeep: () => void }) {
  const details = [
    track.album,
    extensionOf(track.fileName).toUpperCase() || null,
    track.bitrate ? `${Math.round(track.bitrate / 1000)} kbps` : null,
    formatTime(track.durationSeconds),
    track.playCount ? `${track.playCount} plays` : null,
    track.liked ? "♥" : null,
  ].filter(Boolean);
  return (
    <button
      onClick={onKeep}
      className={cn(
        "flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs",
        keep ? "bg-white ring-1 ring-emerald-500 dark:bg-neutral-800" : "text-neutral-500 hover:bg-white dark:hover:bg-neutral-800",
      )}
    >
      <span
        className={cn(
          "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
          keep ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" : "bg-neutral-200 text-neutral-500 dark:bg-neutral-700",
        )}
      >
        {keep ? "Keep" : "Remove"}
      </span>
      <span className="min-w-0 truncate">
        <span className="font-mono">{track.fileName}</span> · {details.join(" · ")}
      </span>
    </button>
  );
}
