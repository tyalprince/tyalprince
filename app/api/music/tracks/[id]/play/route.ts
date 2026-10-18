import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { musicTracks } from "@/lib/db/schema";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

/** Counts a play (the player calls this once a track has played for a bit). */
export const POST = withApiErrors(async (_req: Request, { params }: Params) => {
  const userId = await requireUserId();
  const { id } = await params;
  const [row] = await db
    .update(musicTracks)
    .set({ playCount: sql`${musicTracks.playCount} + 1`, lastPlayedAt: new Date() })
    .where(and(eq(musicTracks.id, id), eq(musicTracks.userId, userId)))
    .returning({ playCount: musicTracks.playCount });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
});
