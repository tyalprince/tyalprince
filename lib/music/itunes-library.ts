import { DuplicateIndex } from "@/lib/music/duplicates";
import { fileFingerprint } from "@/lib/music/importer";
import type { Track } from "@/lib/music/types";

// Reads iTunes' "File → Library → Export Library…" XML (an Apple plist) and
// works out which songs aren't in this app yet, and why.

type Plist = string | number | boolean | Date | Plist[] | { [key: string]: Plist } | null;

function convert(el: Element): Plist {
  switch (el.tagName) {
    case "dict": {
      const out: Record<string, Plist> = {};
      const children = [...el.children];
      for (let i = 0; i + 1 < children.length; i += 2) out[children[i].textContent ?? ""] = convert(children[i + 1]);
      return out;
    }
    case "array":
      return [...el.children].map(convert);
    case "string":
      return el.textContent ?? "";
    case "integer":
    case "real":
      return Number(el.textContent);
    case "true":
      return true;
    case "false":
      return false;
    case "date":
      return new Date(el.textContent ?? "");
    default:
      return null; // <data> (artwork blobs etc.) isn't needed
  }
}

export type ItunesTrack = {
  id: string;
  name: string;
  artist: string | null;
  album: string | null;
  kind: string;
  durationSeconds: number | null;
  size: number | null;
  fileName: string | null;
  path: string | null;
  cloudOnly: boolean;
  subscription: boolean;
  protectedFile: boolean;
  purchased: boolean;
  music: boolean;
  /** 0–100; computed (album-derived) ratings are ignored. */
  rating: number | null;
  playCount: number;
  skipCount: number;
  lastPlayedAt: Date | null;
  addedAt: Date | null;
  loved: boolean;
};

export type ItunesPlaylist = { id: string; name: string; trackIds: string[]; smart: boolean };

export type ItunesLibrary = { tracks: ItunesTrack[]; playlists: ItunesPlaylist[] };

const str = (v: Plist | undefined) => (typeof v === "string" && v.trim() ? v : null);

const date = (v: Plist | undefined) => (v instanceof Date && !Number.isNaN(v.getTime()) ? v : null);
const count = (v: Plist | undefined) => (typeof v === "number" && v > 0 ? Math.round(v) : 0);

/** Every track and playlist in an iTunes library export. Throws if the file isn't one. */
export function parseItunesLibrary(xml: string, parser = new DOMParser()): ItunesLibrary {
  const doc = parser.parseFromString(xml, "application/xml");
  const root = doc.querySelector("plist > dict");
  if (!root || doc.querySelector("parsererror")) throw new Error("That doesn't look like an iTunes library export.");
  const lib = convert(root) as Record<string, Plist>;
  const tracks = lib.Tracks;
  if (!tracks || typeof tracks !== "object" || Array.isArray(tracks)) throw new Error("No songs found in that file.");

  const parsed = Object.entries(tracks as Record<string, Plist>).flatMap(([key, raw]) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw) || raw instanceof Date) return [];
    const t = raw as Record<string, Plist>;
    const kind = str(t.Kind) ?? "";
    let path: string | null = null;
    const location = str(t.Location);
    if (location) {
      try {
        path = decodeURIComponent(location.replace(/^file:\/\/(localhost)?\/?/, ""));
      } catch {
        path = location;
      }
    }
    const video = Boolean(t["Has Video"] || t.Movie || t["TV Show"] || t["Music Video"]);
    const spoken = Boolean(t.Podcast || t["iTunesU"] || /audiobook|podcast|book/i.test(kind) || t.Genre === "Audiobooks");
    return [
      {
        id: String(typeof t["Track ID"] === "number" ? t["Track ID"] : key),
        name: str(t.Name) ?? "(untitled)",
        artist: str(t.Artist) ?? str(t["Album Artist"]),
        album: str(t.Album),
        kind,
        durationSeconds: typeof t["Total Time"] === "number" ? t["Total Time"] / 1000 : null,
        size: typeof t.Size === "number" ? t.Size : null,
        fileName: path ? path.split(/[\\/]/).pop() ?? null : null,
        path,
        cloudOnly: !location || t["Track Type"] === "Remote",
        subscription: Boolean(t["Apple Music"]) || /apple music/i.test(kind),
        protectedFile: Boolean(t.Protected) || /protected/i.test(kind),
        purchased: Boolean(t.Purchased) || /purchased/i.test(kind),
        music: !video && !spoken && !t["Playlist Only"],
        rating: typeof t.Rating === "number" && t.Rating > 0 && !t["Rating Computed"] ? Math.min(100, Math.round(t.Rating / 20) * 20) : null,
        playCount: count(t["Play Count"]),
        skipCount: count(t["Skip Count"]),
        lastPlayedAt: date(t["Play Date UTC"]),
        addedAt: date(t["Date Added"]),
        loved: Boolean(t.Loved || t.Favorited),
      },
    ];
  });

  const playlists: ItunesPlaylist[] = [];
  for (const raw of Array.isArray(lib.Playlists) ? lib.Playlists : []) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw) || raw instanceof Date) continue;
    const p = raw as Record<string, Plist>;
    // Skip the whole-library list, built-in lists (Music, Podcasts, Purchased…), folders and hidden ones.
    if (p.Master || p["Distinguished Kind"] !== undefined || p.Folder || p.Visible === false || p.Music) continue;
    const items = Array.isArray(p["Playlist Items"]) ? p["Playlist Items"] : [];
    const trackIds = items.flatMap((i) => {
      const id = i && typeof i === "object" && !Array.isArray(i) && !(i instanceof Date) ? (i as Record<string, Plist>)["Track ID"] : null;
      return typeof id === "number" ? [String(id)] : [];
    });
    const name = str(p.Name);
    if (!name || !trackIds.length) continue;
    playlists.push({ id: str(p["Playlist Persistent ID"]) ?? name, name, trackIds, smart: p["Smart Info"] !== undefined });
  }
  return { tracks: parsed, playlists };
}

