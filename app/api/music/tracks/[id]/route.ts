import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
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
  const changes = Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined));
  if (!Object.keys(changes).length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
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
