import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { isMusicStorageConfigured } from "@/lib/music/storage";

/** Lets the Music tab show setup instructions instead of failing uploads. */
export const GET = withApiErrors(async () => {
  await requireUserId();
  return NextResponse.json({ storageConfigured: isMusicStorageConfigured() });
});
