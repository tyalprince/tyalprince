"use client";

import { useMemo, useState } from "react";
import { Check, Play, RefreshCw, Save, Search, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePlayer } from "./player-context";
import { useLibrary } from "./library-context";
import { Artwork } from "./player-bar";
import { TrackList } from "./track-list";
import { AiMix } from "./ai-mix";
import { MOODS, totalDurationSeconds, type MoodKey } from "@/lib/music/similarity";
import { recipeName, runRecipe, type MixRecipe } from "@/lib/music/mixes";
import { displayArtist, formatTime, type Track } from "@/lib/music/types";

const COUNTS = [15, 25, 50, 100];

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs",
        active
          ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
          : "border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Playlist generator: "song radio" from one or more seed songs, or a mood
 * mix (workout, chill, focus…) filtered by genre and decade. The result can
 * be previewed, played, regenerated, and saved as a playlist that remembers
 * its recipe so it can be refreshed later.
 */
export function Mixes({ initialSeed, onDetails }: { initialSeed: Track | null; onDetails: (t: Track) => void }) {
  const library = useLibrary();
  const player = usePlayer();
  const tracks = useMemo(() => library.tracks ?? [], [library.tracks]);
  const [seeds, setSeeds] = useState<Track[]>(initialSeed ? [initialSeed] : []);
  const [query, setQuery] = useState("");
  const [count, setCount] = useState(25);
  const [genres, setGenres] = useState<string[]>([]);
  const [decades, setDecades] = useState<number[]>([]);
  // Opened from a song's "Make a mix": start with that song's radio ready to play.
  const [recipe, setRecipe] = useState<MixRecipe | null>(
    initialSeed ? { type: "similar", seedIds: [initialSeed.id], count: 25 } : null,
  );
  const [result, setResult] = useState<Track[]>(() => (recipe ? runRecipe(recipe, library.tracks ?? []) : []));
  const [name, setName] = useState(initialSeed ? `More like ${initialSeed.title}` : "");
  const [saved, setSaved] = useState(false);
  const analyzed = tracks.filter((t) => t.features).length;

  const topGenres = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of tracks) if (t.genre) counts.set(t.genre, (counts.get(t.genre) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([g]) => g);
  }, [tracks]);
  const allDecades = useMemo(
    () => [...new Set(tracks.filter((t) => t.year).map((t) => Math.floor(t.year! / 10) * 10))].sort(),
    [tracks],
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return tracks
      .filter((t) => `${t.title} ${t.artist ?? ""} ${t.album ?? ""}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, tracks]);

  function generate(r: MixRecipe, variety = 0) {
    setRecipe(r);
    setResult(runRecipe(r, tracks, variety));
    setName(recipeName(r, tracks));
    setSaved(false);
  }

  async function save() {
    if (!recipe || !result.length) return;
    await library.createPlaylist({
      name: name.trim() || recipeName(recipe, tracks),
      trackIds: result.map((t) => t.id),
      kind: "generated",
      recipe: recipe as unknown as Record<string, unknown>,
    });
    setSaved(true);
  }

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  if (!tracks.length) {
    return <p className="py-8 text-center text-sm text-neutral-500">Import some music first — mixes are built from your library.</p>;
  }

  return (
    <div className="space-y-6">
      {analyzed < tracks.length && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          {analyzed} of {tracks.length} songs have audio analysis. The rest are matched on artist, genre and year.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-neutral-500">Length</span>
        {COUNTS.map((c) => (
          <Chip key={c} active={count === c} onClick={() => setCount(c)}>
            {c} songs
          </Chip>
        ))}
      </div>

      <AiMix count={count} onDetails={onDetails} />

      <section className="space-y-3">
        <div>
          <h3 className="font-semibold">Song radio</h3>
          <p className="text-xs text-neutral-500">Pick up to 5 songs; the mix finds what sounds like them and orders it to flow.</p>
        </div>
        {seeds.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {seeds.map((s) => (
              <span key={s.id} className="flex items-center gap-1.5 rounded-full bg-neutral-100 py-1 pl-1 pr-2 text-xs dark:bg-neutral-800">
                <Artwork track={s} className="h-5 w-5 rounded-full" />
                <span className="max-w-40 truncate">{s.title}</span>
                <button onClick={() => setSeeds(seeds.filter((x) => x.id !== s.id))} aria-label={`Remove ${s.title}`}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-neutral-400" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a seed song…" className="pl-8" />
        </div>
        {matches.length > 0 && (
          <div className="rounded-md border border-neutral-200 dark:border-neutral-800">
            {matches.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  if (seeds.length < 5 && !seeds.some((s) => s.id === t.id)) setSeeds([...seeds, t]);
                  setQuery("");
                }}
                className="flex w-full items-center gap-2 border-b border-neutral-100 px-2 py-1.5 text-left last:border-0 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800"
              >
                <Artwork track={t} className="h-8 w-8" />
                <span className="min-w-0">
                  <span className="block truncate text-sm">{t.title}</span>
                  <span className="block truncate text-xs text-neutral-500">{displayArtist(t)}</span>
                </span>
              </button>
            ))}
          </div>
        )}
        <Button onClick={() => generate({ type: "similar", seedIds: seeds.map((s) => s.id), count })} disabled={!seeds.length}>
          <Sparkles className="h-4 w-4" />
          Make song radio
        </Button>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="font-semibold">Mood mixes</h3>
          <p className="text-xs text-neutral-500">Built from tempo, energy, beat and key. Optionally narrow by genre or decade.</p>
        </div>
        {topGenres.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {topGenres.map((g) => (
              <Chip key={g} active={genres.includes(g)} onClick={() => setGenres(toggle(genres, g))}>
                {g}
              </Chip>
            ))}
          </div>
        )}
        {allDecades.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {allDecades.map((d) => (
              <Chip key={d} active={decades.includes(d)} onClick={() => setDecades(toggle(decades, d))}>
                {d}s
              </Chip>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(Object.keys(MOODS) as MoodKey[]).map((m) => (
            <button
              key={m}
              onClick={() => generate({ type: "mood", mood: m, count, genres, decades })}
              className="rounded-lg border border-neutral-200 p-3 text-left hover:border-indigo-400 hover:bg-indigo-50/50 dark:border-neutral-800 dark:hover:bg-indigo-950/30"
            >
              <span className="block text-sm font-medium">{MOODS[m].label}</span>
              <span className="block text-xs text-neutral-500">{MOODS[m].description}</span>
            </button>
          ))}
        </div>
      </section>


      {recipe && (
        <section className="space-y-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Mix name" className="font-medium" />
          <p className="text-xs text-neutral-500">
            {result.length} songs · {formatTime(totalDurationSeconds(result))}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => player.play(result)} disabled={!result.length}>
              <Play className="h-4 w-4" />
              Play
            </Button>
            <Button variant="secondary" onClick={save} disabled={!result.length || saved}>
              {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              {saved ? "Saved to playlists" : "Save as playlist"}
            </Button>
            <Button variant="ghost" onClick={() => generate({ ...recipe, count }, 0.12)}>
              <RefreshCw className="h-4 w-4" />
              Regenerate
            </Button>
          </div>
          <TrackList tracks={result} onDetails={onDetails} empty="Nothing matched — try fewer filters." />
        </section>
      )}
    </div>
  );
}
