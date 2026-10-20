import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { songYearsSchema } from "@/lib/validation/music";

/**
 * Years from the user's year playlists. Apple builds those from each song's
 * Year field, which can be a re-release year, so they count like a file's year
 * tag: the song's date only moves earlier, never later, and nothing is locked.
 * Songs whose year was set by hand (Edit / Refresh details) are left alone.
 */
export const POST = withApiErrors(async (req: Request) => {
  const userId = await requireUserId();
  const { years } = songYearsSchema.parse(await req.json());
  const values = sql.join(
    years.map((y) => sql`(${y.id}::uuid, ${y.year}::int)`),
    sql`, `,
  );
  const result = await db.execute(sql`
    update music_tracks as t set
      year = least(coalesce(t.year, v.year), v.year),
      release_date = case
        when t.release_date ~ '^[0-9]{4}' and left(t.release_date, 4)::int <= v.year then t.release_date
        else v.year::text
      end
    from (values ${values}) as v(id, year)
    where t.id = v.id and t.user_id = ${userId} and not coalesce(t.external ? 'yearFromUser', false)
    returning t.id
  `);
  return NextResponse.json({ updated: result.rows.length });
});
