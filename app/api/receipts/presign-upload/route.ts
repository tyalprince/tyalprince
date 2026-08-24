import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { presignUploadSchema } from "@/lib/validation/receipts";
import { buildReceiptObjectKey, createReceiptUploadUrl } from "@/lib/s3/presign";

// Raw AWS credentials never reach the browser — the client gets a
// short-lived presigned PUT URL and uploads directly to S3.
export const POST = withApiErrors(async (req: Request) => {
  const userId = await requireUserId();
  const { fileName, contentType } = presignUploadSchema.parse(await req.json());

  const key = buildReceiptObjectKey(userId, fileName);
  const { uploadUrl } = await createReceiptUploadUrl({ key, contentType });

  return NextResponse.json({ uploadUrl, key });
});
