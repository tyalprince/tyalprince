"use client";

import { useMemo, useState } from "react";
import { Heart, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { LibraryProvider, useLibrary } from "./library-context";
import { TrackList } from "./track-list";
import { TrackDetails } from "./track-details";
import {
  AlbumGrid,
  AlbumView,
  ArtistList,
  ArtistView,
  YearList,
  YearView,
  groupAlbums,
  groupArtists,
  type Album,
  type Artist,
} from "./browse";
import { FilterBar } from "./filter-bar";
import { applyFilters, groupByYear, NO_FILTERS, trackYear, type SongFilters, type YearGroup } from "@/lib/music/facets";
import { PlaylistList, PlaylistView } from "./playlists";
import { Mixes } from "./mixes";
import { Explore } from "./explore";
import { ImportPanel } from "./import-panel";
import { DetailsPanel } from "./details-panel";
import { DuplicatesPanel } from "./duplicates-panel";
import { MissingReportPanel } from "./missing-report";
import { formatBytes, type PlaylistSummary, type Track } from "@/lib/music/types";

const TABS = ["songs", "albums", "artists", "years", "playlists", "mixes", "explore", "import"] as const;
type Tab = (typeof TABS)[number];
type Sort = "title" | "artist" | "recent" | "plays" | "rating" | "year";

type Drill =
  | { kind: "album"; album: Album }
  | { kind: "artist"; artist: Artist }
  | { kind: "year"; year: YearGroup }
  | { kind: "playlist"; playlist: PlaylistSummary }
  | null;

export function MusicApp() {
  return (
    <LibraryProvider>
      <MusicInner />
    </LibraryProvider>
  );
}

function MusicInner() {
  const library = useLibrary();
  const [tab, setTab] = useState<Tab | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("artist");
  const [likedOnly, setLikedOnly] = useState(false);
  const [filters, setFilters] = useState<SongFilters>(NO_FILTERS);
  const [drill, setDrill] = useState<Drill>(null);
  const [details, setDetails] = useState<Track | null>(null);
  const [mixSeed, setMixSeed] = useState<Track | null>(null);

  const tracks = useMemo(() => library.tracks ?? [], [library.tracks]);
  // Land on Import if the library is empty when first loaded — decided once,
  // so songs arriving mid-import don't yank the view away from the progress.
  const [landing, setLanding] = useState<Tab | null>(null);
  if (landing === null && library.tracks) setLanding(library.tracks.length ? "songs" : "import");
  const activeTab: Tab = tab ?? landing ?? "songs";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = q
      ? tracks.filter((t) => `${t.title} ${t.artist ?? ""} ${t.albumArtist ?? ""} ${t.album ?? ""} ${t.genre ?? ""}`.toLowerCase().includes(q))
      : tracks;
    if (likedOnly) list = list.filter((t) => t.liked);
    return list;
  }, [tracks, query, likedOnly]);

  // The Songs tab adds the multi-select filters and sorting on top of search.
  const songs = useMemo(() => {
    const list = applyFilters(filtered, filters);
    const added = (t: Track) => t.addedAt ?? t.createdAt;
    const by: Record<Sort, (a: Track, b: Track) => number> = {
      title: (a, b) => a.title.localeCompare(b.title),
      artist: () => 0, // API already returns artist → album → track order
      recent: (a, b) => added(b).localeCompare(added(a)),
      plays: (a, b) => b.playCount - a.playCount,
      rating: (a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.playCount - a.playCount,
      year: (a, b) => (trackYear(b) ?? 0) - (trackYear(a) ?? 0),
    };
    return sort === "artist" ? list : [...list].sort(by[sort]);
  }, [filtered, filters, sort]);

  const albums = useMemo(() => groupAlbums(filtered), [filtered]);
  const artists = useMemo(() => groupArtists(filtered), [filtered]);
  const years = useMemo(() => groupByYear(filtered), [filtered]);
  const totalBytes = useMemo(() => tracks.reduce((s, t) => s + t.fileSize, 0), [tracks]);

  function go(t: Tab) {
    setTab(t);
    setDrill(null);
  }

  function makeMix(seed: Track) {
    setDetails(null);
    setMixSeed(seed);
    go("mixes");
  }

  let body: React.ReactNode;
  if (drill?.kind === "album") {
    body = <AlbumView album={drill.album} onBack={() => setDrill(null)} onDetails={setDetails} />;
  } else if (drill?.kind === "artist") {
    body = (
      <ArtistView
        artist={drill.artist}
        onBack={() => setDrill(null)}
        onOpenAlbum={(album) => setDrill({ kind: "album", album })}
        onDetails={setDetails}
      />
    );
  } else if (drill?.kind === "year") {
    body = <YearView year={drill.year} onBack={() => setDrill(null)} onDetails={setDetails} />;
  } else if (drill?.kind === "playlist") {
    body = <PlaylistView playlist={drill.playlist} onBack={() => setDrill(null)} onDetails={setDetails} />;
  } else if (library.tracks === null) {
    body = <p className="text-sm text-neutral-500">Loading your library…</p>;
  } else {
    switch (activeTab) {
      case "songs":
        body = (
          <>
            <FilterBar tracks={filtered} filters={filters} onChange={setFilters} />
            {songs.length !== tracks.length && songs.length > 0 && (
              <p className="mb-2 text-xs text-neutral-500">{songs.length.toLocaleString()} songs</p>
            )}
            <TrackList tracks={songs} onDetails={setDetails} empty={tracks.length ? "No matches." : "No songs yet — use Import."} />
          </>
        );
        break;
      case "albums":
        body = <AlbumGrid albums={albums} onOpen={(album) => setDrill({ kind: "album", album })} />;
        break;
      case "artists":
        body = <ArtistList artists={artists} onOpen={(artist) => setDrill({ kind: "artist", artist })} />;
        break;
      case "years":
        body = <YearList decades={years} onOpen={(year) => setDrill({ kind: "year", year })} />;
        break;
      case "playlists":
        body = <PlaylistList onOpen={(playlist) => setDrill({ kind: "playlist", playlist })} />;
        break;
      case "mixes":
        body = (
          <Mixes
            key={mixSeed?.id ?? "none"}
            initialSeed={mixSeed}
            onDetails={setDetails}
            onOpenPlaylist={(playlist) => setDrill({ kind: "playlist", playlist })}
          />
        );
        break;
      case "explore":
        body = <Explore />;
        break;
      case "import":
        body = null; // rendered below and kept mounted so an import survives tab switches
        break;
    }
  }

  const searchable = !drill && ["songs", "albums", "artists", "years"].includes(activeTab);

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl p-4 sm:p-6">
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold">Music</h1>
        {tracks.length > 0 && (
          <span className="text-xs text-neutral-500">
            {tracks.length.toLocaleString()} songs · {formatBytes(totalBytes)}
          </span>
        )}
      </div>

      <div className="mb-4 flex gap-1 overflow-x-auto rounded-md bg-neutral-100 p-1 dark:bg-neutral-800">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => go(t)}
            className={cn(
              "whitespace-nowrap rounded px-3 py-1.5 text-sm font-medium capitalize transition-colors",
              activeTab === t && !drill
                ? "bg-white shadow-sm dark:bg-neutral-950"
                : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {searchable && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-neutral-400" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search songs, artists, albums, genres" className="pl-8" />
          </div>
          {activeTab === "songs" && (
            <>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                className="rounded-md border border-neutral-300 bg-white px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                aria-label="Sort songs"
              >
                <option value="artist">Artist</option>
                <option value="title">Title</option>
                <option value="recent">Recently added</option>
                <option value="plays">Most played</option>
                <option value="rating">Top rated</option>
                <option value="year">Newest</option>
              </select>
              <button
                onClick={() => setLikedOnly((v) => !v)}
                className={cn(
                  "flex items-center gap-1 rounded-md border px-2.5 py-2 text-sm",
                  likedOnly ? "border-rose-300 text-rose-600" : "border-neutral-300 text-neutral-500 dark:border-neutral-700",
                )}
                aria-pressed={likedOnly}
              >
                <Heart className={cn("h-4 w-4", likedOnly && "fill-rose-500")} />
                Liked
              </button>
            </>
          )}
        </div>
      )}

      {body}
      {library.tracks !== null && (
        <div className={activeTab === "import" && !drill ? undefined : "hidden"}>
          <ImportPanel />
          <DetailsPanel />
          <MissingReportPanel />
          <DuplicatesPanel />
        </div>
      )}

      {details && <TrackDetails key={details.id} track={details} onClose={() => setDetails(null)} onMakeMix={makeMix} />}
    </div>
  );
}
