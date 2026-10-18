// Pure helpers for the online metadata sources (no network here — see
// lib/music/enrich.ts). Matching is deliberately conservative: a wrong cover
// or songwriter is worse than none, so results must agree on title + artist.

export type ItunesSong = {
  wrapperType?: string;
  kind?: string;
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  collectionArtistName?: string;
  artworkUrl100?: string;
  releaseDate?: string;
  primaryGenreName?: string;
  trackViewUrl?: string;
  collectionViewUrl?: string;
  trackTimeMillis?: number;
};

export type MbRecording = {
  id: string;
  score?: number;
  title?: string;
  length?: number;
  "artist-credit"?: { name?: string; artist?: { name?: string } }[];
};

export type MbRelation = {
  type?: string;
  "target-type"?: string;
  attributes?: string[];
  artist?: { id?: string; name?: string };
  work?: { id?: string; title?: string };
};

export type LrclibRecord = {
  id?: number;
  trackName?: string;
  artistName?: string;
  albumName?: string;
  duration?: number;
  instrumental?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
};

/** Lowercase, strip accents/punctuation, "feat." credits and edition tags like "(Remastered 2011)". */
export function normalizeTitle(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s*[([].*?(remaster|version|edit|mix|live|mono|stereo|deluxe|explicit|clean|feat|ft\.|bonus).*?[)\]]/g, "")
    .replace(/\s+-\s+.*(remaster|version|edit|mix|live).*$/g, "")
    .replace(/\b(feat|ft|featuring)\.?\s.*$/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Normalised main artist: drops featured artists and a leading "the". */
export function normalizeArtist(s: string | null | undefined): string {
  return normalizeTitle(
    (s ?? "")
      .split(/\s*(?:,|;|\/| x | & | and | with | feat\.?| ft\.?| featuring )\s*/i)[0]
      .replace(/^the\s+/i, ""),
  ).replace(/\s+/g, "");
}

function titlesMatch(a: string, b: string): boolean {
  const x = normalizeTitle(a);
  const y = normalizeTitle(b);
  return Boolean(x && y && (x === y || (x.length > 6 && (y.startsWith(x) || x.startsWith(y)))));
}

function artistsMatch(a: string, b: string): boolean {
  const x = normalizeArtist(a);
  const y = normalizeArtist(b);
  return Boolean(x && y && (x === y || x.includes(y) || y.includes(x)));
}

export type TrackQuery = { title: string; artist: string | null; album: string | null; durationSeconds: number | null };

/** Best iTunes catalog match: title and artist must agree; album and duration break ties. */
export function pickItunesMatch(results: ItunesSong[], q: TrackQuery): ItunesSong | null {
  let best: { r: ItunesSong; score: number } | null = null;
  for (const r of results) {
    if (r.kind && r.kind !== "song") continue;
    if (!r.trackName || !titlesMatch(r.trackName, q.title)) continue;
    if (q.artist && !(artistsMatch(r.artistName ?? "", q.artist) || artistsMatch(r.collectionArtistName ?? "", q.artist))) continue;
    let score = 1;
    if (q.album && r.collectionName && normalizeTitle(r.collectionName) === normalizeTitle(q.album)) score += 2;
    if (q.durationSeconds && r.trackTimeMillis) {
      const diff = Math.abs(r.trackTimeMillis / 1000 - q.durationSeconds);
      score += diff < 3 ? 1 : diff < 10 ? 0.5 : diff > 60 ? -1 : 0;
    }
    if (!best || score > best.score) best = { r, score };
  }
  return best?.r ?? null;
}

/** iTunes returns a 100px thumbnail; the same URL serves larger sizes. */
export function itunesArtworkUrl(url: string, size = 600): string {
  return url.replace(/\/\d+x\d+(bb)?\.(jpg|png)$/i, `/${size}x${size}bb.jpg`);
}

/** Only fetch artwork from Apple's image CDN (the URL comes from an API response). */
export function isAllowedArtworkHost(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && /(^|\.)mzstatic\.com$/.test(u.hostname);
  } catch {
    return false;
  }
}

