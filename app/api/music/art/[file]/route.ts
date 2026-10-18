import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { artworkObjectKey, presignDownload } from "@/lib/music/storage";

type Params = { params: Promise<{ file: string }> };

/** /api/music/art/<sha256>.<ext> → redirect to a presigned image URL. No DB lookup needed. */
export const GET = withApiErrors(async (_req: Request, { params }: Params) => {
  const userId = await requireUserId();
  const { file } = await params;
  const match = /^([a-f0-9]{64})\.(jpg|png|webp)$/.exec(file);
  if (!match) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const url = await presignDownload(artworkObjectKey(userId, match[1], match[2] as "jpg" | "png" | "webp"), 60 * 60 * 24);
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, max-age=43200" } });
});
