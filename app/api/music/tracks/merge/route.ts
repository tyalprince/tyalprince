import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { mergeDuplicates } from "@/lib/music/merge";
import { mergeDuplicatesSchema } from "@/lib/validation/music";

export const maxDuration = 60;

/** Keeps one copy of each duplicated song and removes the rest (playlists, likes and plays carry over). */
export const POST = withApiErrors(async (req: Request) => {
  const userId = await requireUserId();
  const { groups } = mergeDuplicatesSchema.parse(await req.json());
  const removed = await mergeDuplicates(userId, groups);
  return NextResponse.json({ removed });
});
