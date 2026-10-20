"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ExternalLink, Pause, Play, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api-client";
import { usePlayer } from "./player-context";
import { useLibrary } from "./library-context";
import { Artwork } from "./player-bar";
import { genreLabel, JAMENDO_GENRES, type ExploreView } from "@/lib/music/jamendo";
import { displayArtist, formatTime, type Track } from "@/lib/music/types";

type Page = { configured: boolean; tracks: Track[]; hasMore: boolean };
type Result = { key: string; tracks: Track[]; hasMore: boolean; configured: boolean; error: string | null };

const VIEWS: { view: Exclude<ExploreView, "search">; label: string }[] = [
  { view: "trending", label: "Trending" },
  { view: "new", label: "New releases" },
  { view: "genre", label: "Genres" },
];

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/**
 * Free, Creative Commons music from independent artists on Jamendo: stream
 * anything, and save songs the artist allows to be downloaded into the library.
 */
export function Explore() {
  const player = usePlayer();
  const library = useLibrary();
  const [view, setView] = useState<Exclude<ExploreView, "search">>("trending");
  const [genre, setGenre] = useState<string>("hiphop");
  const [query, setQuery] = useState("");
  const q = useDebounced(query.trim(), 400);
  const [offset, setOffset] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [saving, setSaving] = useState<Record<string, "saving" | "error">>({});
  const [notice, setNotice] = useState<string | null>(null);

  const activeView: ExploreView = q ? "search" : view;
  const baseKey = `${activeView}|${activeView === "genre" ? genre : ""}|${activeView === "search" ? q : ""}`;
  const key = `${baseKey}|${offset}`;

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ view: activeView, offset: String(offset) });
    if (activeView === "genre") params.set("genre", genre);
    if (activeView === "search") params.set("q", q);
    apiFetch<Page>(`/api/music/explore?${params}`)
      .then((page) => {
        if (cancelled) return;
        setResult((prev) => ({
          key,
          configured: page.configured,
          hasMore: page.hasMore,
          error: null,
          // "Load more" appends to the same list.
          tracks: offset > 0 && prev?.key.startsWith(`${baseKey}|`) ? [...prev.tracks, ...page.tracks] : page.tracks,
        }));
      })
      .catch((err) => {
        if (cancelled) return;
        setResult((prev) => ({
          key,
          configured: true,
          hasMore: false,
          error: err instanceof Error ? err.message : "Couldn't reach Jamendo",
          tracks: offset > 0 && prev?.key.startsWith(`${baseKey}|`) ? prev.tracks : [],
        }));
      });
    return () => {
      cancelled = true;
    };
  }, [key, baseKey, activeView, genre, q, offset]);

  const loading = result?.key !== key;
  const tracks = useMemo(() => (result && (loading ? result.key.startsWith(`${baseKey}|`) : true) ? result.tracks : []), [result, loading, baseKey]);

  const saved = useMemo(() => {
    const ids = new Set<string>();
    for (const t of library.tracks ?? []) if (t.external?.jamendoId) ids.add(t.external.jamendoId);
    return ids;
  }, [library.tracks]);

  function reset(next: () => void) {
    setOffset(0);
    next();
  }

  async function save(t: Track) {
    const id = t.remote!.jamendoId;
    setSaving((s) => ({ ...s, [id]: "saving" }));
    try {
      const { track } = await apiFetch<{ track: Track }>("/api/music/explore/save", {
        method: "POST",
        body: JSON.stringify({ jamendoId: id }),
      });
      if (!library.byId.has(track.id)) library.addTracks([track]);
      setSaving((s) => {
        const rest = { ...s };
        delete rest[id];
        return rest;
      });
      setNotice(`Saved "${t.title}" to your library`);
    } catch (err) {
      setSaving((s) => ({ ...s, [id]: "error" }));
      setNotice(err instanceof Error ? err.message : "Couldn't save that song");
    }
  }

  if (result && !result.configured) return <JamendoSetup />;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-neutral-400" />
        <Input
          value={query}
          onChange={(e) => reset(() => setQuery(e.target.value))}
          placeholder="Search free music — songs, artists, moods"
          className="pl-8"
        />
      </div>

      {!q && (
        <div className="flex flex-wrap gap-2">
          {VIEWS.map((v) => (
            <button
              key={v.view}
              onClick={() => reset(() => setView(v.view))}
              className={cn(
                "rounded-full px-3 py-1 text-sm",
                view === v.view ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}
      {!q && view === "genre" && (
        <div className="flex flex-wrap gap-1.5">
          {JAMENDO_GENRES.map((g) => (
            <button
              key={g}
              onClick={() => reset(() => setGenre(g))}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs",
                genre === g ? "border-indigo-400 bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" : "border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-400",
              )}
            >
              {genreLabel(g)}
            </button>
          ))}
        </div>
      )}

      {notice && <p className="text-xs text-emerald-600">{notice}</p>}
      {result?.error && !loading && <p className="text-sm text-red-600">{result.error}</p>}

      {tracks.length > 0 && (
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => player.play(tracks)}>
            <Play className="h-4 w-4" />
            Play all
          </Button>
        </div>
      )}

      <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
        {tracks.map((t, i) => {
          const r = t.remote!;
          const active = player.current?.id === t.id;
          const isSaved = saved.has(r.jamendoId);
          return (
            <div key={t.id} className="flex items-center gap-3 py-2">
              <button
                onClick={() => (active ? player.toggle() : player.play(tracks, i))}
                className="group relative shrink-0"
                aria-label={active && player.playing ? `Pause ${t.title}` : `Play ${t.title}`}
              >
                <Artwork track={t} className="h-12 w-12" />
                <span className={cn("absolute inset-0 flex items-center justify-center rounded bg-black/40 text-white", active ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
                  {active && player.playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                </span>
              </button>
              <div className="min-w-0 flex-1">
                <p className={cn("truncate text-sm", active && "font-semibold text-indigo-600 dark:text-indigo-400")}>{t.title}</p>
                <p className="truncate text-xs text-neutral-500">
                  {displayArtist(t)}
                  {t.album ? ` · ${t.album}` : ""}
                </p>
                <p className="flex flex-wrap items-center gap-x-2 text-[11px] text-neutral-400">
                  {t.genre && <span>{t.genre}</span>}
                  {t.year && <span>{t.year}</span>}
                  {r.license && (
                    <a href={r.licenseUrl ?? undefined} target="_blank" rel="noreferrer" className="hover:underline">
                      {r.license}
                    </a>
                  )}
                  {r.pageUrl && (
                    <a href={r.pageUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 hover:underline">
                      Jamendo <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  )}
                </p>
              </div>
              <span className="hidden shrink-0 text-xs tabular-nums text-neutral-400 sm:block">{formatTime(t.durationSeconds)}</span>
              {isSaved ? (
                <span className="flex shrink-0 items-center gap-1 text-xs text-emerald-600">
                  <Check className="h-4 w-4" />
                  <span className="hidden sm:inline">In library</span>
                </span>
              ) : r.downloadable ? (
                <button
                  onClick={() => save(t)}
                  disabled={saving[r.jamendoId] === "saving"}
                  className="flex shrink-0 items-center gap-1 rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                  aria-label={`Save ${t.title} to library`}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{saving[r.jamendoId] === "saving" ? "Saving…" : "Save"}</span>
                </button>
              ) : (
                <span className="shrink-0 text-[11px] text-neutral-400" title="The artist only allows streaming">
                  Stream only
                </span>
              )}
            </div>
          );
        })}
      </div>

      {loading && <p className="py-4 text-center text-sm text-neutral-500">Loading…</p>}
      {!loading && !tracks.length && !result?.error && <p className="py-8 text-center text-sm text-neutral-500">No songs found.</p>}
      {!loading && result?.hasMore && (
        <div className="text-center">
          <Button variant="ghost" onClick={() => setOffset(tracks.length)}>
            Load more
          </Button>
        </div>
      )}

      <p className="pt-2 text-[11px] text-neutral-400">
        Music from{" "}
        <a href="https://www.jamendo.com" target="_blank" rel="noreferrer" className="underline">
          Jamendo
        </a>
        , shared by independent artists under Creative Commons licenses for personal listening. Tap a song&apos;s license
        for its terms.
      </p>
    </div>
  );
}

function JamendoSetup() {
  return (
    <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950/40">
      <p className="font-semibold">Connect Jamendo to explore free music</p>
      <p className="text-xs text-neutral-600 dark:text-neutral-300">One-time setup, about 3 minutes:</p>
      <ol className="list-decimal space-y-1 pl-5 text-xs text-neutral-700 dark:text-neutral-300">
        <li>
          Go to{" "}
          <a href="https://devportal.jamendo.com" target="_blank" rel="noreferrer" className="underline">
            devportal.jamendo.com
          </a>
          , sign up and create an app (any name; website: your app&apos;s URL).
        </li>
        <li>Copy its <b>Client ID</b>.</li>
        <li>
          In Vercel → Settings → Environment Variables, add <code>JAMENDO_CLIENT_ID</code> with that value, then redeploy.
        </li>
      </ol>
    </div>
  );
}
