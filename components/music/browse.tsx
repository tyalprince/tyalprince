"use client";

import { useMemo } from "react";
import { ChevronLeft, Play, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlayer } from "./player-context";
import { Artwork } from "./player-bar";
import { TrackList } from "./track-list";
import { formatTime, plural, type Track } from "@/lib/music/types";
import { totalDurationSeconds } from "@/lib/music/similarity";
import { decadeLabel, type DecadeGroup, type YearGroup } from "@/lib/music/facets";

export type Album = { key: string; name: string; artist: string; year: number | null; tracks: Track[] };
export type Artist = { name: string; tracks: Track[]; albums: Album[] };

const albumArtistOf = (t: Track) => t.albumArtist || t.artist || "Unknown artist";

export function groupAlbums(tracks: Track[]): Album[] {
  const map = new Map<string, Album>();
  for (const t of tracks) {
    const artist = albumArtistOf(t);
    const name = t.album || "Unknown album";
    const key = `${artist.toLowerCase()}\u0000${name.toLowerCase()}`;
    const year = t.releaseDate ? Number(t.releaseDate.slice(0, 4)) : t.year;
    const album = map.get(key) ?? { key, name, artist, year, tracks: [] };
    album.tracks.push(t);
    album.year = album.year ?? year;
    map.set(key, album);
  }
  for (const a of map.values()) {
    a.tracks.sort((x, y) => (x.discNumber ?? 1) - (y.discNumber ?? 1) || (x.trackNumber ?? 0) - (y.trackNumber ?? 0));
  }
  return [...map.values()].sort((a, b) => a.artist.localeCompare(b.artist) || (a.year ?? 0) - (b.year ?? 0));
}

