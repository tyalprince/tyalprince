import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { musicPlaylistTracks, musicTracks } from "@/lib/db/schema";
import { artworkInUse } from "@/lib/music/queries";
import { deleteObject } from "@/lib/music/storage";

export type MergeGroup = { keepId: string; removeIds: string[] };

// Details a removed copy may have that the kept one lacks.
const FILL = ["artworkKey", "releaseDate", "genre", "year", "composer", "lyricist", "producer", "label", "copyright"] as const;

/**
 * Collapses copies of one song into the one being kept: playlists point at the
 * kept copy, likes and play counts carry over, missing details are filled in,
 * then the extra copies and their audio files are deleted.
 * Returns the number of copies removed.
 */
export async function mergeDuplicates(userId: string, groups: MergeGroup[]): Promise<number> {
  let removed = 0;
  for (const { keepId, removeIds: requested } of groups) {
    const ids = [keepId, ...requested.filter((id) => id !== keepId)];
    const rows = await db
      .select()
      .from(musicTracks)
      .where(and(eq(musicTracks.userId, userId), inArray(musicTracks.id, ids)));
    const keep = rows.find((r) => r.id === keepId);
    const extras = rows.filter((r) => r.id !== keepId);
    if (!keep || !extras.length) continue;
    const extraIds = extras.map((r) => r.id);

    const changes: Partial<typeof musicTracks.$inferInsert> = {
      liked: keep.liked || extras.some((r) => r.liked),
      playCount: keep.playCount + extras.reduce((s, r) => s + r.playCount, 0),
    };
    const lastPlayed = [keep, ...extras].map((r) => r.lastPlayedAt).filter((d): d is Date => Boolean(d));
    if (lastPlayed.length) changes.lastPlayedAt = new Date(Math.max(...lastPlayed.map((d) => d.getTime())));
    for (const field of FILL) {
      if (keep[field] !== null) continue;
      const value = extras.find((r) => r[field] !== null)?.[field];
      if (value !== undefined && value !== null) (changes as Record<string, unknown>)[field] = value;
    }

    await db.batch([
      // A playlist that already has the kept copy just loses the extra entry…
      db
        .delete(musicPlaylistTracks)
        .where(
          and(
            inArray(musicPlaylistTracks.trackId, extraIds),
            sql`${musicPlaylistTracks.playlistId} in (select playlist_id from music_playlist_tracks where track_id = ${keepId})`,
          ),
        ),
      // …otherwise the entry now points at the kept copy.
      db.update(musicPlaylistTracks).set({ trackId: keepId }).where(inArray(musicPlaylistTracks.trackId, extraIds)),
      db.update(musicTracks).set(changes).where(and(eq(musicTracks.id, keepId), eq(musicTracks.userId, userId))),
      db.delete(musicTracks).where(and(eq(musicTracks.userId, userId), inArray(musicTracks.id, extraIds))),
    ] as unknown as Parameters<typeof db.batch>[0]);
    removed += extras.length;

    for (const r of extras) {
      await deleteObject(r.objectKey).catch(() => {});
      if (r.artworkKey && !(await artworkInUse(userId, r.artworkKey))) await deleteObject(r.artworkKey).catch(() => {});
    }
  }
  return removed;
}
