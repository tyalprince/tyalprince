import { z } from "zod";
import { normalizeArtist, normalizeTitle } from "@/lib/music/metadata-sources";
import { trackYear } from "@/lib/music/facets";
import type { Track } from "@/lib/music/types";

// The non-AI middle of an AI mix: the model first turns the listener's request
// into criteria (MixIntent), then the whole library is scored against them
// here, and only the best few hundred songs go back to the model to curate.

const list = (max: number) => z.array(z.string().trim().min(1).max(200)).max(max).catch([]);
const optInt = (min: number, max: number) => z.number().int().min(min).max(max).nullable().catch(null);

export const mixIntentSchema = z.object({
  genres: list(20),
  yearFrom: optInt(1900, 2100),
  yearTo: optInt(1900, 2100),
  artists: list(40),
  excludeArtists: list(40),
  songs: z
    .array(z.object({ title: z.string().trim().min(1).max(200), artist: z.string().trim().max(200).nullable().catch(null) }))
    .max(60)
    .catch([]),
  energy: z.enum(["low", "medium", "high"]).nullable().catch(null),
  tempoMin: optInt(30, 300),
  tempoMax: optInt(30, 300),
  likedOnly: z.boolean().catch(false),
  minStars: z.number().int().min(0).max(5).catch(0),
  keywords: list(20),
});

export type MixIntent = z.infer<typeof mixIntentSchema>;

export function parseIntent(raw: unknown): MixIntent {
  return mixIntentSchema.parse(raw && typeof raw === "object" ? raw : {});
}

const artistOf = (t: Track) => t.artist || t.albumArtist || "";
const norm = (s: string | null | undefined) => normalizeTitle(s);

function matchesAny(value: string | null | undefined, wanted: string[]): boolean {
  const v = norm(value);
  if (!v) return false;
  return wanted.some((w) => {
    const n = norm(w);
    return n && (v.includes(n) || n.includes(v));
  });
}

function artistMatches(t: Track, wanted: string[]): boolean {
  const a = normalizeArtist(artistOf(t));
  return Boolean(a) && wanted.some((w) => {
    const n = normalizeArtist(w);
    return n && (a === n || a.includes(n) || n.includes(a));
  });
}

/** Energy as a 0–1 rank within this library (raw loudness-based energy varies by mastering era). */
function energyRanks(tracks: Track[]): Map<string, number> {
  const withEnergy = tracks.filter((t) => typeof t.features?.energy === "number");
  const sorted = [...withEnergy].sort((a, b) => a.features!.energy - b.features!.energy);
  return new Map(sorted.map((t, i) => [t.id, sorted.length > 1 ? i / (sorted.length - 1) : 0.5]));
}

function tempoFits(bpm: number | undefined, min: number | null, max: number | null): boolean {
  if (!bpm || (!min && !max)) return false;
  // Beat trackers often report half or double time; accept either.
  return [bpm, bpm / 2, bpm * 2].some((b) => (!min || b >= min) && (!max || b <= max));
}

export type Candidate = { track: Track; score: number };

/**
 * Scores every song against the request and returns the best `limit`.
 * Hard rules (years, excluded artists, liked/rating) filter; everything else
 * adds to the score. A little randomness keeps "regenerate" from repeating.
 */
