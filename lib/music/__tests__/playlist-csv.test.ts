import { describe, expect, it } from "vitest";
import { matchPlaylists, parseCsv, parsePlaylistCsv, splitEntry, yearsFromPlaylists } from "@/lib/music/playlist-csv";
import type { Track } from "@/lib/music/types";

const csv = [
  '﻿Decades [6 songs],90\'s Slow Jams  [3 songs],1997 [2 songs],1998 [1 songs],Playlist 5 [3 songs]',
  'Cupid - 112,Cupid - 112,Cupid - 112,Cupid - 112,Cupid - 112',
  '"Sorry, Blame It On Me  - Akon",Ride Wit Me - Nelly & City Spud,Not In Library - Nobody,,x - y',
  ',Missing Song - Someone,,,',
].join("\r\n");

let n = 0;
const t = (title: string, artist: string, over: Partial<Track> = {}) =>
  ({ id: `t${n++}`, title, artist, albumArtist: null, playCount: 0, bitrate: 128000, ...over }) as Track;

describe("playlist CSV import", () => {
  it("parses quoted cells and splits Title - Artist at the last dash", () => {
    expect(parseCsv('a,"b, c","say ""hi"""\n1,2,3')).toEqual([["a", "b, c", 'say "hi"'], ["1", "2", "3"]]);
    expect(splitEntry("Name (Live) - The Goo Goo Dolls")).toEqual({ title: "Name (Live)", artist: "The Goo Goo Dolls" });
    expect(splitEntry("Tick - Tock - Someone")).toEqual({ title: "Tick - Tock", artist: "Someone" });
    expect(splitEntry("  ")).toBeNull();
  });

  it("reads playlist names, counts, year playlists and folders", () => {
    const lists = parsePlaylistCsv(csv);
    expect(lists.map((p) => [p.name, p.expected, p.entries.length, p.year, p.suggestSkip])).toEqual([
      ["Decades", 6, 2, null, true],
      ["90's Slow Jams", 3, 3, null, false],
      ["1997", 2, 2, 1997, false],
      ["1998", 1, 1, 1998, false],
      ["Playlist 5", 3, 2, null, true],
    ]);
  });

  it("matches songs by title and main artist, and takes the earliest year", () => {
    const cupid = t("Cupid", "112", { playCount: 9 });
    const cupidCopy = t("Cupid", "112");
    const nelly = t("Ride Wit Me", "Nelly");
    const matched = matchPlaylists(parsePlaylistCsv(csv), [cupid, cupidCopy, nelly]);
    const slow = matched.find((p) => p.name === "90's Slow Jams")!;
    expect(slow.trackIds).toEqual([cupid.id, nelly.id]);
    expect(slow.missing).toEqual([{ title: "Missing Song", artist: "Someone" }]);
    expect(yearsFromPlaylists(matched).get(cupid.id)).toBe(1997);
  });

  it("rejects files without playlists", () => {
    expect(() => parsePlaylistCsv("just one line")).toThrow();
  });
});
