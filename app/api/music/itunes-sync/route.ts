import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { applyItunesStats } from "@/lib/music/itunes-sync";
import { itunesStatsSchema } from "@/lib/validation/music";

/** Carries ratings, play counts, play dates and loved songs over from an iTunes export. */
export const POST = withApiErrors(async (req: Request) => {
  const userId = await requireUserId();
  const { stats } = itunesStatsSchema.parse(await req.json());
  return NextResponse.json({ updated: await applyItunesStats(userId, stats) });
});
