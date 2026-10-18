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
  pickItunesMatch,
  pickLrclib,
  pickMbRecording,
  workIdsFrom,
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

async function lookupItunes(q: TrackQuery): Promise<ItunesSong | null> {
  const term = [q.artist, q.title].filter(Boolean).join(" ").replace(/[*]/g, "");
  const data = await getJson<{ results?: ItunesSong[] }>(
    `https://itunes.apple.com/search?${new URLSearchParams({ term, media: "music", entity: "song", limit: "15" })}`,
  );
  return pickItunesMatch(data?.results ?? [], q);
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

async function lookupCredits(q: TrackQuery) {
  if (!q.artist) return null;
  const esc = (s: string) => s.replace(/(["\\])/g, "\\$1");
  const search = await getJson<{ recordings?: MbRecording[] }>(
    `https://musicbrainz.org/ws/2/recording?${new URLSearchParams({
      query: `recording:"${esc(q.title)}" AND artist:"${esc(q.artist.replace(/[*]/g, ""))}"`,
      fmt: "json",
      limit: "10",
    })}`,
  );
  const recording = pickMbRecording(search?.recordings ?? [], q);
  if (!recording) return null;

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
  return { recordingId: recording.id, ...creditsFrom(recRels, workRels) };
}

const join = (xs: string[]) => (xs.length ? xs.join(", ") : null);

/**
 * Looks up artwork, release date and (optionally) credits for one track and
 * saves whatever was found. Album-level results (art, date) are shared with
 * the rest of the album so a library is filled in roughly one lookup per album.
 */
export async function enrichTrack(userId: string, trackId: string, opts: { credits?: boolean; force?: boolean } = {}) {
  const track = await getUserTrack(userId, trackId);
  if (!track) return null;
  if (track.enrichedAt && !opts.force) return track;

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
    const [sibling] = await db
      .select({ artworkKey: musicTracks.artworkKey, releaseDate: musicTracks.releaseDate })
      .from(musicTracks)
      .where(and(sameAlbum, ne(musicTracks.id, track.id), sql`${musicTracks.enrichedAt} is not null`))
      .limit(1);
    if (sibling?.artworkKey && !track.artworkKey) changes.artworkKey = sibling.artworkKey;
    if (sibling?.releaseDate && !track.releaseDate) changes.releaseDate = sibling.releaseDate;
  }

  const needsArt = !track.artworkKey && !changes.artworkKey;
  const needsDate = !track.releaseDate && !changes.releaseDate;
  if (needsArt || needsDate || opts.force) {
    const match = await lookupItunes(q);
    if (match) {
      const date = parseReleaseDate(match.releaseDate);
      if (date && (needsDate || opts.force)) changes.releaseDate = date;
      if (!track.genre && match.primaryGenreName) changes.genre = match.primaryGenreName;
      if (match.trackViewUrl) external.appleMusicUrl = match.trackViewUrl;
      if (needsArt && match.artworkUrl100) {
        const key = await storeArtwork(userId, match.artworkUrl100);
        if (key) changes.artworkKey = key;
      }
    }
  }
  if (!track.year && changes.releaseDate) changes.year = Number(changes.releaseDate.slice(0, 4));

  if (opts.credits !== false && (!track.composer || opts.force) && (!external.musicbrainzChecked || opts.force)) {
    const credits = await lookupCredits(q);
    external.musicbrainzChecked = "1";
    if (credits) {
      external.musicbrainzRecordingId = credits.recordingId;
      if (credits.composer.length && !track.composer) changes.composer = join(credits.composer);
      if (credits.lyricist.length && !track.lyricist) changes.lyricist = join(credits.lyricist);
      if (credits.producer.length && !track.producer) changes.producer = join(credits.producer);
    }
  }

  await db
    .update(musicTracks)
    .set({ ...changes, external, enrichedAt: new Date() })
    .where(and(eq(musicTracks.id, track.id), eq(musicTracks.userId, userId)));

  // Share newly found album art with album-mates that have none.
  if (sameAlbum && changes.artworkKey) {
    await db.update(musicTracks).set({ artworkKey: changes.artworkKey }).where(and(sameAlbum, isNull(musicTracks.artworkKey)));
  }
  if (sameAlbum && changes.releaseDate) {
    await db.update(musicTracks).set({ releaseDate: changes.releaseDate }).where(and(sameAlbum, isNull(musicTracks.releaseDate)));
  }
  return getUserTrack(userId, trackId);
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
