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
};

const str = (v: Plist | undefined) => (typeof v === "string" && v.trim() ? v : null);

/** Every track in an iTunes library export. Throws if the file isn't one. */
export function parseItunesLibrary(xml: string, parser = new DOMParser()): ItunesTrack[] {
  const doc = parser.parseFromString(xml, "application/xml");
  const root = doc.querySelector("plist > dict");
  if (!root || doc.querySelector("parsererror")) throw new Error("That doesn't look like an iTunes library export.");
  const lib = convert(root) as Record<string, Plist>;
  const tracks = lib.Tracks;
  if (!tracks || typeof tracks !== "object" || Array.isArray(tracks)) throw new Error("No songs found in that file.");

  return Object.values(tracks as Record<string, Plist>).flatMap((raw) => {
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
      },
    ];
  });
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
export function buildMissingReport(itunes: ItunesTrack[], library: Track[]): MissingReport {
  const files = new Set(library.map((t) => fileFingerprint(t.fileName, t.fileSize)));
  const songs = new DuplicateIndex(library);
  const missing: MissingReport["missing"] = { subscription: [], protected: [], cloud: [], notImported: [] };
  let inLibrary = 0;
  let skippedNonMusic = 0;
  for (const t of itunes) {
    if (!t.music) {
      skippedNonMusic += 1;
      continue;
    }
    const sameFile = t.fileName && t.size !== null && files.has(fileFingerprint(t.fileName, t.size));
    if (sameFile || songs.find(t.name, t.artist, t.durationSeconds)) {
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
