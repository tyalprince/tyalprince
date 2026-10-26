import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { HttpError, withApiErrors } from "@/lib/api-utils";
import { getItem } from "@/lib/files/queries";
import { presignParts } from "@/lib/files/storage";
import { partsRequestSchema } from "@/lib/validation/files";

type Params = { params: Promise<{ id: string }> };

/** Upload URLs for parts of a big file. */
export const POST = withApiErrors(async (req: Request, { params }: Params) => {
  const userId = await requireUserId();
  const { id } = await params;
  const body = partsRequestSchema.parse(await req.json());
  const item = await getItem(userId, id);
  if (!item?.uploadId || !item.objectKey || item.uploadedAt) throw new HttpError(404, "That upload isn't in progress.");
  return NextResponse.json({ urls: await presignParts(item.objectKey, item.uploadId, body.partNumbers) });
});