/**
 * Which library track each iTunes track is: the same file (name + size), or
 * failing that the same song (title, artist, length within a few seconds).
 */
export function matchToLibrary(itunes: ItunesTrack[], library: Track[]): Map<string, string> {
  const byFile = new Map(library.map((t) => [fileFingerprint(t.fileName, t.fileSize), t.id]));
  const songs = new DuplicateIndex(library);
  const matches = new Map<string, string>();
  for (const t of itunes) {
    if (!t.music) continue;
    const id = (t.fileName && t.size !== null ? byFile.get(fileFingerprint(t.fileName, t.size)) : undefined) ?? songs.findId(t.name, t.artist, t.durationSeconds);
    if (id) matches.set(t.id, id);
  }
  return matches;
}

export type TrackStats = {
  id: string;
  rating: number | null;
  playCount: number;
  skipCount: number;
  lastPlayedAt: string | null;
  addedAt: string | null;
  loved: boolean;
};

/**
 * Ratings and play history per library track. Several iTunes entries can be
 * one song here (an MP3 plus its Apple Music copy): plays add up, and the
 * highest rating, latest play and earliest date added win.
 */
export function statsForLibrary(itunes: ItunesTrack[], matches: Map<string, string>): TrackStats[] {
  const out = new Map<string, TrackStats>();
  const iso = (d: Date | null) => d?.toISOString() ?? null;
  for (const t of itunes) {
    const id = matches.get(t.id);
    if (!id) continue;
    const prev = out.get(id);
    if (!prev) {
      out.set(id, { id, rating: t.rating, playCount: t.playCount, skipCount: t.skipCount, lastPlayedAt: iso(t.lastPlayedAt), addedAt: iso(t.addedAt), loved: t.loved });
      continue;
    }
    prev.rating = Math.max(prev.rating ?? 0, t.rating ?? 0) || null;
    prev.playCount += t.playCount;
    prev.skipCount += t.skipCount;
    const last = iso(t.lastPlayedAt);
    if (last && (!prev.lastPlayedAt || last > prev.lastPlayedAt)) prev.lastPlayedAt = last;
    const added = iso(t.addedAt);
    if (added && (!prev.addedAt || added < prev.addedAt)) prev.addedAt = added;
    prev.loved ||= t.loved;
  }
  return [...out.values()].filter((s) => s.rating || s.playCount || s.skipCount || s.lastPlayedAt || s.addedAt || s.loved);
}

/** iTunes playlists as library track ids (songs not in this app are left out, repeats removed). */
export function playlistsForLibrary(playlists: ItunesPlaylist[], matches: Map<string, string>) {
  return playlists
    .map((p) => ({ ...p, trackIds: [...new Set(p.trackIds.flatMap((id) => matches.get(id) ?? []))], total: p.trackIds.length }))
    .filter((p) => p.trackIds.length);
}

export type MissingReason = "subscription" | "protected" | "cloud" | "notImported";

export type MissingReport = {
  total: number;
  inLibrary: number;
  skippedNonMusic: number;
  missing: Record<MissingReason, ItunesTrack[]>;
};

/**
 * Sorts each iTunes song into "already in the app" or a reason it's missing.
 * A song counts as present when the same file (name + size) was imported or a
 * likely duplicate (same title, artist and length) is in the library.
 */
export function buildMissingReport(itunes: ItunesTrack[], library: Track[], matches = matchToLibrary(itunes, library)): MissingReport {
  const missing: MissingReport["missing"] = { subscription: [], protected: [], cloud: [], notImported: [] };
  let inLibrary = 0;
  let skippedNonMusic = 0;
  for (const t of itunes) {
    if (!t.music) {
      skippedNonMusic += 1;
      continue;
    }
    if (matches.has(t.id)) {
      inLibrary += 1;
      continue;
    }
    if (t.subscription) missing.subscription.push(t);
    else if (t.protectedFile) missing.protected.push(t);
    else if (t.cloudOnly) missing.cloud.push(t);
    else missing.notImported.push(t);
  }
  return { total: itunes.length - skippedNonMusic, inLibrary, skippedNonMusic, missing };
}

/** The missing songs as a spreadsheet-friendly CSV. */
export function missingCsv(report: MissingReport): string {
  const label: Record<MissingReason, string> = {
    subscription: "Apple Music subscription (locked)",
    protected: "Old protected purchase (re-download)",
    cloud: "In iCloud, not downloaded",
    notImported: "On this PC, not imported",
  };
  const cell = (v: string | null) => `"${(v ?? "").replace(/"/g, '""')}"`;
  const rows = ["Reason,Title,Artist,Album,Kind,Location"];
  for (const reason of Object.keys(label) as MissingReason[]) {
    for (const t of report.missing[reason]) rows.push([label[reason], t.name, t.artist, t.album, t.kind, t.path].map(cell).join(","));
  }
  return rows.join("\r\n");
}
