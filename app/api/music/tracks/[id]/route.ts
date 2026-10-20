import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { musicTracks } from "@/lib/db/schema";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { artworkInUse, getUserTrack, trackColumns } from "@/lib/music/queries";
import { deleteObject } from "@/lib/music/storage";
import { updateTrackSchema } from "@/lib/validation/music";

type Params = { params: Promise<{ id: string }> };

export const PATCH = withApiErrors(async (req: Request, { params }: Params) => {
  const userId = await requireUserId();
  const { id } = await params;
  const body = updateTrackSchema.parse(await req.json());
  const changes: Record<string, unknown> = Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined));
  if (!Object.keys(changes).length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  // A year typed in by the user wins over looked-up dates, and stays put.
  if (typeof body.year === "number") {
    changes.releaseDate = sql`case when left(coalesce(${musicTracks.releaseDate}, ''), 4) = ${String(body.year)} then ${musicTracks.releaseDate} else ${String(body.year)} end`;
    changes.external = sql`coalesce(${musicTracks.external}, '{}'::jsonb) || '{"yearFromUser":"1","yearSource":"edit","mbDateChecked":"1"}'::jsonb`;
  }
  const [track] = await db
    .update(musicTracks)
    .set(changes)
    .where(and(eq(musicTracks.id, id), eq(musicTracks.userId, userId)))
    .returning(trackColumns);
  if (!track) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ track });
});

/** Removes the track and its audio file (and its artwork once nothing else uses it). */
export const DELETE = withApiErrors(async (_req: Request, { params }: Params) => {
  const userId = await requireUserId();
  const { id } = await params;
  const track = await getUserTrack(userId, id);
  if (!track) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.delete(musicTracks).where(and(eq(musicTracks.id, id), eq(musicTracks.userId, userId)));
  await deleteObject(track.objectKey).catch(() => {});
  if (track.artworkKey && !(await artworkInUse(userId, track.artworkKey))) {
    await deleteObject(track.artworkKey).catch(() => {});
  }
  return NextResponse.json({ ok: true });
});
