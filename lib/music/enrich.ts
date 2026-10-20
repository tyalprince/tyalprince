import { createHash } from "node:crypto";
import { and, eq, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { musicTracks } from "@/lib/db/schema";
import { getUserTrack } from "@/lib/music/queries";
import { artworkObjectKey, putObject } from "@/lib/music/storage";
import {
  creditsFrom,
  isAllowedArtworkHost,
  itunesArtworkUrl,
  parseReleaseDate,
  chooseReleaseDate,
  mbFirstReleaseDate,
  pickItunesAlbum,
  sameAlbumTitle,
  pickItunesMatch,
  pickLrclib,
  pickMbRecording,
  workIdsFrom,
  type ItunesAlbum,
  type ItunesSong,
  type LrclibRecord,
  type MbRecording,
  type MbRelation,
  type TrackQuery,
} from "@/lib/music/metadata-sources";

// Fills in what a file's tags didn't have, from free public catalogs:
//  - iTunes Search API → album art (saved to our own bucket) + release date
//  - MusicBrainz       → songwriter / lyricist / producer credits
//  - LRCLIB            → lyrics (plain + time-synced), fetched on demand
// Every lookup is best-effort: a miss or an outage just leaves the field empty.

// MusicBrainz asks clients to identify themselves and stay under 1 request/second.
const USER_AGENT = "LifeOS-Music/1.0 (https://tyalprince.vercel.app)";
const MB_GAP_MS = 1100;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getJson<T>(url: string, timeoutMs = 8000): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

type TrackRow = NonNullable<Awaited<ReturnType<typeof getUserTrack>>>;

function queryFor(t: TrackRow): TrackQuery {
  return {
    title: t.title,
    artist: t.artist || t.albumArtist,
    album: t.album,
    durationSeconds: t.durationSeconds ? Number(t.durationSeconds) : null,
  };
}

/** The best catalog match, null for no match, or undefined if Apple didn't answer (e.g. rate-limited). */
async function lookupItunes(q: TrackQuery): Promise<ItunesSong | null | undefined> {
  const term = [q.artist, q.title].filter(Boolean).join(" ").replace(/[*]/g, "");
  const data = await getJson<{ results?: ItunesSong[] }>(
    `https://itunes.apple.com/search?${new URLSearchParams({ term, media: "music", entity: "song", limit: "15" })}`,
  );
  if (!data) return undefined;
  return pickItunesMatch(data.results ?? [], q);
}

/** Album lookup for cover art; same null/undefined convention as lookupItunes. */
async function lookupItunesAlbum(album: string, artist: string | null): Promise<ItunesAlbum | null | undefined> {
  const term = [artist, album].filter(Boolean).join(" ").replace(/[*]/g, "");
  const data = await getJson<{ results?: ItunesAlbum[] }>(
    `https://itunes.apple.com/search?${new URLSearchParams({ term, media: "music", entity: "album", limit: "15" })}`,
  );
  if (!data) return undefined;
  return pickItunesAlbum(data.results ?? [], album, artist);
}

/** Downloads cover art from Apple's CDN into our bucket; returns the object key. */
async function storeArtwork(userId: string, artworkUrl100: string): Promise<string | null> {
  const url = itunesArtworkUrl(artworkUrl100);
  if (!isAllowedArtworkHost(url)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !type.startsWith("image/")) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (!bytes.length || bytes.length > 5 * 1024 * 1024) return null;
    const ext = type.includes("png") ? "png" : "jpg";
    const key = artworkObjectKey(userId, createHash("sha256").update(bytes).digest("hex"), ext);
    await putObject(key, bytes, ext === "png" ? "image/png" : "image/jpeg");
    return key;
  } catch {
    return null;
  }
}

