import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { vaultEntries } from "@/lib/db/schema";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { updateVaultEntrySchema } from "@/lib/validation/vault";

type Params = { params: Promise<{ id: string }> };

export const PATCH = withApiErrors(async (req: Request, { params }: Params) => {
  const userId = await requireUserId();
  const { id } = await params;
  const body = updateVaultEntrySchema.parse(await req.json());

  const { lastUsedAt, ...rest } = body;

  const [entry] = await db
    .update(vaultEntries)
    .set({
      ...rest,
      ...(lastUsedAt ? { lastUsedAt: new Date(lastUsedAt) } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(vaultEntries.id, id), eq(vaultEntries.userId, userId)))
    .returning();

  if (!entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ entry });
});

export const DELETE = withApiErrors(async (_req: Request, { params }: Params) => {
  const userId = await requireUserId();
  const { id } = await params;

  const [entry] = await db
    .delete(vaultEntries)
    .where(and(eq(vaultEntries.id, id), eq(vaultEntries.userId, userId)))
    .returning({ id: vaultEntries.id });

  if (!entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
});
