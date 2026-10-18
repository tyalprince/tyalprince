import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { getExistingHashes } from "@/lib/music/queries";
import { audioExtension, audioObjectKey, presignUpload } from "@/lib/music/storage";
import { AUDIO_MIME } from "@/lib/music/formats";
import { uploadRequestSchema } from "@/lib/validation/music";

/**
 * Step 1 of an import batch: for each file (identified by its SHA-256), say
 * whether it's already in the library, or hand back a presigned URL so the
 * browser can PUT the audio straight to storage.
 */
export const POST = withApiErrors(async (req: Request) => {
  const userId = await requireUserId();
  const { files } = uploadRequestSchema.parse(await req.json());
  const existing = await getExistingHashes(userId, files.map((f) => f.contentHash));

  const results = await Promise.all(
    files.map(async (f) => {
      if (existing.has(f.contentHash)) return { contentHash: f.contentHash, status: "exists" as const };
      const ext = audioExtension(f.fileName);
      if (!ext) return { contentHash: f.contentHash, status: "unsupported" as const };
      const key = audioObjectKey(userId, f.contentHash, ext);
      // Derived from the extension, never the client's claim, so storage only ever serves audio types.
      const contentType = AUDIO_MIME[ext];
      return { contentHash: f.contentHash, status: "upload" as const, key, contentType, uploadUrl: await presignUpload(key, contentType) };
    }),
  );
  return NextResponse.json({ results });
});
