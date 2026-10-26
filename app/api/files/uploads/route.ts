import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { registerUploads } from "@/lib/files/uploads";
import { uploadRequestSchema } from "@/lib/validation/files";

/** Registers files to upload and returns where to send each one (the bytes go straight to storage). */
export const POST = withApiErrors(async (req: Request) => {
  const userId = await requireUserId();
  const body = uploadRequestSchema.parse(await req.json());
  return NextResponse.json({ tickets: await registerUploads(userId, body.parentId, body.files) });
});