export function shortlist(tracks: Track[], intent: MixIntent, limit = 200, random = Math.random): Candidate[] {
  const ranks = energyRanks(tracks);
  const named = intent.songs.map((s) => ({ title: norm(s.title), artist: s.artist ? normalizeArtist(s.artist) : null }));
  const hasYears = intent.yearFrom !== null || intent.yearTo !== null;
  const positive =
    intent.genres.length + intent.artists.length + named.length + intent.keywords.length > 0 ||
    intent.energy !== null ||
    intent.tempoMin !== null ||
    intent.tempoMax !== null;

  const scored: Candidate[] = [];
  for (const t of tracks) {
    if (t.remote) continue;
    if (intent.excludeArtists.length && artistMatches(t, intent.excludeArtists)) continue;
    if (intent.likedOnly && !t.liked) continue;
    if (intent.minStars && (t.rating ?? 0) < intent.minStars * 20) continue;
    const year = trackYear(t);
    if (hasYears && (!year || (intent.yearFrom !== null && year < intent.yearFrom) || (intent.yearTo !== null && year > intent.yearTo))) continue;

    let score = 0;
    if (intent.genres.length && matchesAny(t.genre, intent.genres)) score += 3;
    if (intent.artists.length && artistMatches(t, intent.artists)) score += 4;
    const title = norm(t.title);
    const artist = normalizeArtist(artistOf(t));
    if (named.some((s) => s.title && title === s.title && (!s.artist || artist.includes(s.artist) || s.artist.includes(artist)))) score += 10;
    if (intent.keywords.length && (matchesAny(t.title, intent.keywords) || matchesAny(t.album, intent.keywords))) score += 2;
    const rank = ranks.get(t.id);
    if (intent.energy && rank !== undefined) {
      if (intent.energy === "high" && rank >= 0.6) score += 2;
      else if (intent.energy === "low" && rank <= 0.4) score += 2;
      else if (intent.energy === "medium" && rank > 0.25 && rank < 0.75) score += 1;
    }
    if (tempoFits(t.features?.tempo, intent.tempoMin, intent.tempoMax)) score += 2;
    if (positive && score === 0) continue;
    score += (t.liked ? 0.5 : 0) + ((t.rating ?? 0) / 100) * 1.5 + Math.min(Math.log10(1 + t.playCount), 1) * 0.5;
    scored.push({ track: t, score: score + random() * 0.75 });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** One compact line per candidate for the curating prompt ("12. Title — Artist (1996) [R&B/Soul] 94 bpm, mellow"). */
export function candidateLines(candidates: Candidate[], ranks = energyRanks(candidates.map((c) => c.track))): string {
  return candidates
    .map(({ track: t }, i) => {
      const year = trackYear(t);
      const rank = ranks.get(t.id);
      const energy = rank === undefined ? null : rank >= 0.67 ? "high energy" : rank <= 0.33 ? "mellow" : "mid energy";
      const bits = [
        year ? `(${year})` : null,
        t.genre ? `[${t.genre}]` : null,
        t.features?.tempo ? `${Math.round(t.features.tempo)} bpm` : null,
        energy,
        t.liked ? "♥" : null,
        t.rating ? `${Math.round(t.rating / 20)}★` : null,
      ].filter(Boolean);
      return `${i + 1}. ${t.title} — ${artistOf(t) || "Unknown"} ${bits.join(" ")}`.trim();
    })
    .join("\n");
}

/** A short picture of the library for the first prompt: genres, eras and the most common artists. */
export function librarySummary(tracks: Track[]): string {
  const genres = new Map<string, number>();
  const artists = new Map<string, number>();
  let min = Infinity;
  let max = -Infinity;
  for (const t of tracks) {
    if (t.genre) genres.set(t.genre, (genres.get(t.genre) ?? 0) + 1);
    const a = artistOf(t);
    if (a) artists.set(a, (artists.get(a) ?? 0) + 1);
    const y = trackYear(t);
    if (y) {
      min = Math.min(min, y);
      max = Math.max(max, y);
    }
  }
  const top = (m: Map<string, number>, n: number) =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${k} (${v})`).join(", ");
  return [
    `${tracks.length} songs${Number.isFinite(min) ? `, released ${min}–${max}` : ""}.`,
    `Genres: ${top(genres, 25)}.`,
    `Most common artists: ${top(artists, 60)}.`,
  ].join("\n");
}

/** Maps the model's 1-based picks back to tracks: in range, no repeats, at most `count`. */
export function resolvePicks(picks: unknown, candidates: Candidate[], count: number): Track[] {
  if (!Array.isArray(picks)) return [];
  const seen = new Set<number>();
  const out: Track[] = [];
  for (const p of picks) {
    const i = typeof p === "number" ? p : Number.parseInt(String(p), 10);
    if (!Number.isInteger(i) || i < 1 || i > candidates.length || seen.has(i)) continue;
    seen.add(i);
    out.push(candidates[i - 1].track);
    if (out.length >= count) break;
  }
  return out;
}

/** The first JSON object in a model reply (models sometimes wrap it in prose or code fences). */
export function parseJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}
