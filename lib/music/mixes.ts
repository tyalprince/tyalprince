import { MOODS, moodMix, similarTo, type MoodKey, type SimTrack } from "@/lib/music/similarity";

// A generated playlist stores its recipe so "Refresh" can rebuild it against
// the current library (new imports, changed likes) with the same intent.

export type MixRecipe =
  | { type: "similar"; seedIds: string[]; count: number }
  | { type: "mood"; mood: MoodKey; count: number; genres?: string[]; decades?: number[] };

export function isMixRecipe(value: unknown): value is MixRecipe {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  if (r.type === "similar") return Array.isArray(r.seedIds) && typeof r.count === "number";
  if (r.type === "mood") return typeof r.mood === "string" && r.mood in MOODS && typeof r.count === "number";
  return false;
}

export function runRecipe<T extends SimTrack>(recipe: MixRecipe, library: T[], variety = 0): T[] {
  if (recipe.type === "similar") {
    const byId = new Map(library.map((t) => [t.id, t]));
    const seeds = recipe.seedIds.map((id) => byId.get(id)).filter((t): t is T => Boolean(t));
    return similarTo(seeds, library, recipe.count, variety);
  }
  return moodMix(recipe.mood, library, {
    count: recipe.count,
    genres: recipe.genres,
    decades: recipe.decades,
    likedBoost: true,
    variety,
  });
}

export function recipeName<T extends SimTrack>(recipe: MixRecipe, library: T[]): string {
  if (recipe.type === "mood") {
    const filters = [...(recipe.genres ?? []), ...(recipe.decades ?? []).map((d) => `${d}s`)];
    return `${MOODS[recipe.mood].label} mix${filters.length ? ` · ${filters.join(", ")}` : ""}`;
  }
  const first = library.find((t) => t.id === recipe.seedIds[0]);
  return first ? `More like ${first.title}` : "Song radio";
}
