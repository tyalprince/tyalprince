import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { musicPlaylists } from "@/lib/db/schema";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { filterOwnedTrackIds, getUserPlaylists, replacePlaylistTracks } from "@/lib/music/queries";
import { playlistSchema } from "@/lib/validation/music";

export const GET = withApiErrors(async () => {
  const userId = await requireUserId();
  return NextResponse.json({ playlists: await getUserPlaylists(userId) });
});

export const POST = withApiErrors(async (req: Request) => {
  const userId = await requireUserId();
  const body = playlistSchema.parse(await req.json());
  const [playlist] = await db
    .insert(musicPlaylists)
    .values({ userId, name: body.name, description: body.description ?? null, kind: body.kind, recipe: body.recipe ?? null })
    .returning();
  await replacePlaylistTracks(playlist.id, await filterOwnedTrackIds(userId, body.trackIds));
  return NextResponse.json({ playlist }, { status: 201 });
});
