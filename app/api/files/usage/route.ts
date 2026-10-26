import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { getUsage, purgeExpired } from "@/lib/files/queries";

export const GET = withApiErrors(async () => {
  const userId = await requireUserId();
  await purgeExpired(userId).catch((err) => console.error("Files: purge failed", err));
  return NextResponse.json({ usage: await getUsage(userId) });
});
