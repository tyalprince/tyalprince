import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { driveItems } from "@/lib/db/schema";
import { requireUserId } from "@/lib/session";
import { HttpError, withApiErrors } from "@/lib/api-utils";
import { getItem, toDriveItem } from "@/lib/files/queries";
import { finishMultipart, objectSize, thumbnailObjectKey } from "@/lib/files/storage";
import { completeRequestSchema } from "@/lib/validation/files";

type Params = { params: Promise<{ id: string }> };

/** Marks an upload finished once storage has every byte of it. */
export const POST = withApiErrors(async (req: Request, { params }: Params) => {
  const userId = await requireUserId();
  const { id } = await params;
  const body = completeRequestSchema.parse(await req.json().catch(() => ({})));
  const item = await getItem(userId, id);
  if (!item?.objectKey) throw new HttpError(404, "Not found");
  if (!item.uploadedAt) {
    if (item.uploadId) {
      if (!(await finishMultipart(item.objectKey, item.uploadId, item.size))) throw new HttpError(409, "Some parts of the file are missing.");
    }
    const size = await objectSize(item.objectKey);
    if (size === null || size !== item.size) throw new HttpError(409, "The file didn't arrive in full.");
  }
  const thumbKey = thumbnailObjectKey(userId, id);
  const thumbnail = body.thumbnail && (await objectSize(thumbKey)) !== null;
  const [row] = await db
    .update(driveItems)
    .set({
      uploadedAt: item.uploadedAt ?? new Date(),
      uploadId: null,
      updatedAt: new Date(),
      ...(thumbnail ? { thumbnailKey: thumbKey } : {}),
    })
    .where(and(eq(driveItems.id, id), eq(driveItems.userId, userId)))
    .returning();
  return NextResponse.json({ item: toDriveItem(row) });
});
