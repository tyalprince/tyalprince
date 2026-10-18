import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { getLyrics } from "@/lib/music/enrich";

type Params = { params: Promise<{ id: string }> };

export const maxDuration = 20;

/** Lyrics for a track (from its tags, else LRCLIB; cached after the first lookup). */
export const GET = withApiErrors(async (_req: Request, { params }: Params) => {
  const userId = await requireUserId();
  const { id } = await params;
  const lyrics = await getLyrics(userId, id);
  if (!lyrics) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(lyrics);
});
