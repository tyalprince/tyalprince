import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { verifyReleaseDate } from "@/lib/music/enrich";
import { trackColumns } from "@/lib/music/queries";

type Params = { params: Promise<{ id: string }> };

export const maxDuration = 20;

/** Checks the song's original release date against MusicBrainz and returns the updated track. */
export const POST = withApiErrors(async (_req: Request, { params }: Params) => {
  const userId = await requireUserId();
  const { id } = await params;
  const result = await verifyReleaseDate(userId, id);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { row, retryLater } = result;
  const track = Object.fromEntries(Object.keys(trackColumns).map((k) => [k, row[k as keyof typeof row]]));
  return NextResponse.json({ track, retryLater });
});
