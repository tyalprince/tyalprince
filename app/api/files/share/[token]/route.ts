import { NextResponse } from "next/server";
import { withApiErrors } from "@/lib/api-utils";
import { resolveShare, sharedItem } from "@/lib/files/share";
import { presignGet } from "@/lib/files/storage";

type Params = { params: Promise<{ token: string }> };

/** Public: the shared file (or a file inside a shared folder). ?item=<id>, ?download=1, ?thumb=1. */
export const GET = withApiErrors(async (req: Request, { params }: Params) => {
  const { token } = await params;
  const search = new URL(req.url).searchParams;
  const root = await resolveShare(token);
  const item = root && (await sharedItem(root, search.get("item")));
  if (!item || item.kind !== "file" || !item.objectKey || !item.uploadedAt) {
    return NextResponse.json({ error: "This link doesn't work any more." }, { status: 404 });
  }
  if (search.get("thumb") && item.thumbnailKey) {
    return NextResponse.redirect(await presignGet(item.thumbnailKey, { expiresIn: 60 * 60 }), 302);
  }
  const url = await presignGet(item.objectKey, {
    name: item.name,
    download: Boolean(search.get("download")),
    contentType: item.contentType,
    expiresIn: 60 * 60,
  });
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store" } });
});
