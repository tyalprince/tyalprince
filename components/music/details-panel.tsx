"use client";

import { useMemo, useRef, useState } from "react";
import { ImageIcon, Pause, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { useLibrary } from "./library-context";
import type { Track } from "@/lib/music/types";

/** One song per album first (album art and release dates fill in fast), then the rest. */
export function lookupOrder(tracks: Track[]): Track[] {
  const pending = tracks.filter((t) => !t.enrichedAt);
  const seen = new Set<string>();
  const firsts: Track[] = [];
  const rest: Track[] = [];
  for (const t of pending) {
    const key = `${(t.albumArtist || t.artist || "").toLowerCase()}|${(t.album || t.id).toLowerCase()}`;
    if (seen.has(key)) rest.push(t);
    else {
      seen.add(key);
      firsts.push(t);
    }
  }
  return [...firsts, ...rest];
}

/**
 * Bulk "fill in the gaps" for the library: album art and release dates from
 * the iTunes catalog, and optionally songwriter/producer credits from
 * MusicBrainz (rate-limited to ~1 lookup/second, so that part is slower).
 * Songs are also looked up automatically the first time they're played.
 */
export function DetailsPanel() {
  const library = useLibrary();
  const tracks = useMemo(() => library.tracks ?? [], [library.tracks]);
  const [credits, setCredits] = useState(true);
  const [state, setState] = useState<"idle" | "running" | "paused" | "done">("idle");
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [lastAt, setLastAt] = useState(0);
  const control = useRef({ paused: false, stopped: false });

  const missingArt = tracks.filter((t) => !t.artworkKey).length;
  const notLookedUp = tracks.filter((t) => !t.enrichedAt).length;

  async function run() {
    const queue = lookupOrder(tracks);
    control.current = { paused: false, stopped: false };
    setTotal(queue.length);
    setDone(0);
    setStartedAt(Date.now());
    setState("running");
    for (const t of queue) {
      while (control.current.paused && !control.current.stopped) await new Promise((r) => setTimeout(r, 300));
      if (control.current.stopped) break;
      try {
        const { track } = await apiFetch<{ track: Track }>(`/api/music/tracks/${t.id}/enrich`, {
          method: "POST",
          body: JSON.stringify({ credits }),
        });
        library.replaceTrack({ ...t, ...track });
      } catch {
        // Skip this one; it'll be retried next run or when played.
      }
      setDone((d) => d + 1);
      setLastAt(Date.now());
    }
    library.reload(); // pick up art/dates shared with album-mates
    setState("done");
  }

  if (!tracks.length) return null;
  const elapsed = (lastAt - startedAt) / 1000;
  const perSong = done ? elapsed / done : credits ? 4 : 1.5;
  const minutesLeft = Math.ceil(((total - done) * perSong) / 60);

  return (
    <div className="mt-6 space-y-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex items-start gap-3">
        <ImageIcon className="mt-0.5 h-5 w-5 shrink-0 text-neutral-400" />
        <div>
          <p className="text-sm font-semibold">Artwork, release dates &amp; credits</p>
          <p className="text-xs text-neutral-500">
            {missingArt.toLocaleString()} songs without artwork · {notLookedUp.toLocaleString()} not looked up yet. Songs are
            also filled in automatically the first time you play them.
          </p>
        </div>
      </div>

      {state === "idle" || state === "done" ? (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
            <input type="checkbox" checked={credits} onChange={(e) => setCredits(e.target.checked)} />
            Include songwriter &amp; producer credits (slower, ~3–4 s per song)
          </label>
          <Button onClick={run} disabled={!notLookedUp}>
            <Play className="h-4 w-4" />
            {notLookedUp ? `Look up ${notLookedUp.toLocaleString()} songs` : "Everything is looked up"}
          </Button>
          {state === "done" && <p className="text-xs text-emerald-600">Done — looked up {done.toLocaleString()} songs.</p>}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
            <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
          </div>
          <p className="text-xs text-neutral-500">
            {done.toLocaleString()} / {total.toLocaleString()}
            {state === "running" && total > done ? ` · ~${minutesLeft} min left` : state === "paused" ? " · paused" : ""}
          </p>
          <div className="flex gap-2">
            {state === "running" ? (
              <Button variant="secondary" onClick={() => { control.current.paused = true; setState("paused"); }}>
                <Pause className="h-4 w-4" />
                Pause
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => { control.current.paused = false; setState("running"); }}>
                <Play className="h-4 w-4" />
                Resume
              </Button>
            )}
            <Button variant="ghost" onClick={() => (control.current.stopped = true)}>
              <Square className="h-4 w-4" />
              Stop
            </Button>
          </div>
          <p className="text-xs text-neutral-500">Keep this tab open; you can stop any time and pick up later.</p>
        </div>
      )}
    </div>
  );
}
