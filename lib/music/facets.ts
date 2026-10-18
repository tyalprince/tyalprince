import type { Track } from "@/lib/music/types";

// Filters for the song list (multi-select years, decades, genres, artists,
// minimum rating) and the year/decade grouping behind the Years tab.

/** Release year: the looked-up release date first, then the file's year tag. */
export function trackYear(t: Pick<Track, "releaseDate" | "year">): number | null {
  const y = t.releaseDate ? Number(t.releaseDate.slice(0, 4)) : t.year;
  return y && y >= 1000 && y <= 3000 ? y : null;
}

export function decadeOf(year: number): number {
  return Math.floor(year / 10) * 10;
}

/** "1990s"; songs from 2000–2009 read as "2000s". */
export function decadeLabel(decade: number): string {
  return `${decade}s`;
}

const artistOf = (t: Track) => t.albumArtist || t.artist || "Unknown artist";
const genreOf = (t: Track) => t.genre?.trim() || null;

export type SongFilters = {
  years: string[];
  decades: string[];
  genres: string[];
  artists: string[];
  /** Minimum stars, 0 = any. */
  minStars: number;
};

export const NO_FILTERS: SongFilters = { years: [], decades: [], genres: [], artists: [], minStars: 0 };

export function activeFilterCount(f: SongFilters): number {
  return f.years.length + f.decades.length + f.genres.length + f.artists.length + (f.minStars ? 1 : 0);
}

const UNKNOWN = "Unknown";

type FacetKey = "years" | "decades" | "genres" | "artists";

function valueOf(t: Track, key: FacetKey): string {
  switch (key) {
    case "years": {
      const y = trackYear(t);
      return y ? String(y) : UNKNOWN;
    }
    case "decades": {
      const y = trackYear(t);
      return y ? decadeLabel(decadeOf(y)) : UNKNOWN;
    }
    case "genres":
      return genreOf(t) ?? UNKNOWN;
    case "artists":
      return artistOf(t);
  }
}

function matches(t: Track, f: SongFilters, skip?: FacetKey): boolean {
  for (const key of ["years", "decades", "genres", "artists"] as const) {
    if (key === skip || !f[key].length) continue;
    if (!f[key].includes(valueOf(t, key))) return false;
  }
  return !f.minStars || (t.rating ?? 0) >= f.minStars * 20;
}

/** Songs matching every active filter (any of the values within one filter). */
export function applyFilters(tracks: Track[], f: SongFilters): Track[] {
  return activeFilterCount(f) ? tracks.filter((t) => matches(t, f)) : tracks;
}

export type FacetOption = { value: string; count: number };

/**
 * Options for one filter with song counts, given the *other* active filters
 * (so picking a decade narrows the genres list, but not the decades list).
 */
export function facetOptions(tracks: Track[], f: SongFilters, key: FacetKey): FacetOption[] {
  const counts = new Map<string, number>();
  for (const t of tracks) {
    if (!matches(t, f, key)) continue;
    const v = valueOf(t, key);
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  const options = [...counts.entries()].map(([value, count]) => ({ value, count }));
  const unknownLast = (a: FacetOption, b: FacetOption) => Number(a.value === UNKNOWN) - Number(b.value === UNKNOWN);
  if (key === "years" || key === "decades") return options.sort((a, b) => unknownLast(a, b) || b.value.localeCompare(a.value));
  if (key === "genres") return options.sort((a, b) => unknownLast(a, b) || b.count - a.count || a.value.localeCompare(b.value));
  return options.sort((a, b) => a.value.localeCompare(b.value));
}

export type YearGroup = { year: number; tracks: Track[] };
export type DecadeGroup = { decade: number; years: YearGroup[]; count: number };

/** Songs grouped by decade → year, newest first; songs without a year are left out. */
export function groupByYear(tracks: Track[]): DecadeGroup[] {
  const years = new Map<number, Track[]>();
  for (const t of tracks) {
    const y = trackYear(t);
    if (y) years.set(y, [...(years.get(y) ?? []), t]);
  }
  const decades = new Map<number, DecadeGroup>();
  for (const [year, list] of [...years.entries()].sort((a, b) => b[0] - a[0])) {
    const decade = decadeOf(year);
    const group = decades.get(decade) ?? { decade, years: [], count: 0 };
    group.years.push({ year, tracks: list });
    group.count += list.length;
    decades.set(decade, group);
  }
  return [...decades.values()];
}
