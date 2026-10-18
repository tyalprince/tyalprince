import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { getUserTrack } from "@/lib/music/queries";
import { presignDownload } from "@/lib/music/storage";

type Params = { params: Promise<{ id: string }> };

/** Redirects the <audio> element to a presigned URL; the bucket serves Range requests for seeking. */
export const GET = withApiErrors(async (_req: Request, { params }: Params) => {
  const userId = await requireUserId();
  const { id } = await params;
  const track = await getUserTrack(userId, id);
  if (!track) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.redirect(await presignDownload(track.objectKey), {
    status: 302,
    headers: { "Cache-Control": "private, max-age=3600" },
  });
});
