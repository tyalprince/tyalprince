"use client";

import { useState } from "react";
import {
  ChevronDown,
  ListMusic,
  Music2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlayer, usePlayerProgress } from "./player-context";
import { artworkUrl, displayArtist, formatTime, type Track } from "@/lib/music/types";
import { keyLabel } from "@/lib/music/analysis";

export function Artwork({ track, className }: { track: Pick<Track, "artworkKey" | "album"> | null; className?: string }) {
  const url = track ? artworkUrl(track.artworkKey) : null;
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded bg-neutral-200 text-neutral-400 dark:bg-neutral-800",
        className,
      )}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- presigned redirect URLs; next/image can't optimise them
        <img src={url} alt={track?.album ?? ""} loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <Music2 className="h-1/2 w-1/2" />
      )}
    </div>
  );
}

/**
 * Mini player pinned above the mobile bottom nav (bottom of the screen on
 * desktop). Tap it for the full Now Playing view. Renders a spacer so page
 * content isn't hidden behind it.
 */
export function PlayerBar() {
  const p = usePlayer();
  const { position, duration } = usePlayerProgress();
  const [expanded, setExpanded] = useState(false);
  if (!p.current) return null;
  const progress = duration ? (position / duration) * 100 : 0;

  return (
    <>
      <div className="h-16" aria-hidden />
      <div className="fixed inset-x-0 bottom-14 z-30 border-t border-neutral-200 bg-white/95 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95 md:bottom-0 md:left-56">
        <div className="h-0.5 bg-neutral-200 dark:bg-neutral-800">
          <div className="h-full bg-indigo-500" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex items-center gap-3 px-3 py-2">
          <button onClick={() => setExpanded(true)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <Artwork track={p.current} className="h-10 w-10" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{p.current.title}</span>
              <span className="block truncate text-xs text-neutral-500">{displayArtist(p.current)}</span>
            </span>
          </button>
          <button onClick={p.prev} className="hidden rounded p-2 sm:block" aria-label="Previous">
            <SkipBack className="h-5 w-5" />
          </button>
          <button onClick={p.toggle} className="rounded-full p-2" aria-label={p.playing ? "Pause" : "Play"}>
            {p.playing ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
          </button>
          <button onClick={p.next} className="rounded p-2" aria-label="Next">
            <SkipForward className="h-5 w-5" />
          </button>
        </div>
      </div>
      {expanded && <NowPlaying onClose={() => setExpanded(false)} />}
    </>
  );
}

function NowPlaying({ onClose }: { onClose: () => void }) {
  const p = usePlayer();
  const { position, duration } = usePlayerProgress();
  const [showQueue, setShowQueue] = useState(false);
  const t = p.current!;
  const RepeatIcon = p.repeat === "one" ? Repeat1 : Repeat;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-neutral-950">
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={onClose} className="rounded p-1" aria-label="Close">
          <ChevronDown className="h-6 w-6" />
        </button>
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Now playing</span>
        <button
          onClick={() => setShowQueue((v) => !v)}
          className={cn("rounded p-1", showQueue && "text-indigo-500")}
          aria-label="Queue"
        >
          <ListMusic className="h-6 w-6" />
        </button>
      </div>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 overflow-y-auto px-6 pb-8">
        {showQueue ? (
          <ol className="space-y-1">
            {p.queue.map((q, i) => (
              <li key={`${q.id}-${i}`}>
                <button
                  onClick={() => p.jumpTo(i)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded px-2 py-1.5 text-left",
                    i === p.index ? "bg-indigo-50 dark:bg-indigo-950/40" : "hover:bg-neutral-50 dark:hover:bg-neutral-900",
                  )}
                >
                  <Artwork track={q} className="h-9 w-9" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{q.title}</span>
                    <span className="block truncate text-xs text-neutral-500">{displayArtist(q)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <>
            <Artwork track={t} className="aspect-square w-full rounded-xl shadow-lg" />
            <div>
              <h2 className="truncate text-xl font-semibold">{t.title}</h2>
              <p className="truncate text-neutral-500">
                {displayArtist(t)}
                {t.album ? ` — ${t.album}` : ""}
              </p>
              {t.features && (
                <p className="mt-1 text-xs text-neutral-400">
                  {Math.round(t.features.tempo)} BPM · {keyLabel(t.features.key, t.features.mode)} · energy{" "}
                  {Math.round(t.features.energy * 100)}%
                </p>
              )}
            </div>
          </>
        )}

        <div className="mt-auto space-y-4">
          <div>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={1}
              value={Math.min(position, duration || 0)}
              onChange={(e) => p.seek(Number(e.target.value))}
              className="w-full accent-indigo-500"
              aria-label="Seek"
            />
            <div className="flex justify-between text-xs tabular-nums text-neutral-500">
              <span>{formatTime(position)}</span>
              <span>-{formatTime(Math.max(0, duration - position))}</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <button
              onClick={() => p.setShuffle(!p.shuffle)}
              className={cn("rounded p-2", p.shuffle ? "text-indigo-500" : "text-neutral-400")}
              aria-label="Shuffle"
              aria-pressed={p.shuffle}
            >
              <Shuffle className="h-5 w-5" />
            </button>
            <button onClick={p.prev} className="rounded p-2" aria-label="Previous">
              <SkipBack className="h-8 w-8" />
            </button>
            <button
              onClick={p.toggle}
              className="rounded-full bg-neutral-900 p-4 text-white dark:bg-neutral-100 dark:text-neutral-900"
              aria-label={p.playing ? "Pause" : "Play"}
            >
              {p.playing ? <Pause className="h-8 w-8" /> : <Play className="h-8 w-8" />}
            </button>
            <button onClick={p.next} className="rounded p-2" aria-label="Next">
              <SkipForward className="h-8 w-8" />
            </button>
            <button
              onClick={p.cycleRepeat}
              className={cn("rounded p-2", p.repeat !== "off" ? "text-indigo-500" : "text-neutral-400")}
              aria-label={`Repeat: ${p.repeat}`}
            >
              <RepeatIcon className="h-5 w-5" />
            </button>
          </div>
          <label className="hidden items-center gap-2 text-neutral-400 md:flex">
            <Volume2 className="h-4 w-4" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={p.volume}
              onChange={(e) => p.setVolume(Number(e.target.value))}
              className="w-full accent-indigo-500"
              aria-label="Volume"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
