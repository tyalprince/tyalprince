"use client";

import { useEffect, useRef, useState } from "react";
import { Heart, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlayer } from "./player-context";
import { Stars } from "./stars";
import { Artwork } from "./player-bar";
import { displayArtist, formatTime, type Track } from "@/lib/music/types";

const PAGE = 150;

/**
 * Song list that renders in pages as you scroll (a full library is a few
 * thousand rows). Tapping a row plays the list from that song.
 */
export function TrackList({
  tracks,
  onDetails,
  showArtwork = true,
  numbered = false,
  empty = "No songs.",
}: {
  tracks: Track[];
  onDetails: (track: Track) => void;
  showArtwork?: boolean;
  numbered?: boolean;
  empty?: string;
}) {
  const player = usePlayer();
  const [limit, setLimit] = useState(PAGE);
  const sentinel = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setLimit((l) => l + PAGE);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [tracks, limit]);

  if (!tracks.length) return <p className="py-8 text-center text-sm text-neutral-500">{empty}</p>;

  return (
    <div className="divide-y divide-neutral-100 dark:divide-neutral-800/70">
      {tracks.slice(0, limit).map((t, i) => {
        const active = player.current?.id === t.id;
        return (
          <div key={t.id} className="flex items-center gap-3 py-2">
            <button onClick={() => player.play(tracks, i)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
              {numbered ? (
                <span className="w-6 shrink-0 text-right text-xs tabular-nums text-neutral-400">{t.trackNumber ?? i + 1}</span>
              ) : (
                showArtwork && <Artwork track={t} className="h-11 w-11" />
              )}
              <span className="min-w-0">
                <span className={cn("block truncate text-sm", active && "font-semibold text-indigo-600 dark:text-indigo-400")}>
                  {t.title}
                </span>
                <span className="block truncate text-xs text-neutral-500">
                  {displayArtist(t)}
                  {t.album && !numbered ? ` · ${t.album}` : ""}
                </span>
              </span>
            </button>
            {t.liked && <Heart className="h-3.5 w-3.5 shrink-0 fill-rose-500 text-rose-500" aria-label="Liked" />}
            {t.rating ? (
              <span className="hidden shrink-0 sm:block">
                <Stars rating={t.rating} size="h-3 w-3" />
              </span>
            ) : null}
            <span className="hidden w-10 shrink-0 text-right text-xs tabular-nums text-neutral-400 md:block" title={`${t.playCount} plays`}>
              {t.playCount > 0 ? t.playCount.toLocaleString() : ""}
            </span>
            <span className="hidden shrink-0 text-xs tabular-nums text-neutral-400 sm:block">{formatTime(t.durationSeconds)}</span>
            <button
              onClick={() => onDetails(t)}
              className="shrink-0 rounded p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800"
              aria-label={`Details for ${t.title}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        );
      })}
      {limit < tracks.length && <div ref={sentinel} className="h-10" />}
    </div>
  );
}
