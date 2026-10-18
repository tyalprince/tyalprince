"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";
import { usePlayer, usePlayerProgress } from "./player-context";
import { activeLyricIndex, parseLrc } from "@/lib/music/metadata-sources";
import { formatReleaseDate, type Track } from "@/lib/music/types";

type Lyrics = { plain: string | null; synced: string | null; source: "embedded" | "lrclib" | null; instrumental: boolean };

const lyricsCache = new Map<string, Lyrics>();

/** Fetches (and caches per session) a track's lyrics. */
function useLyrics(trackId: string) {
  const [state, setState] = useState<{ id: string; lyrics: Lyrics | null; error: boolean }>(() => ({
    id: trackId,
    lyrics: lyricsCache.get(trackId) ?? null,
    error: false,
  }));
  useEffect(() => {
    if (lyricsCache.has(trackId)) return;
    let cancelled = false;
    apiFetch<Lyrics>(`/api/music/tracks/${trackId}/lyrics`)
      .then((l) => {
        lyricsCache.set(trackId, l);
        if (!cancelled) setState({ id: trackId, lyrics: l, error: false });
      })
      .catch(() => !cancelled && setState({ id: trackId, lyrics: null, error: true }));
    return () => {
      cancelled = true;
    };
  }, [trackId]);
  const cached = lyricsCache.get(trackId) ?? null;
  return { lyrics: state.id === trackId ? (state.lyrics ?? cached) : cached, error: state.id === trackId && state.error };
}

/**
 * Lyrics for a track. When time-synced lyrics exist and this track is the one
 * playing, the current line is highlighted and kept in view; tap a line to jump.
 */
export function LyricsView({ track, follow = false }: { track: Track; follow?: boolean }) {
  const { lyrics, error } = useLyrics(track.id);
  const player = usePlayer();
  const { position } = usePlayerProgress();
  const lines = useMemo(() => parseLrc(lyrics?.synced), [lyrics?.synced]);
  const isPlaying = player.current?.id === track.id;
  const active = follow && isPlaying ? activeLyricIndex(lines, position) : -1;
  const activeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [active]);

  if (error) return <p className="text-sm text-neutral-500">Couldn&apos;t load lyrics right now.</p>;
  if (!lyrics) return <p className="text-sm text-neutral-500">Finding lyrics…</p>;
  if (lyrics.instrumental) return <p className="text-sm text-neutral-500">Instrumental — no lyrics.</p>;
  if (!lyrics.plain && !lines.length) return <p className="text-sm text-neutral-500">No lyrics found for this song.</p>;

  return (
    <div className="space-y-3">
      {lines.length ? (
        <div className="space-y-2">
          {lines.map((l, i) => (
            <button
              key={`${l.time}-${i}`}
              ref={i === active ? activeRef : undefined}
              onClick={() => isPlaying && player.seek(l.time)}
              className={cn(
                "block w-full text-left text-lg font-semibold leading-snug transition-colors",
                !follow || !isPlaying
                  ? "text-neutral-700 dark:text-neutral-300"
                  : i === active
                    ? "text-neutral-900 dark:text-white"
                    : i < active
                      ? "text-neutral-400 dark:text-neutral-500"
                      : "text-neutral-300 dark:text-neutral-600",
              )}
            >
              {l.text || "♪"}
            </button>
          ))}
        </div>
      ) : (
        <p className="whitespace-pre-line text-base leading-relaxed text-neutral-800 dark:text-neutral-200">{lyrics.plain}</p>
      )}
      <p className="text-xs text-neutral-400">
        {lyrics.source === "embedded" ? "Lyrics from the song file" : "Lyrics from LRCLIB (community-sourced)"}
      </p>
    </div>
  );
}

/** "Written by", "Produced by", release date, label… — whatever is known. */
export function CreditsList({ track }: { track: Track }) {
  const rows: [string, string | null][] = [
    ["Released", formatReleaseDate(track.releaseDate) ?? (track.year ? String(track.year) : null)],
    ["Album", track.album],
    ["Album artist", track.albumArtist && track.albumArtist !== track.artist ? track.albumArtist : null],
    ["Written by", track.composer],
    ["Lyrics by", track.lyricist && track.lyricist !== track.composer ? track.lyricist : null],
    ["Produced by", track.producer],
    ["Genre", track.genre],
    ["Label", track.label],
    ["Copyright", track.copyright],
  ];
  const known = rows.filter(([, v]) => v);
  const links = [
    track.external?.appleMusicUrl ? { label: "Apple Music", href: track.external.appleMusicUrl } : null,
    track.external?.musicbrainzRecordingId
      ? { label: "MusicBrainz", href: `https://musicbrainz.org/recording/${track.external.musicbrainzRecordingId}` }
      : null,
  ].filter((l): l is { label: string; href: string } => Boolean(l));

  return (
    <div className="space-y-3">
      {known.length ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          {known.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-neutral-500">{label}</dt>
              <dd className="min-w-0 break-words">{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm text-neutral-500">No details yet.</p>
      )}
      {!track.enrichedAt && <p className="text-xs text-neutral-400">Looking up artwork, release date and songwriters…</p>}
      {track.enrichedAt && !track.composer && (
        <p className="text-xs text-neutral-400">Songwriter credits weren&apos;t found for this recording.</p>
      )}
      {links.length > 0 && (
        <div className="flex flex-wrap gap-3 text-xs">
          {links.map((l) => (
            <a key={l.label} href={l.href} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
              <ExternalLink className="h-3 w-3" />
              {l.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
