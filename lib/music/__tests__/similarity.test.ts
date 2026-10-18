import { describe, expect, it } from "vitest";
import type { AudioFeatures } from "@/lib/music/analysis";
import {
  audioSimilarity,
  buildFeatureVector,
  filterLibrary,
  moodMix,
  orderForFlow,
  similarTo,
  trackSimilarity,
  type SimTrack,
} from "@/lib/music/similarity";

const base: AudioFeatures = { tempo: 120, pulse: 0.5, key: 0, mode: 1, keyConfidence: 0.6, loudness: -12, energy: 0.6, dynamics: 0.3, brightness: 2000, flatness: 0.1, zcr: 0.06 };

let n = 0;
function track(over: Partial<SimTrack> & { f?: Partial<AudioFeatures> } = {}): SimTrack {
  const features = { ...base, ...over.f };
  n += 1;
  return {
    id: `t${n}`,
    title: `Song ${n}`,
    artist: over.artist ?? `Artist ${n}`,
    album: null,
    genre: over.genre ?? "Pop",
    year: over.year ?? 2015,
    durationSeconds: 200,
    features,
    featureVector: buildFeatureVector(features),
    ...over,
  };
}

describe("similarity", () => {
  it("scores identical features as 1 and very different ones much lower", () => {
    const v = buildFeatureVector(base);
    expect(audioSimilarity(v, v)).toBe(1);
    const far = buildFeatureVector({ ...base, tempo: 70, energy: 0.1, brightness: 600, mode: 0 });
    expect(audioSimilarity(v, far)).toBeLessThan(0.75);
  });

  it("treats musically close keys (C and G) as closer than distant ones (C and F♯)", () => {
    const c = buildFeatureVector(base);
    const g = buildFeatureVector({ ...base, key: 7 });
    const fs = buildFeatureVector({ ...base, key: 6 });
    expect(audioSimilarity(c, g)).toBeGreaterThan(audioSimilarity(c, fs));
  });

  it("falls back to tags when a track has no audio analysis", () => {
    const a = track({ genre: "Rock", artist: "X", featureVector: null });
    const b = track({ genre: "Rock", artist: "X", featureVector: null });
    const c = track({ genre: "Jazz", featureVector: null, year: 1960 });
    expect(trackSimilarity(a, b)).toBeGreaterThan(trackSimilarity(a, c));
  });
});

describe("similarTo", () => {
  it("starts with the seed, prefers similar songs and caps per-artist repeats", () => {
    const seed = track({ f: { tempo: 128, energy: 0.8 } });
    const close = Array.from({ length: 6 }, () => track({ artist: "Same", f: { tempo: 126, energy: 0.78 } }));
    const far = Array.from({ length: 6 }, () => track({ genre: "Ambient", year: 1990, f: { tempo: 70, energy: 0.1, brightness: 700 } }));
    const mix = similarTo([seed], [seed, ...close, ...far], 6);
    expect(mix[0].id).toBe(seed.id);
    expect(mix.filter((t) => t.artist === "Same").length).toBeLessThanOrEqual(3);
    expect(mix.length).toBe(6);
  });
});

describe("moodMix", () => {
  const lib = [
    ...Array.from({ length: 10 }, (_, i) => track({ f: { tempo: 135 + i, energy: 0.7 + i * 0.02 } })),
    ...Array.from({ length: 10 }, (_, i) => track({ f: { tempo: 80 + i, energy: 0.2 + i * 0.01 } })),
  ];

  it("workout picks high-energy fast songs and ends on a cool-down", () => {
    const mix = moodMix("workout", lib, { count: 8 });
    expect(mix).toHaveLength(8);
    expect(mix.every((t) => t.features!.tempo >= 120)).toBe(true);
    const energies = mix.map((t) => t.features!.energy);
    expect(energies[mix.length - 2]).toBe(Math.max(...energies));
  });

  it("leaves out songs that don't fit the mood, even when asked for more", () => {
    const mix = moodMix("workout", lib, { count: 100 });
    expect(mix.length).toBeLessThan(lib.length);
    expect(mix.every((t) => t.features!.tempo >= 120)).toBe(true);
  });

  it("judges energy relative to the library, not absolute loudness", () => {
    // A quietly-mastered library: every song is "low energy" in absolute terms.
    const quiet = Array.from({ length: 10 }, (_, i) => track({ f: { tempo: 128, energy: 0.2 + i * 0.02, pulse: 0.6 } }));
    expect(moodMix("workout", quiet, { count: 10 }).length).toBeGreaterThan(0);
  });

  it("chill picks slow, low-energy songs", () => {
    const mix = moodMix("chill", lib, { count: 6 });
    expect(mix.every((t) => t.features!.energy < 0.5)).toBe(true);
  });

  it("respects genre and decade filters", () => {
    const mixed = [track({ genre: "Rock", year: 1994 }), track({ genre: "Pop", year: 2021 })];
    expect(filterLibrary(mixed, { genres: ["rock"] })).toHaveLength(1);
    expect(filterLibrary(mixed, { decades: [2020] })[0].year).toBe(2021);
  });
});

describe("orderForFlow", () => {
  it("keeps every track exactly once", () => {
    const tracks = Array.from({ length: 7 }, (_, i) => track({ f: { tempo: 90 + i * 10 } }));
    const ordered = orderForFlow(tracks, tracks[3].id);
    expect(ordered[0].id).toBe(tracks[3].id);
    expect(new Set(ordered.map((t) => t.id)).size).toBe(7);
  });
});

describe("mix recipes", async () => {
  const { isMixRecipe, recipeName, runRecipe } = await import("@/lib/music/mixes");
  const lib = Array.from({ length: 12 }, (_, i) => track({ f: { tempo: 100 + i * 5, energy: 0.3 + i * 0.05 } }));

  it("validates stored recipes", () => {
    expect(isMixRecipe({ type: "mood", mood: "workout", count: 10 })).toBe(true);
    expect(isMixRecipe({ type: "mood", mood: "nope", count: 10 })).toBe(false);
    expect(isMixRecipe({ type: "similar", seedIds: ["a"], count: 5 })).toBe(true);
    expect(isMixRecipe(null)).toBe(false);
  });

  it("rebuilds a song-radio mix from its seed", () => {
    const mix = runRecipe({ type: "similar", seedIds: [lib[3].id], count: 6 }, lib);
    expect(mix[0].id).toBe(lib[3].id);
    expect(mix).toHaveLength(6);
    expect(recipeName({ type: "similar", seedIds: [lib[3].id], count: 6 }, lib)).toBe(`More like ${lib[3].title}`);
  });

  it("names mood mixes with their filters", () => {
    expect(recipeName({ type: "mood", mood: "chill", count: 5, decades: [1990] }, lib)).toBe("Chill mix · 1990s");
  });
});
