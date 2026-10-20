import { and, desc, eq, gt, isNotNull, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { musicPlaylistTracks, musicPlaylists, musicTracks } from "@/lib/db/schema";
import { trackColumns } from "@/lib/music/queries";
import type { PlaylistSummary, Track } from "@/lib/music/types";

// The music section of the dashboard: what was played lately, the most played
// songs and recent playlists. Scoped to the user like every other query.

export type DashboardPlaylist = PlaylistSummary & { artworkKey: string | null };
export type MusicDashboard = { songCount: number; recent: Track[]; mostPlayed: Track[]; playlists: DashboardPlaylist[] };

export async function getMusicDashboard(userId: string): Promise<MusicDashboard> {
  const mine = eq(musicTracks.userId, userId);
  const [[count], recent, mostPlayed, playlists] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(musicTracks).where(mine),
    db.select(trackColumns).from(musicTracks).where(and(mine, isNotNull(musicTracks.lastPlayedAt))).orderBy(desc(musicTracks.lastPlayedAt)).limit(12),
    db.select(trackColumns).from(musicTracks).where(and(mine, gt(musicTracks.playCount, 0))).orderBy(desc(musicTracks.playCount)).limit(12),
    db
      .select({
        id: musicPlaylists.id,
        name: musicPlaylists.name,
        description: musicPlaylists.description,
        kind: musicPlaylists.kind,
        recipe: musicPlaylists.recipe,
        createdAt: musicPlaylists.createdAt,
        updatedAt: musicPlaylists.updatedAt,
        trackCount: sql<number>`(select count(*)::int from ${musicPlaylistTracks} where ${musicPlaylistTracks.playlistId} = ${musicPlaylists.id})`,
        // Cover of the first song that has one.
        artworkKey: sql<string | null>`(
          select t.artwork_key from ${musicPlaylistTracks} pt join ${musicTracks} t on t.id = pt.track_id
          where pt.playlist_id = ${musicPlaylists.id} and t.artwork_key is not null
          order by pt.position limit 1
        )`,
      })
      .from(musicPlaylists)
      .where(and(eq(musicPlaylists.userId, userId), ne(musicPlaylists.kind, "history")))
      .orderBy(desc(musicPlaylists.updatedAt))
      .limit(8),
  ]);
  // Dates → strings (as the API returns them); the similarity vector isn't needed to play.
  const json = <T,>(v: T) => JSON.parse(JSON.stringify(v, (k, val) => (k === "featureVector" ? null : val))) as T;
  return {
    songCount: count?.n ?? 0,
    recent: json(recent) as unknown as Track[],
    mostPlayed: json(mostPlayed) as unknown as Track[],
    playlists: json(playlists) as unknown as DashboardPlaylist[],
  };
}
