import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { songYearsSchema } from "@/lib/validation/music";

/**
 * Sets songs' years from the user's own knowledge (their year playlists).
 * These are locked (external.yearFromUser) so automatic date lookups leave them alone.
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
      year = v.year,
      release_date = case when left(coalesce(t.release_date, ''), 4) = v.year::text then t.release_date else v.year::text end,
      external = coalesce(t.external, '{}'::jsonb) || '{"yearFromUser":"1","mbDateChecked":"1"}'::jsonb
    from (values ${values}) as v(id, year)
    where t.id = v.id and t.user_id = ${userId}
    returning t.id
  `);
  return NextResponse.json({ updated: result.rows.length });
});
