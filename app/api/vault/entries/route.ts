import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { vaultEntries } from "@/lib/db/schema";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { getUserVaultEntries } from "@/lib/vault/queries";
import { createVaultEntrySchema } from "@/lib/validation/vault";

export const GET = withApiErrors(async (req: Request) => {
  const userId = await requireUserId();
  const search = new URL(req.url).searchParams.get("q") ?? undefined;
  const entries = await getUserVaultEntries(userId, search);
  return NextResponse.json({ entries });
});

export const POST = withApiErrors(async (req: Request) => {
  const userId = await requireUserId();
  const body = createVaultEntrySchema.parse(await req.json());

  const [entry] = await db
    .insert(vaultEntries)
    .values({ userId, ...body })
    .returning();

  return NextResponse.json({ entry }, { status: 201 });
});
