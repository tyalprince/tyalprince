import type { Track } from "@/lib/music/types";

// "Same song, different file": the same title and artist with (nearly) the
// same length, even if the file name, album or other tags differ. Different
// recordings — live, remix, acoustic, edit — keep their distinct titles and
// usually lengths, so they are not treated as duplicates.

/** Seconds two copies of one recording may differ by (encoders pad/trim silence). */
export const DUPLICATE_DURATION_TOLERANCE = 3;

function base(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Title without packaging noise ("Remastered 2011", "Explicit", "feat. X") — but keeps "Live", "Remix", "Acoustic". */
export function duplicateTitle(title: string | null | undefined): string {
  return base(title)
    .replace(/\s*[([][^)\]]*\b(remaster(ed)?|explicit|clean|album version|single version|lp version|bonus( track)?|deluxe|mono|stereo|feat|ft\.|featuring|with)\b[^)\]]*[)\]]/g, "")
    .replace(/\s+-\s+(\d{4}\s+)?remaster(ed)?(\s+\d{4})?(\s+version)?$/g, "")
    .replace(/\s+(feat|ft|featuring)\.?\s.*$/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");
}

/** Main artist only: "A feat. B", "A & B", "A, B" → "a"; a leading "The" is ignored. */
export function duplicateArtist(artist: string | null | undefined): string {
  return base((artist ?? "").split(/\s*(?:,|;|\/| x | & | feat\.?| ft\.?| featuring | with )\s*/i)[0])
    .replace(/^the\s+/, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");
}

export function duplicateKey(title: string | null | undefined, artist: string | null | undefined): string | null {
  const t = duplicateTitle(title);
  const a = duplicateArtist(artist);
  return t && a ? `${a}|${t}` : null;
}

function closeLength(a: number | null, b: number | null): boolean {
  return a !== null && b !== null && Math.abs(a - b) <= DUPLICATE_DURATION_TOLERANCE;
}

const seconds = (t: Pick<Track, "durationSeconds">) => (t.durationSeconds === null ? null : Number(t.durationSeconds));
const artistOf = (t: Pick<Track, "artist" | "albumArtist">) => t.artist || t.albumArtist;

type Entry = { duration: number | null; label: string; id?: string };

/** Lookup of songs already in the library (and imported so far this run). */
export class DuplicateIndex {
  private byKey = new Map<string, Entry[]>();

  constructor(tracks: Track[] = []) {
    for (const t of tracks) this.add(t.title, artistOf(t), seconds(t), t.id);
  }

  /** The existing song this one duplicates, as "Title — Artist", or null. */
  find(title: string | null | undefined, artist: string | null | undefined, duration: number | null): string | null {
    const key = duplicateKey(title, artist);
    if (!key) return null;
    return this.byKey.get(key)?.find((e) => closeLength(e.duration, duration))?.label ?? null;
  }

  /** Id of the library track this song duplicates, or null. */
  findId(title: string | null | undefined, artist: string | null | undefined, duration: number | null): string | null {
    const key = duplicateKey(title, artist);
    if (!key) return null;
    return this.byKey.get(key)?.find((e) => e.id && closeLength(e.duration, duration))?.id ?? null;
  }

  add(title: string | null | undefined, artist: string | null | undefined, duration: number | null, id?: string) {
    const key = duplicateKey(title, artist);
    if (!key) return;
    const entry = { duration, label: [title, artist].filter(Boolean).join(" — "), id };
    this.byKey.set(key, [...(this.byKey.get(key) ?? []), entry]);
  }

  remove(title: string | null | undefined, artist: string | null | undefined, duration: number | null) {
    const key = duplicateKey(title, artist);
    const list = key ? this.byKey.get(key) : undefined;
    if (!key || !list) return;
    const i = list.findIndex((e) => e.duration === duration && !e.id);
    if (i >= 0) list.splice(i, 1);
  }
}

const LOSSLESS = /flac|alac|aiff|wav/i;

/** Which copy to keep: lossless, then higher bitrate, artwork, likes and plays. */
function keepScore(t: Track): number {
  return (
    (LOSSLESS.test(t.mimeType) ? 10_000 : 0) +
    (t.bitrate ?? 0) / 1000 +
    (t.artworkKey ? 50 : 0) +
    (t.liked ? 20 : 0) +
    Math.min(t.playCount, 50)
  );
}

export type DuplicateGroup = { keep: Track; extras: Track[] };

/** Groups of copies of the same song already in the library, best copy first. */
export function findDuplicateGroups(tracks: Track[]): DuplicateGroup[] {
  const byKey = new Map<string, Track[]>();
  for (const t of tracks) {
    const key = duplicateKey(t.title, artistOf(t));
    if (key) byKey.set(key, [...(byKey.get(key) ?? []), t]);
  }
  const groups: DuplicateGroup[] = [];
  for (const list of byKey.values()) {
    if (list.length < 2) continue;
    // Split one title/artist into clusters of matching length (a live take stays separate).
    const clusters: Track[][] = [];
    for (const t of [...list].sort((a, b) => (seconds(a) ?? 0) - (seconds(b) ?? 0))) {
      const last = clusters.at(-1);
      if (last && closeLength(seconds(last[last.length - 1]), seconds(t))) last.push(t);
      else clusters.push([t]);
    }
    for (const c of clusters) {
      if (c.length < 2) continue;
      const [keep, ...extras] = [...c].sort((a, b) => keepScore(b) - keepScore(a));
      groups.push({ keep, extras });
    }
  }
  return groups.sort((a, b) => artistOf(a.keep)!.localeCompare(artistOf(b.keep)!) || a.keep.title.localeCompare(b.keep.title));
}