/** MusicBrainz recordings for a song; undefined if MusicBrainz didn't answer (rate limit, outage). */
async function searchMbRecordings(q: TrackQuery): Promise<MbRecording[] | undefined> {
  if (!q.artist) return [];
  const esc = (s: string) => s.replace(/(["\\])/g, "\\$1");
  const search = await getJson<{ recordings?: MbRecording[] }>(
    `https://musicbrainz.org/ws/2/recording?${new URLSearchParams({
      query: `recording:"${esc(q.title)}" AND artist:"${esc(q.artist.replace(/[*]/g, ""))}"`,
      fmt: "json",
      limit: "100", // popular songs appear on many releases; the original can sit far down the list
    })}`,
  );
  return search ? (search.recordings ?? []) : undefined;
}

async function lookupCredits(q: TrackQuery) {
  const recordings = await searchMbRecordings(q);
  if (!recordings) return undefined;
  const firstReleaseDate = mbFirstReleaseDate(recordings, q);
  const recording = pickMbRecording(recordings, q);
  if (!recording) return { recordingId: null, firstReleaseDate, composer: [], lyricist: [], producer: [] };

  await sleep(MB_GAP_MS);
  const detail = await getJson<{ relations?: MbRelation[] }>(
    `https://musicbrainz.org/ws/2/recording/${recording.id}?inc=artist-rels+work-rels&fmt=json`,
  );
  const recRels = detail?.relations ?? [];
  const workRels: MbRelation[][] = [];
  for (const workId of workIdsFrom(recRels)) {
    await sleep(MB_GAP_MS);
    const work = await getJson<{ relations?: MbRelation[] }>(`https://musicbrainz.org/ws/2/work/${workId}?inc=artist-rels&fmt=json`);
    workRels.push(work?.relations ?? []);
  }
  return { recordingId: recording.id, firstReleaseDate, ...creditsFrom(recRels, workRels) };
}

const join = (xs: string[]) => (xs.length ? xs.join(", ") : null);

export type EnrichOptions = {
  credits?: boolean;
  force?: boolean;
  /** Background cover-art fill: art + release date only, and the song still gets its full lookup when played. */
  artworkOnly?: boolean;
};

/**
 * Looks up artwork, release date and (optionally) credits for one track and
 * saves whatever was found. Album-level results (art, date) are shared with
 * the rest of the album so a library is filled in roughly one lookup per album.
 * `retryLater` is set when Apple's catalog didn't answer (usually its rate limit).
 */
export async function enrichTrack(userId: string, trackId: string, opts: EnrichOptions = {}) {
  const track = await getUserTrack(userId, trackId);
  if (!track) return null;
  if (track.enrichedAt && !opts.force) return { row: track, retryLater: false };
  if (opts.artworkOnly && track.external?.itunesChecked && !opts.force) return { row: track, retryLater: false };

  const q = queryFor(track);
  const external = { ...(track.external ?? {}) };
  const changes: Partial<typeof musicTracks.$inferInsert> = {};
  const albumArtist = track.albumArtist || track.artist;
  const sameAlbum = track.album
    ? and(
        eq(musicTracks.userId, userId),
        eq(musicTracks.album, track.album),
        albumArtist
          ? or(eq(musicTracks.albumArtist, albumArtist), and(isNull(musicTracks.albumArtist), eq(musicTracks.artist, albumArtist)))
          : sql`true`,
      )
    : null;

  // Reuse art / date already found for another song on the same album.
  if (sameAlbum && (!track.artworkKey || !track.releaseDate)) {
    const siblings = await db
      .select({ artworkKey: musicTracks.artworkKey, releaseDate: musicTracks.releaseDate })
      .from(musicTracks)
      .where(
        and(
          sameAlbum,
          ne(musicTracks.id, track.id),
          or(sql`${musicTracks.artworkKey} is not null`, sql`${musicTracks.releaseDate} is not null`),
        ),
      )
      .limit(10);
    const art = siblings.find((s) => s.artworkKey)?.artworkKey;
    const date = siblings.find((s) => s.releaseDate)?.releaseDate;
    if (art && !track.artworkKey) changes.artworkKey = art;
    if (date && !track.releaseDate) changes.releaseDate = date;
  }

  let retryLater = false;
  let itunesAnswered = false;
  const needsArt = !track.artworkKey && !changes.artworkKey;
  const needsDate = !track.releaseDate && !changes.releaseDate;
  // A song Apple already had no match for isn't asked again unless forced.
  if ((needsArt || needsDate || opts.force) && (!external.itunesChecked || opts.force)) {
    const match = await lookupItunes(q);
    retryLater = match === undefined;
    itunesAnswered = match !== undefined;
    if (itunesAnswered) external.itunesChecked = "1";
    if (match) {
      const date = chooseReleaseDate({ catalog: parseReleaseDate(match.releaseDate), tagYear: track.year });
      if (date && (needsDate || opts.force)) changes.releaseDate = date;
      if (!track.genre && match.primaryGenreName) changes.genre = match.primaryGenreName;
      if (match.trackViewUrl) external.appleMusicUrl = match.trackViewUrl;
      if (match.collectionName) external.itunesAlbum = match.collectionName.slice(0, 200);
      // Only the cover of the file's own album (not a compilation or live album the song is also on);
      // otherwise the album search below finds the right one.
      if (needsArt && match.artworkUrl100 && (!track.album || sameAlbumTitle(match.collectionName, track.album))) {
        const key = await storeArtwork(userId, match.artworkUrl100);
        if (key) changes.artworkKey = key;
      }
    }
    // Song not found under this title (e.g. "Hot In Here" vs "Hot In Herre"): try the album.
    if (needsArt && !changes.artworkKey && itunesAnswered && track.album) {
      const artist = albumArtist && !/various/i.test(albumArtist) ? albumArtist : null;
      const album = await lookupItunesAlbum(track.album, artist);
      if (album === undefined) {
        retryLater = true;
        itunesAnswered = false;
        delete external.itunesChecked;
      } else if (album?.artworkUrl100) {
        const key = await storeArtwork(userId, album.artworkUrl100);
        if (key) changes.artworkKey = key;
        const date = chooseReleaseDate({ catalog: parseReleaseDate(album.releaseDate), tagYear: track.year });
        if (date && needsDate && !changes.releaseDate) changes.releaseDate = date;
        if (!track.genre && !changes.genre && album.primaryGenreName) changes.genre = album.primaryGenreName;
      }
    }
  }
  if (!track.year && changes.releaseDate) changes.year = Number(changes.releaseDate.slice(0, 4));

  if (!opts.artworkOnly && opts.credits !== false && (!track.composer || opts.force) && (!external.musicbrainzChecked || opts.force)) {
    const credits = await lookupCredits(q);
    if (credits) {
      external.musicbrainzChecked = "1";
      external.mbDateChecked = "1";
      if (credits.firstReleaseDate) {
        changes.releaseDate = chooseReleaseDate({
          musicbrainz: credits.firstReleaseDate,
          catalog: changes.releaseDate ?? track.releaseDate,
          tagYear: track.year,
        });
      }
      if (credits.recordingId) external.musicbrainzRecordingId = credits.recordingId;
      if (credits.composer.length && !track.composer) changes.composer = join(credits.composer);
      if (credits.lyricist.length && !track.lyricist) changes.lyricist = join(credits.lyricist);
      if (credits.producer.length && !track.producer) changes.producer = join(credits.producer);
    }
  }

  await db
    .update(musicTracks)
    .set({ ...changes, external, ...(opts.artworkOnly ? {} : { enrichedAt: new Date() }) })
    .where(and(eq(musicTracks.id, track.id), eq(musicTracks.userId, userId)));

  // Share newly found album art with album-mates that have none.
  if (sameAlbum && changes.artworkKey) {
    await db.update(musicTracks).set({ artworkKey: changes.artworkKey }).where(and(sameAlbum, isNull(musicTracks.artworkKey)));
  }
  if (sameAlbum && changes.releaseDate) {
    await db.update(musicTracks).set({ releaseDate: changes.releaseDate }).where(and(sameAlbum, isNull(musicTracks.releaseDate)));
  }
  // Apple had nothing for this album: don't ask again for each of its songs.
  if (sameAlbum && itunesAnswered && !changes.artworkKey && needsArt) {
    await db
      .update(musicTracks)
      .set({ external: sql`coalesce(${musicTracks.external}, '{}'::jsonb) || '{"itunesChecked":"1"}'::jsonb` })
      .where(and(sameAlbum, isNull(musicTracks.artworkKey)));
  }
  const row = await getUserTrack(userId, trackId);
  return row ? { row, retryLater } : null;
}

/**
 * Re-checks a song's release date against MusicBrainz's original release date
 * (one request), falling back to the earlier of its current date and the
 * file's year so reissue dates don't stick. `retryLater` when MusicBrainz
 * didn't answer.
 */
export async function verifyReleaseDate(userId: string, trackId: string) {
  const track = await getUserTrack(userId, trackId);
  if (!track) return null;
  if (track.external?.mbDateChecked) return { row: track, retryLater: false };
  const recordings = await searchMbRecordings(queryFor(track));
  if (!recordings) return { row: track, retryLater: true };
  const releaseDate = chooseReleaseDate({
    musicbrainz: mbFirstReleaseDate(recordings, queryFor(track)),
    catalog: track.releaseDate,
    tagYear: track.year,
  });
  await db
    .update(musicTracks)
    .set({ releaseDate, external: { ...(track.external ?? {}), mbDateChecked: "1" } })
    .where(and(eq(musicTracks.id, track.id), eq(musicTracks.userId, userId)));
  const row = await getUserTrack(userId, trackId);
  return row ? { row, retryLater: false } : null;
}

/**
 * Re-checks a cover that came from the old song-level lookup (which could pick
 * a compilation or live album's art): searches the file's album by name and
 * artist and, only if found, replaces the cover for the album's flagged songs.
 * The existing cover is kept when the album isn't in the catalog.
 */
export async function recheckArtwork(userId: string, trackId: string) {
  const track = await getUserTrack(userId, trackId);
  if (!track) return null;
  const clearFlag = sql`${musicTracks.external} - 'artRecheck'`;
  const albumArtist = track.albumArtist || track.artist;
  const sameAlbum = track.album
    ? and(
        eq(musicTracks.userId, userId),
        eq(musicTracks.album, track.album),
        albumArtist
          ? or(eq(musicTracks.albumArtist, albumArtist), and(isNull(musicTracks.albumArtist), eq(musicTracks.artist, albumArtist)))
          : sql`true`,
      )
    : and(eq(musicTracks.userId, userId), eq(musicTracks.id, track.id));

  if (track.album && track.external?.artRecheck) {
    const artist = albumArtist && !/various/i.test(albumArtist) ? albumArtist : null;
    const album = await lookupItunesAlbum(track.album, artist);
    if (album === undefined) return { row: track, retryLater: true };
    const key = album?.artworkUrl100 ? await storeArtwork(userId, album.artworkUrl100) : null;
    if (key) {
      await db
        .update(musicTracks)
        .set({ artworkKey: key, external: clearFlag })
        .where(and(sameAlbum, sql`${musicTracks.external} ? 'artRecheck'`));
    }
  }
  await db.update(musicTracks).set({ external: clearFlag }).where(sameAlbum);
  const row = await getUserTrack(userId, trackId);
  return row ? { row, retryLater: false } : null;
}

export type LyricsResult = { plain: string | null; synced: string | null; source: "embedded" | "lrclib" | null; instrumental: boolean };

/** Lyrics from the file's tags if present, otherwise LRCLIB (cached on the track either way). */
export async function getLyrics(userId: string, trackId: string): Promise<LyricsResult | null> {
  const track = await getUserTrack(userId, trackId);
  if (!track) return null;
  if (track.lyricsCheckedAt || track.lyrics || track.syncedLyrics) {
    return { plain: track.lyrics, synced: track.syncedLyrics, source: track.lyricsSource, instrumental: false };
  }

  const q = queryFor(track);
  const params: Record<string, string> = { track_name: q.title, artist_name: (q.artist ?? "").replace(/[*]/g, "") };
  if (q.album) params.album_name = q.album;
  if (q.durationSeconds) params.duration = String(Math.round(q.durationSeconds));
  let record = q.artist ? await getJson<LrclibRecord>(`https://lrclib.net/api/get?${new URLSearchParams(params)}`) : null;
  if (!record?.plainLyrics && !record?.syncedLyrics && !record?.instrumental) {
    const results = await getJson<LrclibRecord[]>(
      `https://lrclib.net/api/search?${new URLSearchParams({ track_name: q.title, ...(q.artist ? { artist_name: params.artist_name } : {}) })}`,
    );
    record = pickLrclib(Array.isArray(results) ? results : [], q);
  }

  const found = Boolean(record?.plainLyrics || record?.syncedLyrics);
  await db
    .update(musicTracks)
    .set({
      lyrics: record?.plainLyrics ?? null,
      syncedLyrics: record?.syncedLyrics ?? null,
      lyricsSource: found ? "lrclib" : null,
      lyricsCheckedAt: new Date(),
    })
    .where(and(eq(musicTracks.id, track.id), eq(musicTracks.userId, userId)));
  return {
    plain: record?.plainLyrics ?? null,
    synced: record?.syncedLyrics ?? null,
    source: found ? "lrclib" : null,
    instrumental: Boolean(record?.instrumental),
  };
}
