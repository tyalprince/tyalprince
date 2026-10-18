import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { musicPlaylistTracks, musicPlaylists, musicTracks } from "@/lib/db/schema";

// Every query is scoped by userId (see the Authorization model in README).

export const trackColumns = {
  id: musicTracks.id,
  title: musicTracks.title,
  artist: musicTracks.artist,
  albumArtist: musicTracks.albumArtist,
  album: musicTracks.album,
  genre: musicTracks.genre,
  year: musicTracks.year,
  trackNumber: musicTracks.trackNumber,
  discNumber: musicTracks.discNumber,
  durationSeconds: musicTracks.durationSeconds,
  bitrate: musicTracks.bitrate,
  mimeType: musicTracks.mimeType,
  fileSize: musicTracks.fileSize,
  artworkKey: musicTracks.artworkKey,
  features: musicTracks.features,
  featureVector: musicTracks.featureVector,
  liked: musicTracks.liked,
  playCount: musicTracks.playCount,
  lastPlayedAt: musicTracks.lastPlayedAt,
  createdAt: musicTracks.createdAt,
};

export async function getUserTracks(userId: string) {
  return db
    .select(trackColumns)
    .from(musicTracks)
    .where(eq(musicTracks.userId, userId))
    .orderBy(asc(musicTracks.artist), asc(musicTracks.album), asc(musicTracks.discNumber), asc(musicTracks.trackNumber));
}

export async function getUserTrack(userId: string, id: string) {
  const [row] = await db
    .select()
    .from(musicTracks)
    .where(and(eq(musicTracks.id, id), eq(musicTracks.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function getExistingHashes(userId: string, hashes: string[]) {
  if (!hashes.length) return new Set<string>();
  const rows = await db
    .select({ hash: musicTracks.contentHash })
    .from(musicTracks)
    .where(and(eq(musicTracks.userId, userId), inArray(musicTracks.contentHash, hashes)));
  return new Set(rows.map((r) => r.hash));
}

export async function artworkInUse(userId: string, artworkKey: string) {
  const [row] = await db
    .select({ id: musicTracks.id })
    .from(musicTracks)
    .where(and(eq(musicTracks.userId, userId), eq(musicTracks.artworkKey, artworkKey)))
    .limit(1);
  return Boolean(row);
}

export async function getUserPlaylists(userId: string) {
  return db
    .select({
      id: musicPlaylists.id,
      name: musicPlaylists.name,
      description: musicPlaylists.description,
      kind: musicPlaylists.kind,
      recipe: musicPlaylists.recipe,
      createdAt: musicPlaylists.createdAt,
      updatedAt: musicPlaylists.updatedAt,
      trackCount: sql<number>`(select count(*)::int from ${musicPlaylistTracks} where ${musicPlaylistTracks.playlistId} = ${musicPlaylists.id})`,
    })
    .from(musicPlaylists)
    .where(eq(musicPlaylists.userId, userId))
    .orderBy(desc(musicPlaylists.updatedAt));
}

export async function getUserPlaylist(userId: string, id: string) {
  const [playlist] = await db
    .select()
    .from(musicPlaylists)
    .where(and(eq(musicPlaylists.id, id), eq(musicPlaylists.userId, userId)))
    .limit(1);
  if (!playlist) return null;
  const entries = await db
    .select({ trackId: musicPlaylistTracks.trackId })
    .from(musicPlaylistTracks)
    .where(eq(musicPlaylistTracks.playlistId, id))
    .orderBy(asc(musicPlaylistTracks.position));
  return { playlist, trackIds: entries.map((e) => e.trackId) };
}

/** Only ids of tracks the user owns, in the given order. */
export async function filterOwnedTrackIds(userId: string, ids: string[]) {
  if (!ids.length) return [];
  const rows = await db
    .select({ id: musicTracks.id })
    .from(musicTracks)
    .where(and(eq(musicTracks.userId, userId), inArray(musicTracks.id, [...new Set(ids)])));
  const owned = new Set(rows.map((r) => r.id));
  return ids.filter((id) => owned.has(id));
}

export async function replacePlaylistTracks(playlistId: string, trackIds: string[]) {
  await db.batch([
    db.delete(musicPlaylistTracks).where(eq(musicPlaylistTracks.playlistId, playlistId)),
    ...(trackIds.length
      ? [db.insert(musicPlaylistTracks).values(trackIds.map((trackId, position) => ({ playlistId, trackId, position })))]
      : []),
  ] as unknown as Parameters<typeof db.batch>[0]);
}
