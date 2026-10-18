import { describe, expect, it } from "vitest";
import { albumKeyOf, applyLookup, nextArtworkCandidate } from "@/lib/music/album-art";
import type { Track } from "@/lib/music/types";
import {
  activeLyricIndex,
  creditsFrom,
  isAllowedArtworkHost,
  itunesArtworkUrl,
  normalizeArtist,
  normalizeTitle,
  parseLrc,
  parseReleaseDate,
  pickItunesMatch,
  pickLrclib,
  pickMbRecording,
  workIdsFrom,
  type ItunesSong,
} from "@/lib/music/metadata-sources";

const q = { title: "God Must Have Spent A Little More Time On You", artist: "*NSYNC", album: "*NSYNC", durationSeconds: 243 };

describe("normalisation", () => {
  it("ignores case, punctuation, feat. credits and edition tags", () => {
    expect(normalizeTitle("Bye Bye Bye (Remastered 2019)")).toBe("bye bye bye");
    expect(normalizeTitle("Señorita - Radio Edit")).toBe("senorita");
    expect(normalizeTitle("Dilemma (feat. Kelly Rowland)")).toBe("dilemma");
    expect(normalizeArtist("*NSYNC")).toBe(normalizeArtist("NSYNC"));
    expect(normalizeArtist("The Weeknd")).toBe(normalizeArtist("Weeknd"));
    expect(normalizeArtist("Nelly feat. Kelly Rowland")).toBe("nelly");
  });
});

