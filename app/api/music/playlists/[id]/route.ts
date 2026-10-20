import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { musicPlaylists } from "@/lib/db/schema";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { filterOwnedTrackIds, getUserPlaylist, replacePlaylistTracks } from "@/lib/music/queries";
import { updatePlaylistSchema } from "@/lib/validation/music";

type Params = { params: Promise<{ id: string }> };

export const GET = withApiErrors(async (_req: Request, { params }: Params) => {
  const userId = await requireUserId();
  const { id } = await params;
  const detail = await getUserPlaylist(userId, id);
  if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(detail);
});

export const PATCH = withApiErrors(async (req: Request, { params }: Params) => {
  const userId = await requireUserId();
  const { id } = await params;
  const body = updatePlaylistSchema.parse(await req.json());
  const [playlist] = await db
    .update(musicPlaylists)
    .set({
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.recipe !== undefined ? { recipe: body.recipe } : {}),
      ...(body.kind !== undefined ? { kind: body.kind } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(musicPlaylists.id, id), eq(musicPlaylists.userId, userId)))
    .returning();
  if (!playlist) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (body.trackIds) await replacePlaylistTracks(id, await filterOwnedTrackIds(userId, body.trackIds));
  return NextResponse.json({ playlist });
});

export const DELETE = withApiErrors(async (_req: Request, { params }: Params) => {
  const userId = await requireUserId();
  const { id } = await params;
  const [row] = await db
    .delete(musicPlaylists)
    .where(and(eq(musicPlaylists.id, id), eq(musicPlaylists.userId, userId)))
    .returning({ id: musicPlaylists.id });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
});
