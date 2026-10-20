"use client";

import Link from "next/link";
import { ChevronRight, ListMusic, Music, Pause, Play, SkipForward } from "lucide-react";
import { usePlayer, usePlayerProgress } from "./player-context";
import { Artwork } from "./player-bar";
import { artworkUrl, displayArtist, plural, type Track } from "@/lib/music/types";
import type { MusicDashboard } from "@/lib/music/dashboard";

/** Music at the top of the dashboard: now playing, recently played, playlists, most played. */
export function DashboardMusic({ data }: { data: MusicDashboard }) {
  return (
    <section className="mb-6 space-y-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Music</h2>
        <Link href="/music" className="flex items-center text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200">
          {plural(data.songCount, "song")}
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
      <NowPlaying fallback={data.mostPlayed.length ? data.mostPlayed : data.recent} />
      <TrackRow title="Recently played" tracks={data.recent} />
      {data.playlists.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-neutral-600 dark:text-neutral-400">Your playlists</h3>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            {data.playlists.map((p) => {
              const art = artworkUrl(p.artworkKey);
              return (
                <Link key={p.id} href={`/music?playlist=${p.id}`} className="w-28 shrink-0">
                  <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg bg-indigo-50 text-indigo-500 dark:bg-indigo-950">
                    {art ? (
                      // eslint-disable-next-line @next/next/no-img-element -- presigned redirect URLs; next/image can't optimise them
                      <img src={art} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <ListMusic className="h-8 w-8" />
                    )}
                  </div>
                  <p className="mt-1 truncate text-sm">{p.name}</p>
                  <p className="text-xs text-neutral-500">{plural(p.trackCount, "song")}</p>
                </Link>
              );
            })}
          </div>
        </div>
      )}
      <TrackRow title="Most played" tracks={data.mostPlayed} />
    </section>
  );
}

function NowPlaying({ fallback }: { fallback: Track[] }) {
  const player = usePlayer();
  const { position, duration } = usePlayerProgress();
  const t = player.current;
  if (!t) {
    return (
      <div className="flex items-center gap-4 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-400 dark:bg-neutral-800">
          <Music className="h-7 w-7" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">Nothing playing</p>
          <p className="text-xs text-neutral-500">{fallback.length ? "Start with your most played songs." : "Open Music to pick something."}</p>
        </div>
        {fallback.length > 0 ? (
          <button
            onClick={() => player.play(fallback, Math.floor(Math.random() * fallback.length), { shuffle: true })}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
            aria-label="Shuffle your most played songs"
          >
            <Play className="h-5 w-5" />
          </button>
        ) : (
          <Link href="/music" className="text-sm text-indigo-600 dark:text-indigo-400">
            Open Music
          </Link>
        )}
      </div>
    );
  }
  const pct = duration ? Math.min(100, (position / duration) * 100) : 0;
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center gap-4 p-4">
        <Artwork track={t} className="h-20 w-20 rounded-lg shadow" />
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide text-neutral-500">{player.playing ? "Now playing" : "Paused"}</p>
          <p className="truncate text-base font-semibold">{t.title}</p>
          <p className="truncate text-sm text-neutral-500">{displayArtist(t)}</p>
        </div>
        <button
          onClick={player.toggle}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
          aria-label={player.playing ? "Pause" : "Play"}
        >
          {player.playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </button>
        <button onClick={player.next} className="shrink-0 p-1 text-neutral-500" aria-label="Next song">
          <SkipForward className="h-5 w-5" />
        </button>
      </div>
      <div className="h-1 bg-neutral-100 dark:bg-neutral-800">
        <div className="h-full bg-indigo-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function TrackRow({ title, tracks }: { title: string; tracks: Track[] }) {
  const player = usePlayer();
  if (!tracks.length) return null;
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-neutral-600 dark:text-neutral-400">{title}</h3>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {tracks.map((t, i) => (
          <button key={t.id} onClick={() => player.play(tracks, i)} className="w-28 shrink-0 text-left">
            <Artwork track={t} className="aspect-square w-full rounded-lg" />
            <p className={player.current?.id === t.id ? "mt-1 truncate text-sm font-semibold text-indigo-600 dark:text-indigo-400" : "mt-1 truncate text-sm"}>
              {t.title}
            </p>
            <p className="truncate text-xs text-neutral-500">{displayArtist(t)}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