describe("pickItunesMatch", () => {
  const results: ItunesSong[] = [
    { kind: "song", trackName: "God Must Have Spent a Little More Time On You (Live)", artistName: "Some Cover Band", trackTimeMillis: 250000 },
    { kind: "song", trackName: "God Must Have Spent a Little More Time On You", artistName: "NSYNC", collectionName: "*NSYNC", trackTimeMillis: 242000, artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/Music/x/100x100bb.jpg", releaseDate: "1998-03-24T08:00:00Z" },
    { kind: "music-video", trackName: "God Must Have Spent a Little More Time On You", artistName: "NSYNC" },
  ];

  it("requires the artist to agree and prefers the right album", () => {
    const m = pickItunesMatch(results, q)!;
    expect(m.artistName).toBe("NSYNC");
    expect(parseReleaseDate(m.releaseDate)).toBe("1998-03-24");
  });

  it("returns null rather than guessing when nothing agrees", () => {
    expect(pickItunesMatch(results, { ...q, artist: "Backstreet Boys" })).toBeNull();
    expect(pickItunesMatch(results, { ...q, title: "Tearin' Up My Heart" })).toBeNull();
  });
});

describe("artwork", () => {
  it("upsizes iTunes thumbnails and only allows Apple's CDN", () => {
    expect(itunesArtworkUrl("https://is1-ssl.mzstatic.com/image/thumb/Music/a/b/100x100bb.jpg")).toBe(
      "https://is1-ssl.mzstatic.com/image/thumb/Music/a/b/600x600bb.jpg",
    );
    expect(isAllowedArtworkHost("https://is1-ssl.mzstatic.com/x.jpg")).toBe(true);
    expect(isAllowedArtworkHost("http://is1-ssl.mzstatic.com/x.jpg")).toBe(false);
    expect(isAllowedArtworkHost("https://evil.example.com/mzstatic.com.jpg")).toBe(false);
    expect(isAllowedArtworkHost("https://169.254.169.254/latest")).toBe(false);
  });
});

describe("release dates", () => {
  it("accepts full dates and bare years", () => {
    expect(parseReleaseDate("1998")).toBe("1998");
    expect(parseReleaseDate("2001-07-24")).toBe("2001-07-24");
    expect(parseReleaseDate("nonsense")).toBeNull();
    expect(parseReleaseDate(undefined)).toBeNull();
  });
});

describe("MusicBrainz", () => {
  it("picks a recording whose title and artist agree", () => {
    const recs = [
      { id: "a", score: 100, title: "God Must Have Spent a Little More Time on You", "artist-credit": [{ name: "Alabama" }] },
      { id: "b", score: 98, title: "God Must Have Spent a Little More Time on You", "artist-credit": [{ name: "*NSYNC" }] },
    ];
    expect(pickMbRecording(recs, q)?.id).toBe("b");
  });

  it("collects producers from the recording and writers from its works", () => {
    const recRels = [
      { type: "producer", "target-type": "artist", artist: { name: "Veit Renn" } },
      { type: "performance", "target-type": "work", work: { id: "w1", title: "God Must Have…" } },
      { type: "performance", "target-type": "work", work: { id: "w1" } },
    ];
    expect(workIdsFrom(recRels)).toEqual(["w1"]);
    const credits = creditsFrom(recRels, [[
      { type: "composer", artist: { name: "Carl Sturken" } },
      { type: "lyricist", artist: { name: "Evan Rogers" } },
      { type: "writer", artist: { name: "Evan Rogers" } },
    ]]);
    expect(credits).toEqual({ composer: ["Carl Sturken", "Evan Rogers"], lyricist: ["Evan Rogers"], producer: ["Veit Renn"] });
  });
});

describe("lyrics", () => {
  it("parses LRC, including multiple stamps per line", () => {
    const lines = parseLrc("[ar:Someone]\n[00:12.50] first line\n[00:20.00][01:05.25] chorus\n[00:30.1] third");
    expect(lines.map((l) => [l.time, l.text])).toEqual([
      [12.5, "first line"],
      [20, "chorus"],
      [30.1, "third"],
      [65.25, "chorus"],
    ]);
    expect(activeLyricIndex(lines, 5)).toBe(-1);
    expect(activeLyricIndex(lines, 21)).toBe(1);
    expect(activeLyricIndex(lines, 999)).toBe(3);
  });

  it("prefers a synced LRCLIB result for the right song", () => {
    const pick = pickLrclib(
      [
        { trackName: "God Must Have Spent A Little More Time On You", artistName: "NSYNC", duration: 243, plainLyrics: "plain" },
        { trackName: "God Must Have Spent A Little More Time On You", artistName: "NSYNC", duration: 242, plainLyrics: "plain", syncedLyrics: "[00:01.00] x" },
        { trackName: "God Must Have Spent A Little More Time On You", artistName: "NSYNC", duration: 300, syncedLyrics: "[00:01.00] y" },
      ],
      q,
    );
    expect(pick?.syncedLyrics).toBe("[00:01.00] x");
  });
});

describe("album art sharing", () => {
  const base = {
    id: "a",
    title: "Song",
    artist: "*NSYNC",
    albumArtist: null,
    album: "*NSYNC",
    artworkKey: null,
    releaseDate: null,
    enrichedAt: null,
    external: null,
  } as unknown as Track;
  const t = (over: Partial<Track>) => ({ ...base, ...over }) as Track;

  it("gives a found cover and date to album-mates only", () => {
    const list = [t({ id: "a" }), t({ id: "b" }), t({ id: "c", album: "Other" }), t({ id: "d", artist: "112" })];
    const out = applyLookup(list, t({ id: "a", artworkKey: "art.jpg", releaseDate: "1997-05-26" }));
    expect(out.map((x) => x.artworkKey)).toEqual(["art.jpg", "art.jpg", null, null]);
    expect(out[1].releaseDate).toBe("1997-05-26");
    expect(out[2]).toBe(list[2]);
  });

  it("returns the same array when nothing changes", () => {
    const list = [t({ id: "x", album: "Elsewhere" })];
    expect(applyLookup(list, t({ id: "a", artworkKey: "art.jpg" }))).toBe(list);
  });

  it("picks one song per album that still needs art", () => {
    const list = [t({ id: "a", artworkKey: "k" }), t({ id: "b" }), t({ id: "c" }), t({ id: "d", album: "Two" })];
    const tried = new Set<string>();
    const first = nextArtworkCandidate(list, tried)!;
    expect(first.id).toBe("b");
    tried.add(albumKeyOf(first));
    expect(nextArtworkCandidate(list, tried)!.id).toBe("d");
    tried.add(albumKeyOf(list[3]));
    expect(nextArtworkCandidate(list, tried)).toBeNull();
  });
});
