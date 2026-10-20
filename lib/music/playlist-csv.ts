import { duplicateArtist, duplicateKey, duplicateTitle } from "@/lib/music/duplicates";
import type { Track } from "@/lib/music/types";

// Imports a "songs by playlist" CSV (one column per playlist, headed
// "Name [N songs]", each cell "Title - Artist") — the shape Apple Music
// playlist exporters produce. Songs are matched to the library by title and
// main artist; year-named playlists ("1997") can also set songs' years.

export type CsvPlaylist = {
  name: string;
  /** Song count from the header, if given. */
  expected: number | null;
  entries: { title: string; artist: string | null }[];
  /** A year-named playlist ("1997"): its songs are from that year. */
  year: number | null;
  /** Folders and catch-all lists that shouldn't be imported by default. */
  suggestSkip: boolean;
};

/** RFC 4180-ish CSV: quoted fields, doubled quotes, CRLF/LF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** "Rock The Boat - Aaliyah" → title + artist (split at the last " - "). */
export function splitEntry(cell: string): { title: string; artist: string | null } | null {
  const text = cell.trim();
  if (!text) return null;
  const at = text.lastIndexOf(" - ");
  if (at <= 0) return { title: text, artist: null };
  return { title: text.slice(0, at).trim(), artist: text.slice(at + 3).trim() || null };
}

const FOLDERS = new Set(["decades", "playlists", "years", "playlist", "library", "music"]);

/** Every playlist (column) in the file. Throws if it isn't a playlist CSV. */
export function parsePlaylistCsv(text: string): CsvPlaylist[] {
  const rows = parseCsv(text).filter((r) => r.some((c) => c.trim()));
  if (rows.length < 2) throw new Error("That file doesn't have any playlists in it.");
  const [header, ...body] = rows;
  const playlists = header.map((raw, col) => {
    const m = /^(.*?)\s*\[(\d+)\s+songs?\]\s*$/i.exec(raw.trim());
    const name = (m ? m[1] : raw).trim();
    const expected = m ? Number(m[2]) : null;
    const entries = body.flatMap((r) => {
      const e = splitEntry(r[col] ?? "");
      return e ? [e] : [];
    });
    const year = /^(19|20)\d{2}$/.test(name) ? Number(name) : null;
    // Folders ("Decades", "Years") and whole-library lists ("Playlist 5") hold thousands of songs.
    const suggestSkip = FOLDERS.has(name.toLowerCase()) || /^playlist \d+$/i.test(name) || (expected ?? entries.length) > 3000;
    return { name, expected, entries, year, suggestSkip };
  });
  const usable = playlists.filter((p) => p.name && p.entries.length);
  if (!usable.length) throw new Error("No songs found — is this a playlist export?");
  return usable;
}

/** Index of the library by title + main artist (and by title alone as a fallback). */
export function buildSongIndex(library: Track[]) {
  const byKey = new Map<string, Track[]>();
  const byTitle = new Map<string, Track[]>();
  for (const t of library) {
    if (t.remote) continue;
    const key = duplicateKey(t.title, t.artist || t.albumArtist);
    if (key) byKey.set(key, [...(byKey.get(key) ?? []), t]);
    const title = duplicateTitle(t.title);
    if (title) byTitle.set(title, [...(byTitle.get(title) ?? []), t]);
  }
  return { byKey, byTitle };
}

const pick = (list: Track[]) => [...list].sort((a, b) => b.playCount - a.playCount || (b.bitrate ?? 0) - (a.bitrate ?? 0))[0];

/** The library song for "Title - Artist", or null. Prefers the most-played copy. */
export function matchEntry(index: ReturnType<typeof buildSongIndex>, entry: { title: string; artist: string | null }): Track | null {
  if (entry.artist) {
    const exact = index.byKey.get(duplicateKey(entry.title, entry.artist) ?? "");
    if (exact?.length) return pick(exact);
  }
  // Same title, and the artist names overlap ("Nelly & City Spud" vs "Nelly").
  const sameTitle = index.byTitle.get(duplicateTitle(entry.title)) ?? [];
  if (!entry.artist) return sameTitle.length === 1 ? sameTitle[0] : null;
  const want = duplicateArtist(entry.artist);
  const fits = sameTitle.filter((t) => {
    const a = duplicateArtist(t.artist || t.albumArtist);
    return a && want && (a.includes(want) || want.includes(a));
  });
  return fits.length ? pick(fits) : null;
}

export type MatchedPlaylist = CsvPlaylist & { trackIds: string[]; missing: { title: string; artist: string | null }[] };

export function matchPlaylists(playlists: CsvPlaylist[], library: Track[]): MatchedPlaylist[] {
  const index = buildSongIndex(library);
  return playlists.map((p) => {
    const ids: string[] = [];
    const missing: MatchedPlaylist["missing"] = [];
    for (const e of p.entries) {
      const t = matchEntry(index, e);
      if (t) {
        if (!ids.includes(t.id)) ids.push(t.id);
      } else missing.push(e);
    }
    return { ...p, trackIds: ids, missing };
  });
}

/**
 * Years from year-named playlists. A song in several year playlists takes the
 * earliest (it was released then and re-added later).
 */
export function yearsFromPlaylists(playlists: MatchedPlaylist[]): Map<string, number> {
  const years = new Map<string, number>();
  for (const p of playlists) {
    if (!p.year) continue;
    for (const id of p.trackIds) years.set(id, Math.min(years.get(id) ?? p.year, p.year));
  }
  return years;
}
