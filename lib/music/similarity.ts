import type { AudioFeatures } from "@/lib/music/analysis";

// Similarity + playlist generation over the user's library. Everything runs
// on the client against the full track list (a 10GB library is ~2–3k songs —
// trivial to score in memory), so generating a mix is instant and needs no
// vector database.

export type SimTrack = {
  id: string;
  title: string;
  artist: string | null;
  albumArtist?: string | null;
  album: string | null;
  genre: string | null;
  year: number | null;
  durationSeconds?: string | number | null;
  features: AudioFeatures | null;
  featureVector: number[] | null;
  liked?: boolean;
  playCount?: number;
};

// ---------------------------------------------------------------------------
// Feature vector
// ---------------------------------------------------------------------------

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Relative importance of each vector slot when comparing two songs. */
const WEIGHTS = [1.4, 1.6, 0.6, 1.0, 0.6, 0.5, 0.9, 0.6, 0.5, 0.5];

/**
 * Normalises features to 0..1 slots. Key is placed on the circle of fifths
 * (sin/cos), so musically compatible keys (C ↔ G ↔ D…) sit close together.
 */
export function buildFeatureVector(f: AudioFeatures): number[] {
  const tempo = f.tempo > 0 ? clamp01(Math.log2(f.tempo / 60) / 2) : 0.5; // 60–240 BPM
  const fifths = ((f.key * 7) % 12) / 12;
  const angle = 2 * Math.PI * fifths;
  return [
    tempo,
    clamp01(f.energy),
    clamp01(f.dynamics),
    clamp01((f.brightness - 500) / 3500),
    clamp01(f.flatness / 0.5),
    clamp01(f.zcr / 0.2),
    clamp01(f.pulse),
    f.mode,
    0.5 + 0.5 * Math.sin(angle) * f.keyConfidence,
    0.5 + 0.5 * Math.cos(angle) * f.keyConfidence,
  ].map((v) => Math.round(v * 1000) / 1000);
}

/** 0..1, where 1 = identical sound profile. */
export function audioSimilarity(a: number[], b: number[]): number {
  let sum = 0;
  let wsum = 0;
  for (let i = 0; i < Math.min(a.length, b.length, WEIGHTS.length); i++) {
    sum += WEIGHTS[i] * (a[i] - b[i]) ** 2;
    wsum += WEIGHTS[i];
  }
  return wsum ? 1 - Math.sqrt(sum / wsum) : 0;
}

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
const mainArtist = (t: SimTrack) => norm(t.albumArtist || t.artist);

/** Tag-based closeness: genre, artist and era. */
export function metadataSimilarity(a: SimTrack, b: SimTrack): number {
  const genre = norm(a.genre) && norm(a.genre) === norm(b.genre) ? 1 : 0;
  const artist = mainArtist(a) && mainArtist(a) === mainArtist(b) ? 1 : 0;
  const era = a.year && b.year ? Math.max(0, 1 - Math.abs(a.year - b.year) / 15) : 0.3;
  return 0.5 * genre + 0.25 * artist + 0.25 * era;
}

export function trackSimilarity(a: SimTrack, b: SimTrack): number {
  const meta = metadataSimilarity(a, b);
  if (!a.featureVector || !b.featureVector) return meta;
  return 0.65 * audioSimilarity(a.featureVector, b.featureVector) + 0.35 * meta;
}

// ---------------------------------------------------------------------------
// Playlist building blocks
// ---------------------------------------------------------------------------

/** Takes the best-scoring tracks while capping how many come from one artist. */
export function pickWithVariety<T extends SimTrack>(
  scored: { track: T; score: number }[],
  count: number,
  maxPerArtist = 3,
): T[] {
  const perArtist = new Map<string, number>();
  const out: T[] = [];
  for (const { track } of [...scored].sort((a, b) => b.score - a.score)) {
    const key = mainArtist(track) || track.id;
    const n = perArtist.get(key) ?? 0;
    if (n >= maxPerArtist) continue;
    perArtist.set(key, n + 1);
    out.push(track);
    if (out.length >= count) break;
  }
  return out;
}

/** Orders tracks so each song flows into the next (nearest-neighbour walk). */
export function orderForFlow<T extends SimTrack>(tracks: T[], startId?: string): T[] {
  if (tracks.length < 3) return [...tracks];
  const remaining = [...tracks];
  const startIdx = Math.max(0, startId ? remaining.findIndex((t) => t.id === startId) : 0);
  const out = remaining.splice(startIdx, 1);
  while (remaining.length) {
    const last = out[out.length - 1];
    let best = 0;
    let bestScore = -Infinity;
    remaining.forEach((t, i) => {
      // Avoid back-to-back songs by the same artist when possible.
      const s = trackSimilarity(last, t) - (mainArtist(last) && mainArtist(last) === mainArtist(t) ? 0.15 : 0);
      if (s > bestScore) {
        bestScore = s;
        best = i;
      }
    });
    out.push(remaining.splice(best, 1)[0]);
  }
  return out;
}

/** "More like this": songs closest to one or more seeds, seeds first.
 *  `variety` (0..~0.2) adds random jitter to scores so regenerating gives a fresh pick. */
export function similarTo<T extends SimTrack>(seeds: T[], library: T[], count = 25, variety = 0): T[] {
  if (!seeds.length) return [];
  const seedIds = new Set(seeds.map((s) => s.id));
  const scored = library
    .filter((t) => !seedIds.has(t.id))
    .map((track) => ({
      track,
      score: Math.max(...seeds.map((s) => trackSimilarity(s, track))) + (variety ? Math.random() * variety : 0),
    }));
  const picked = pickWithVariety(scored, Math.max(0, count - seeds.length));
  return orderForFlow([...seeds, ...picked], seeds[0].id);
}

