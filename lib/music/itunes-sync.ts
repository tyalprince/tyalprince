import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export type ItunesStat = {
  id: string;
  rating: number | null;
  playCount: number;
  skipCount: number;
  lastPlayedAt: string | null;
  addedAt: string | null;
  loved: boolean;
};

/**
 * Applies iTunes history to the user's tracks. Safe to run again: iTunes plays
 * replace the ones carried over last time (plays made in this app are kept on
 * top), ratings only fill songs not rated here yet, loved songs become liked.
 * Returns how many tracks were updated.
 */
export async function applyItunesStats(userId: string, stats: ItunesStat[]): Promise<number> {
  if (!stats.length) return 0;
  const values = sql.join(
    stats.map(
      (s) =>
        sql`(${s.id}::uuid, ${s.rating}::int, ${s.playCount}::int, ${s.skipCount}::int, ${s.lastPlayedAt}::timestamptz, ${s.addedAt}::timestamptz, ${s.loved}::boolean)`,
    ),
    sql`, `,
  );
  const result = await db.execute(sql`
    update music_tracks as t set
      play_count = greatest(0, t.play_count - t.imported_play_count) + v.plays,
      imported_play_count = v.plays,
      skip_count = greatest(t.skip_count, v.skips),
      rating = coalesce(t.rating, nullif(v.rating, 0)),
      last_played_at = greatest(t.last_played_at, v.last_played),
      added_at = coalesce(v.added, t.added_at),
      liked = t.liked or v.loved
    from (values ${values}) as v(id, rating, plays, skips, last_played, added, loved)
    where t.id = v.id and t.user_id = ${userId}
    returning t.id
  `);
  return result.rows.length;
}
