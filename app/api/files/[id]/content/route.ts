import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { getItem } from "@/lib/files/queries";
import { presignGet } from "@/lib/files/storage";

type Params = { params: Promise<{ id: string }> };

/** Redirects to the file in storage: ?download=1 saves it, ?thumb=1 gives the preview image. */
export const GET = withApiErrors(async (req: Request, { params }: Params) => {
  const userId = await requireUserId();
  const { id } = await params;
  const search = new URL(req.url).searchParams;
  const item = await getItem(userId, id);
  if (!item?.objectKey || !item.uploadedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (search.get("thumb")) {
    if (!item.thumbnailKey) return NextResponse.json({ error: "No preview" }, { status: 404 });
    const url = await presignGet(item.thumbnailKey, { expiresIn: 60 * 60 * 24 });
    return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, max-age=43200" } });
  }
  const url = await presignGet(item.objectKey, {
    name: item.name,
    download: Boolean(search.get("download")),
    contentType: item.contentType,
    expiresIn: 60 * 60 * 6,
  });
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, max-age=3600" } });
});