/** "1998-03-24T08:00:00Z" / "1998-03-24" / "1998" → "1998-03-24" or "1998"; null if unparseable. */
export function parseReleaseDate(value: string | null | undefined): string | null {
  const m = /^(\d{4})(?:-(\d{2})-(\d{2}))?/.exec((value ?? "").trim());
  if (!m) return null;
  const year = Number(m[1]);
  if (year < 1000 || year > 3000) return null;
  return m[2] ? `${m[1]}-${m[2]}-${m[3]}` : m[1];
}

/** Picks the MusicBrainz recording whose title and artist agree with the track. */
export function pickMbRecording(recordings: MbRecording[], q: TrackQuery): MbRecording | null {
  for (const r of recordings) {
    if ((r.score ?? 100) < 80) continue;
    if (!r.title || !titlesMatch(r.title, q.title)) continue;
    const credit = (r["artist-credit"] ?? []).map((c) => c.name ?? c.artist?.name ?? "").join(" ");
    if (q.artist && !artistsMatch(credit, q.artist)) continue;
    return r;
  }
  return null;
}

export type Credits = { composer: string[]; lyricist: string[]; producer: string[] };

const unique = (xs: string[]) => [...new Set(xs.filter(Boolean))];

/** Producer credits come from the recording; writers from the works it performs. */
export function creditsFrom(recordingRelations: MbRelation[], workRelations: MbRelation[][]): Credits {
  const producer = recordingRelations.filter((r) => r.type === "producer" && r.artist?.name).map((r) => r.artist!.name!);
  const composer: string[] = [];
  const lyricist: string[] = [];
  for (const rel of workRelations.flat()) {
    const name = rel.artist?.name;
    if (!name) continue;
    if (rel.type === "composer" || rel.type === "writer") composer.push(name);
    if (rel.type === "lyricist" || rel.type === "writer") lyricist.push(name);
  }
  return { composer: unique(composer), lyricist: unique(lyricist), producer: unique(producer) };
}

export function workIdsFrom(recordingRelations: MbRelation[]): string[] {
  return unique(recordingRelations.filter((r) => r.type === "performance" && r.work?.id).map((r) => r.work!.id!)).slice(0, 2);
}

/** Picks an LRCLIB search result for this song, preferring ones with synced lyrics. */
export function pickLrclib(results: LrclibRecord[], q: TrackQuery): LrclibRecord | null {
  const candidates = results.filter(
    (r) =>
      r.trackName &&
      titlesMatch(r.trackName, q.title) &&
      (!q.artist || artistsMatch(r.artistName ?? "", q.artist)) &&
      (!q.durationSeconds || !r.duration || Math.abs(r.duration - q.durationSeconds) < 8) &&
      (r.instrumental || r.plainLyrics || r.syncedLyrics),
  );
  return candidates.find((r) => r.syncedLyrics) ?? candidates[0] ?? null;
}

export type LyricLine = { time: number; text: string };

/** Parses LRC ("[01:23.45] line", possibly several stamps per line) into time-ordered lines. */
export function parseLrc(lrc: string | null | undefined): LyricLine[] {
  const lines: LyricLine[] = [];
  for (const raw of (lrc ?? "").split(/\r?\n/)) {
    const stamps = [...raw.matchAll(/\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    if (!stamps.length) continue;
    const text = raw.replace(/\[[^\]]*\]/g, "").trim();
    for (const s of stamps) {
      const frac = s[3] ? Number(s[3]) / 10 ** s[3].length : 0;
      lines.push({ time: Number(s[1]) * 60 + Number(s[2]) + frac, text });
    }
  }
  return lines.sort((a, b) => a.time - b.time);
}

/** Index of the line being sung at `position` seconds (−1 before the first line). */
export function activeLyricIndex(lines: LyricLine[], position: number): number {
  let idx = -1;
  for (let i = 0; i < lines.length && lines[i].time <= position + 0.25; i++) idx = i;
  return idx;
}
