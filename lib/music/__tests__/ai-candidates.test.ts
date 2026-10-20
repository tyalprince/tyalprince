import { describe, expect, it } from "vitest";
import { candidateLines, librarySummary, parseIntent, parseJson, resolvePicks, shortlist } from "@/lib/music/ai-candidates";
import type { Track } from "@/lib/music/types";

let n = 0;
const t = (over: Partial<Track> & { energy?: number; tempo?: number }): Track => {
  const { energy, tempo, ...rest } = over;
  return {
    id: `t${n++}`,
    title: "Song",
    artist: "Artist",
    albumArtist: null,
    album: null,
    genre: null,
    year: null,
    releaseDate: null,
    liked: false,
    rating: null,
    playCount: 0,
    features: energy !== undefined || tempo !== undefined ? ({ energy: energy ?? 0.5, tempo: tempo ?? 100 } as Track["features"]) : null,
    ...rest,
  } as Track;
};

const library = [
  t({ title: "Cupid", artist: "112", genre: "R&B/Soul", year: 1996, energy: 0.2, tempo: 70 }),
  t({ title: "Anywhere", artist: "112", genre: "R&B/Soul", year: 1999, energy: 0.3, tempo: 88, liked: true }),
  t({ title: "Crossover", artist: "EPMD", genre: "Hip-Hop/Rap", year: 1992, energy: 0.8, tempo: 96 }),
  t({ title: "Rack City", artist: "Tyga", genre: "Hip-Hop/Rap", year: 2011, energy: 0.9, tempo: 98 }),
  t({ title: "Every Breath You Take", artist: "The Police", genre: "Rock", year: 1983, energy: 0.4, tempo: 117 }),
  t({ title: "November Rain", artist: "Guns N' Roses", genre: "Rock", year: 1991, energy: 0.5, tempo: 80 }),
];
const none = () => 0;

describe("AI mix shortlist", () => {
  it("parses loose model output into safe criteria", () => {
    const intent = parseIntent({ genres: ["R&B"], yearFrom: 1990, yearTo: "nope", energy: "extreme", songs: [{ title: "Cupid" }], extra: 1 });
    expect(intent).toMatchObject({ genres: ["R&B"], yearFrom: 1990, yearTo: null, energy: null, songs: [{ title: "Cupid", artist: null }], likedOnly: false });
    expect(parseIntent(null).genres).toEqual([]);
  });

  it("keeps songs that fit the era and genre, best matches first", () => {
    const picks = shortlist(library, parseIntent({ genres: ["R&B"], yearFrom: 1990, yearTo: 1999, energy: "low" }), 10, none);
    expect(picks.map((c) => c.track.title)).toEqual(["Anywhere", "Cupid"]);
  });

  it("boosts songs the model named and honours exclusions", () => {
    const picks = shortlist(
      library,
      parseIntent({ genres: ["Hip-Hop"], songs: [{ title: "Rack City", artist: "Tyga" }], excludeArtists: ["EPMD"] }),
      10,
      none,
    );
    expect(picks.map((c) => c.track.title)).toEqual(["Rack City"]);
  });

  it("matches tempo in half or double time and keywords in titles", () => {
    expect(shortlist(library, parseIntent({ tempoMin: 140, tempoMax: 180 }), 10, none).map((c) => c.track.title)).toContain("Cupid");
    expect(shortlist(library, parseIntent({ keywords: ["rain"] }), 10, none).map((c) => c.track.title)).toEqual(["November Rain"]);
  });

  it("with no criteria, offers the whole library", () => {
    expect(shortlist(library, parseIntent({}), 10, none)).toHaveLength(library.length);
  });

  it("formats candidates and maps picks back safely", () => {
    const candidates = shortlist(library, parseIntent({}), 10, none);
    const lines = candidateLines(candidates).split("\n");
    expect(lines[0]).toMatch(/^1\. .+ — .+\(\d{4}\)/);
    expect(resolvePicks([2, "1", 2, 99, 0, "x"], candidates, 5).map((tr) => tr.id)).toEqual([candidates[1].track.id, candidates[0].track.id]);
    expect(resolvePicks("nope", candidates, 5)).toEqual([]);
    expect(librarySummary(library)).toContain("released 1983–2011");
  });

  it("reads JSON wrapped in prose or code fences", () => {
    expect(parseJson('Sure!\n```json\n{"name":"Rainy","picks":[1,2]}\n```')).toEqual({ name: "Rainy", picks: [1, 2] });
    expect(parseJson("no json here")).toBeNull();
  });
});