export function groupArtists(tracks: Track[]): Artist[] {
  const map = new Map<string, Track[]>();
  for (const t of tracks) {
    const name = albumArtistOf(t);
    map.set(name, [...(map.get(name) ?? []), t]);
  }
  return [...map.entries()]
    .map(([name, list]) => ({ name, tracks: list, albums: groupAlbums(list) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function PlayButtons({ tracks }: { tracks: Track[] }) {
  const player = usePlayer();
  return (
    <div className="flex gap-2">
      <Button onClick={() => player.play(tracks)}>
        <Play className="h-4 w-4" />
        Play
      </Button>
      <Button
        variant="secondary"
        onClick={() => player.play(tracks, Math.floor(Math.random() * tracks.length), { shuffle: true })}
      >
        <Shuffle className="h-4 w-4" />
        Shuffle
      </Button>
    </div>
  );
}

export function BackLink({ onClick, label = "Back" }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} className="mb-3 flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200">
      <ChevronLeft className="h-4 w-4" />
      {label}
    </button>
  );
}

export function AlbumGrid({ albums, onOpen }: { albums: Album[]; onOpen: (album: Album) => void }) {
  if (!albums.length) return <p className="py-8 text-center text-sm text-neutral-500">No albums.</p>;
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {albums.map((a) => (
        <button key={a.key} onClick={() => onOpen(a)} className="min-w-0 text-left">
          <Artwork track={a.tracks[0]} className="aspect-square w-full rounded-lg" />
          <p className="mt-1.5 truncate text-sm font-medium">{a.name}</p>
          <p className="truncate text-xs text-neutral-500">{a.artist}</p>
        </button>
      ))}
    </div>
  );
}

export function AlbumView({ album, onBack, onDetails }: { album: Album; onBack: () => void; onDetails: (t: Track) => void }) {
  return (
    <div>
      <BackLink onClick={onBack} />
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end">
        <Artwork track={album.tracks[0]} className="aspect-square w-48 rounded-xl shadow" />
        <div className="space-y-2">
          <div>
            <h2 className="text-xl font-semibold">{album.name}</h2>
            <p className="text-neutral-500">{album.artist}</p>
            <p className="text-xs text-neutral-400">
              {[album.year, `${album.tracks.length} songs`, formatTime(totalDurationSeconds(album.tracks))].filter(Boolean).join(" · ")}
            </p>
          </div>
          <PlayButtons tracks={album.tracks} />
        </div>
      </div>
      <TrackList tracks={album.tracks} onDetails={onDetails} numbered />
    </div>
  );
}

export function ArtistList({ artists, onOpen }: { artists: Artist[]; onOpen: (a: Artist) => void }) {
  if (!artists.length) return <p className="py-8 text-center text-sm text-neutral-500">No artists.</p>;
  return (
    <div className="divide-y divide-neutral-100 dark:divide-neutral-800/70">
      {artists.map((a) => (
        <button key={a.name} onClick={() => onOpen(a)} className="flex w-full items-center gap-3 py-2 text-left">
          <Artwork track={a.tracks[0]} className="h-11 w-11 rounded-full" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{a.name}</span>
            <span className="block text-xs text-neutral-500">
              {a.albums.length} album{a.albums.length === 1 ? "" : "s"} · {a.tracks.length} song{a.tracks.length === 1 ? "" : "s"}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

export function ArtistView({
  artist,
  onBack,
  onOpenAlbum,
  onDetails,
}: {
  artist: Artist;
  onBack: () => void;
  onOpenAlbum: (a: Album) => void;
  onDetails: (t: Track) => void;
}) {
  const top = useMemo(() => [...artist.tracks].sort((a, b) => b.playCount - a.playCount).slice(0, 5), [artist.tracks]);
  return (
    <div className="space-y-5">
      <div>
        <BackLink onClick={onBack} />
        <h2 className="text-xl font-semibold">{artist.name}</h2>
        <p className="mb-2 text-xs text-neutral-500">{artist.tracks.length} songs</p>
        <PlayButtons tracks={artist.tracks} />
      </div>
      <section>
        <h3 className="mb-1 text-sm font-semibold">Top songs</h3>
        <TrackList tracks={top} onDetails={onDetails} />
      </section>
      <section>
        <h3 className="mb-2 text-sm font-semibold">Albums</h3>
        <AlbumGrid albums={artist.albums} onOpen={onOpenAlbum} />
      </section>
    </div>
  );
}

/** Up to four different album covers from a set of songs. */
function coversOf(tracks: Track[]): Track[] {
  const seen = new Set<string>();
  const out: Track[] = [];
  for (const t of tracks) {
    if (!t.artworkKey || seen.has(t.artworkKey)) continue;
    seen.add(t.artworkKey);
    out.push(t);
    if (out.length === 4) break;
  }
  return out;
}

export function YearList({ decades, onOpen }: { decades: DecadeGroup[]; onOpen: (year: YearGroup) => void }) {
  if (!decades.length) return <p className="py-8 text-center text-sm text-neutral-500">No release years yet.</p>;
  return (
    <div className="space-y-6">
      {decades.map((d) => (
        <section key={d.decade}>
          <h3 className="mb-2 flex items-baseline gap-2 text-lg font-semibold">
            {decadeLabel(d.decade)}
            <span className="text-xs font-normal text-neutral-500">{plural(d.count, "song")}</span>
          </h3>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {d.years.map((y) => {
              const covers = coversOf(y.tracks);
              return (
                <button key={y.year} onClick={() => onOpen(y)} className="min-w-0 text-left">
                  <div className="grid aspect-square w-full grid-cols-2 overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-800">
                    {covers.length >= 4 ? (
                      covers.map((t) => <Artwork key={t.id} track={t} className="h-full w-full rounded-none" />)
                    ) : (
                      <Artwork track={covers[0] ?? y.tracks[0]} className="col-span-2 row-span-2 h-full w-full rounded-none" />
                    )}
                  </div>
                  <p className="mt-1 text-sm font-semibold">{y.year}</p>
                  <p className="text-xs text-neutral-500">{plural(y.tracks.length, "song")}</p>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export function YearView({ year, onBack, onDetails }: { year: YearGroup; onBack: () => void; onDetails: (t: Track) => void }) {
  const albums = useMemo(() => groupAlbums(year.tracks).length, [year.tracks]);
  return (
    <div>
      <BackLink onClick={onBack} label="Years" />
      <div className="mb-4 space-y-2">
        <div>
          <h2 className="text-2xl font-semibold">{year.year}</h2>
          <p className="text-xs text-neutral-400">
            {plural(year.tracks.length, "song")} · {plural(albums, "album")} · {formatTime(totalDurationSeconds(year.tracks))}
          </p>
        </div>
        <PlayButtons tracks={year.tracks} />
      </div>
      <TrackList tracks={year.tracks} onDetails={onDetails} />
    </div>
  );
}
