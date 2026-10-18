import { describe, expect, it } from "vitest";
import { applyFilters, facetOptions, groupByYear, NO_FILTERS, trackYear } from "@/lib/music/facets";
import type { Track } from "@/lib/music/types";

let n = 0;
const t = (over: Partial<Track>): Track =>
  ({ id: `t${n++}`, title: "Song", artist: "Artist", albumArtist: null, genre: null, year: null, releaseDate: null, rating: null, ...over }) as Track;

const lib = [
  t({ artist: "112", genre: "R&B/Soul", year: 1996 }),
  t({ artist: "112", genre: "R&B/Soul", releaseDate: "1998-03-24", year: 1990, rating: 80 }),
  t({ artist: "Nelly", genre: "Hip-Hop/Rap", releaseDate: "2002", rating: 100 }),
  t({ artist: "Tyga", genre: "Hip-Hop/Rap", year: 2011, rating: 60 }),
  t({ artist: "Unknown Year", genre: null }),
];

describe("facets", () => {
  it("prefers the release date over the year tag", () => {
    expect(trackYear(lib[1])).toBe(1998);
    expect(trackYear(lib[4])).toBeNull();
  });

  it("ORs values within a filter and ANDs across filters", () => {
    expect(applyFilters(lib, { ...NO_FILTERS, decades: ["1990s", "2010s"] })).toHaveLength(3);
    expect(applyFilters(lib, { ...NO_FILTERS, decades: ["1990s", "2010s"], genres: ["Hip-Hop/Rap"] }).map((x) => x.artist)).toEqual(["Tyga"]);
    expect(applyFilters(lib, { ...NO_FILTERS, minStars: 4 })).toHaveLength(2);
    expect(applyFilters(lib, NO_FILTERS)).toBe(lib);
  });

  it("counts options under the other filters, newest years first, unknown last", () => {
    expect(facetOptions(lib, NO_FILTERS, "decades")).toEqual([
      { value: "2010s", count: 1 },
      { value: "2000s", count: 1 },
      { value: "1990s", count: 2 },
      { value: "Unknown", count: 1 },
    ]);
    const genres = facetOptions(lib, { ...NO_FILTERS, decades: ["1990s"], genres: ["Hip-Hop/Rap"] }, "genres");
    expect(genres).toEqual([{ value: "R&B/Soul", count: 2 }]); // its own selection doesn't narrow it
  });

  it("groups songs by decade and year", () => {
    const groups = groupByYear(lib);
    expect(groups.map((g) => g.decade)).toEqual([2010, 2000, 1990]);
    expect(groups[2].years.map((y) => y.year)).toEqual([1998, 1996]);
    expect(groups[2].count).toBe(2);
  });
});
