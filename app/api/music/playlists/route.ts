import { NextResponse } from "next/server";
import { and, desc, eq, notInArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { musicPlaylists } from "@/lib/db/schema";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { filterOwnedTrackIds, getUserPlaylists, replacePlaylistTracks } from "@/lib/music/queries";
import { playlistSchema } from "@/lib/validation/music";

// Mix history keeps the most recent generated mixes.
const HISTORY_LIMIT = 100;

async function pruneHistory(userId: string) {
  const keep = await db
    .select({ id: musicPlaylists.id })
    .from(musicPlaylists)
    .where(and(eq(musicPlaylists.userId, userId), eq(musicPlaylists.kind, "history")))
    .orderBy(desc(musicPlaylists.createdAt))
    .limit(HISTORY_LIMIT);
  if (keep.length < HISTORY_LIMIT) return;
  await db.delete(musicPlaylists).where(
    and(
      eq(musicPlaylists.userId, userId),
      eq(musicPlaylists.kind, "history"),
      notInArray(
        musicPlaylists.id,
        keep.map((k) => k.id),
      ),
    ),
  );
}

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
  if (body.kind === "history") await pruneHistory(userId);
  return NextResponse.json({ playlist }, { status: 201 });
});
