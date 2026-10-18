// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { buildMissingReport, missingCsv, parseItunesLibrary } from "@/lib/music/itunes-library";
import type { Track } from "@/lib/music/types";

const track = (fields: string) => `<dict>${fields}</dict>`;
const s = (k: string, v: string) => `<key>${k}</key><string>${v}</string>`;
const n = (k: string, v: number) => `<key>${k}</key><integer>${v}</integer>`;
const yes = (k: string) => `<key>${k}</key><true/>`;

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Major Version</key><integer>1</integer>
<key>Tracks</key><dict>
<key>1</key>${track(s("Name", "Cupid") + s("Artist", "112") + s("Kind", "MPEG audio file") + n("Total Time", 247000) + n("Size", 5000) + s("Location", "file://localhost/C:/Music/112/Cupid.mp3") + s("Track Type", "File"))}
<key>2</key>${track(s("Name", "Anywhere") + s("Artist", "112") + s("Kind", "MPEG audio file") + n("Total Time", 250000) + n("Size", 6000) + s("Location", "file://localhost/C:/Music/112/Any%20where.mp3") + s("Track Type", "File"))}
<key>3</key>${track(s("Name", "Bye Bye Bye") + s("Artist", "*NSYNC") + s("Kind", "Apple Music AAC audio file") + yes("Apple Music") + n("Total Time", 200000) + s("Track Type", "Remote"))}
<key>4</key>${track(s("Name", "Old Song") + s("Artist", "Someone") + s("Kind", "Protected AAC audio file") + yes("Protected") + s("Location", "file://localhost/C:/Music/old.m4p") + s("Track Type", "File"))}
<key>5</key>${track(s("Name", "Cloud Song") + s("Artist", "Someone") + s("Kind", "Purchased AAC audio file") + yes("Purchased") + s("Track Type", "Remote"))}
<key>6</key>${track(s("Name", "A Video") + s("Kind", "MPEG-4 video file") + yes("Has Video"))}
<key>7</key>${track(s("Name", "Cupid (Remastered)") + s("Artist", "112") + s("Kind", "Apple Music AAC audio file") + yes("Apple Music") + n("Total Time", 248000))}
</dict>
<key>Playlists</key><array><dict><key>Name</key><string>Library</string><key>Artwork</key><data>AAAA</data></dict></array>
</dict></plist>`;

describe("iTunes library export", () => {
  const tracks = parseItunesLibrary(xml);

  it("reads every track with its kind and location", () => {
    expect(tracks).toHaveLength(7);
    expect(tracks[1]).toMatchObject({ name: "Anywhere", fileName: "Any where.mp3", path: "C:/Music/112/Any where.mp3", durationSeconds: 250 });
    expect(tracks[2]).toMatchObject({ subscription: true, cloudOnly: true });
    expect(tracks[5].music).toBe(false);
  });

  it("sorts missing songs by reason, counting matches by file or by song", () => {
    const library = [
      { id: "a", title: "Cupid", artist: "112", albumArtist: null, durationSeconds: "246", fileName: "x.mp3", fileSize: 1 },
    ] as unknown as Track[];
    const report = buildMissingReport(tracks, library);
    expect(report.total).toBe(6);
    expect(report.inLibrary).toBe(2); // Cupid, and its remastered Apple Music copy
    expect(report.missing.notImported.map((t) => t.name)).toEqual(["Anywhere"]);
    expect(report.missing.subscription.map((t) => t.name)).toEqual(["Bye Bye Bye"]);
    expect(report.missing.protected.map((t) => t.name)).toEqual(["Old Song"]);
    expect(report.missing.cloud.map((t) => t.name)).toEqual(["Cloud Song"]);
    expect(missingCsv(report).split("\r\n")).toHaveLength(5);
  });

  it("rejects files that aren't a library export", () => {
    expect(() => parseItunesLibrary("<html></html>")).toThrow();
  });
});
