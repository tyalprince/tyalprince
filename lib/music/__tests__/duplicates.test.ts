import { describe, expect, it } from "vitest";
import { DuplicateIndex, duplicateKey, findDuplicateGroups } from "@/lib/music/duplicates";
import type { Track } from "@/lib/music/types";

let n = 0;
const track = (over: Partial<Track>): Track =>
  ({
    id: `t${n++}`,
    title: "Song",
    fileName: "song.mp3",
    artist: "Artist",
    albumArtist: null,
    album: null,
    durationSeconds: "200",
    bitrate: 128000,
    mimeType: "audio/mpeg",
    artworkKey: null,
    liked: false,
    playCount: 0,
    ...over,
  }) as Track;

describe("duplicateKey", () => {
  it("ignores case, punctuation, remaster/explicit tags and featured artists", () => {
    const k = duplicateKey("Tearin' Up My Heart", "*NSYNC");
    expect(duplicateKey("Tearin Up My Heart (Remastered 2011)", "NSYNC")).toBe(k);
    expect(duplicateKey("TEARIN' UP MY HEART [Explicit]", "*NSYNC feat. Someone")).toBe(k);
    expect(duplicateKey("Tearin' Up My Heart - 2011 Remaster", "*NSYNC")).toBe(k);
  });

  it("keeps live, remix and acoustic versions distinct", () => {
    const k = duplicateKey("Cupid", "112");
    expect(duplicateKey("Cupid (Live)", "112")).not.toBe(k);
    expect(duplicateKey("Cupid (Remix)", "112")).not.toBe(k);
    expect(duplicateKey("Cupid - Acoustic", "112")).not.toBe(k);
  });

  it("treats 'The' and '&' consistently", () => {
    expect(duplicateKey("Rock & Roll", "The Band")).toBe(duplicateKey("Rock and Roll", "Band"));
  });
});

describe("DuplicateIndex", () => {
  it("matches the same song with a similar length, even with a different album or file name", () => {
    const index = new DuplicateIndex([track({ title: "Cupid", artist: "112", album: "112", durationSeconds: "247.3" })]);
    expect(index.find("Cupid", "112", 248.9)).toBe("Cupid — 112");
    expect(index.find("Cupid", "112", 290)).toBeNull(); // different take
    expect(index.find("Cupid", "Someone Else", 247)).toBeNull();
  });

  it("catches a second copy within the same import, and releases a failed claim", () => {
    const index = new DuplicateIndex();
    index.add("Anywhere", "112", 250);
    expect(index.find("Anywhere", "112", 251)).not.toBeNull();
    index.remove("Anywhere", "112", 250);
    expect(index.find("Anywhere", "112", 251)).toBeNull();
  });
});

describe("findDuplicateGroups", () => {
  it("keeps the best copy and lists the rest", () => {
    const low = track({ title: "Love Me", artist: "112", bitrate: 128000 });
    const high = track({ title: "Love Me (Remastered)", artist: "112", bitrate: 320000, durationSeconds: "201" });
    const live = track({ title: "Love Me", artist: "112", durationSeconds: "260" });
    const other = track({ title: "Peaches & Cream", artist: "112" });
    const groups = findDuplicateGroups([low, high, live, other]);
    expect(groups).toHaveLength(1);
    expect(groups[0].keep.id).toBe(high.id);
    expect(groups[0].extras.map((t) => t.id)).toEqual([low.id]);
  });

  it("prefers lossless, artwork and liked copies", () => {
    const mp3 = track({ bitrate: 320000, liked: true });
    const flac = track({ mimeType: "audio/flac", bitrate: 900000 });
    expect(findDuplicateGroups([mp3, flac])[0].keep.id).toBe(flac.id);
  });
});