// ---------------------------------------------------------------------------
// Mood mixes
// ---------------------------------------------------------------------------

export type MoodKey = "workout" | "party" | "chill" | "focus" | "melancholy" | "upbeat";

type Target = { tempo?: [number, number]; energy?: [number, number]; pulse?: [number, number]; mode?: number; dynamics?: [number, number] };

export const MOODS: Record<MoodKey, { label: string; description: string; target: Target; ramp?: boolean }> = {
  // Energy targets are percentiles within the user's own library (see moodMix).
  workout: { label: "Workout", description: "High energy, 120–160 BPM, builds to a peak", target: { tempo: [120, 165], energy: [0.6, 1], pulse: [0.3, 1] }, ramp: true },
  party: { label: "Party", description: "Danceable, strong beat, 110–135 BPM", target: { tempo: [108, 135], energy: [0.5, 1], pulse: [0.4, 1] } },
  upbeat: { label: "Upbeat", description: "Bright, major-key, feel-good", target: { energy: [0.4, 0.9], mode: 1, tempo: [95, 140] } },
  chill: { label: "Chill", description: "Laid-back and mellow", target: { tempo: [60, 105], energy: [0, 0.4] } },
  focus: { label: "Focus", description: "Steady, even, low distraction", target: { energy: [0.2, 0.6], dynamics: [0, 0.4], tempo: [70, 125] } },
  melancholy: { label: "Late night", description: "Minor-key, moody, slower", target: { mode: 0, energy: [0, 0.5], tempo: [60, 115] } },
};

/** Songs scoring below this don't fit the mood and are left out, even if the mix ends up shorter. */
export const MIN_MOOD_SCORE = 0.55;

/**
 * Each track's energy as a percentile of the library (0 = quietest, 1 = most
 * intense). Mastering loudness varies hugely between eras, so "high energy"
 * is judged relative to what the user actually owns.
 */
export function energyPercentiles(library: SimTrack[]): Map<string, number> {
  const analysed = library.filter((t) => t.features).sort((a, b) => a.features!.energy - b.features!.energy);
  const out = new Map<string, number>();
  analysed.forEach((t, i) => out.set(t.id, analysed.length > 1 ? i / (analysed.length - 1) : t.features!.energy));
  return out;
}

/** Distance outside a [lo, hi] range, scaled by the range width (0 inside). */
function rangeMiss(v: number, [lo, hi]: [number, number]): number {
  if (v >= lo && v <= hi) return 0;
  const width = Math.max(1e-6, hi - lo);
  return (v < lo ? lo - v : v - hi) / width;
}

export function moodScore(f: AudioFeatures, target: Target): number {
  let miss = 0;
  if (target.tempo && f.tempo) {
    // Half/double-time counts: a 70 BPM ballad can feel like 140.
    miss += Math.min(rangeMiss(f.tempo, target.tempo), rangeMiss(f.tempo * 2, target.tempo) + 0.3, rangeMiss(f.tempo / 2, target.tempo) + 0.3);
  }
  if (target.energy) miss += 1.5 * rangeMiss(f.energy, target.energy);
  if (target.pulse) miss += rangeMiss(f.pulse, target.pulse);
  if (target.dynamics) miss += rangeMiss(f.dynamics, target.dynamics);
  if (target.mode !== undefined && f.keyConfidence > 0.15 && f.mode !== target.mode) miss += 0.6;
  return 1 / (1 + miss);
}

export type MixOptions = { count?: number; genres?: string[]; decades?: number[]; likedBoost?: boolean; variety?: number };

/** Applies genre / decade filters (empty = everything). */
export function filterLibrary<T extends SimTrack>(library: T[], opts: Pick<MixOptions, "genres" | "decades">): T[] {
  const genres = new Set((opts.genres ?? []).map(norm));
  const decades = new Set(opts.decades ?? []);
  return library.filter(
    (t) =>
      (!genres.size || genres.has(norm(t.genre))) &&
      (!decades.size || (t.year !== null && decades.has(Math.floor(t.year / 10) * 10))),
  );
}

export function moodMix<T extends SimTrack>(mood: MoodKey, library: T[], opts: MixOptions = {}): T[] {
  const { target, ramp } = MOODS[mood];
  const pct = energyPercentiles(library);
  const pool = filterLibrary(library, opts).filter((t) => t.features);
  const scored = pool
    .map((track) => ({ track, fit: moodScore({ ...track.features!, energy: pct.get(track.id) ?? track.features!.energy }, target) }))
    .filter(({ fit }) => fit >= MIN_MOOD_SCORE)
    .map(({ track, fit }) => ({
      track,
      score: fit + (opts.likedBoost && track.liked ? 0.1 : 0) + (opts.variety ? Math.random() * opts.variety : 0),
    }));
  const picked = pickWithVariety(scored, opts.count ?? 25);
  if (ramp) {
    // Warm up → build to the peak → finish on the calmest track as a cool-down.
    const ascending = [...picked].sort((a, b) => a.features!.energy - b.features!.energy);
    if (ascending.length < 4) return ascending;
    const [calmest, ...rest] = ascending;
    return [...rest, calmest];
  }
  return orderForFlow(picked);
}

export function totalDurationSeconds(tracks: SimTrack[]): number {
  return tracks.reduce((s, t) => s + Number(t.durationSeconds ?? 0), 0);
}
