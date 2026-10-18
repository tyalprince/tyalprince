import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { artworkInUse } from "@/lib/music/queries";
import { artworkObjectKey, presignUpload } from "@/lib/music/storage";
import { artworkRequestSchema } from "@/lib/validation/music";

const TYPES = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" } as const;

/** Album art is stored once per unique image (most tracks on an album share it). */
export const POST = withApiErrors(async (req: Request) => {
  const userId = await requireUserId();
  const { hash, ext } = artworkRequestSchema.parse(await req.json());
  const key = artworkObjectKey(userId, hash, ext);
  if (await artworkInUse(userId, key)) return NextResponse.json({ key, exists: true });
  return NextResponse.json({ key, exists: false, contentType: TYPES[ext], uploadUrl: await presignUpload(key, TYPES[ext]) });
});
