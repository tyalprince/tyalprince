import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { vaultCategories } from "@/lib/db/schema";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { getUserVaultCategories } from "@/lib/vault/queries";
import { createVaultCategorySchema } from "@/lib/validation/vault";

export const GET = withApiErrors(async () => {
  const userId = await requireUserId();
  const categories = await getUserVaultCategories(userId);
  return NextResponse.json({ categories });
});

export const POST = withApiErrors(async (req: Request) => {
  const userId = await requireUserId();
  const body = createVaultCategorySchema.parse(await req.json());

  const [category] = await db
    .insert(vaultCategories)
    .values({ userId, ...body })
    .returning();

  return NextResponse.json({ category }, { status: 201 });
});
