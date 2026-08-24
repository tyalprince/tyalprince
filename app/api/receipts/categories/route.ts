import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { receiptCategories } from "@/lib/db/schema";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { getUserReceiptCategories } from "@/lib/receipts/queries";
import { createReceiptCategorySchema } from "@/lib/validation/receipts";

export const GET = withApiErrors(async () => {
  const userId = await requireUserId();
  const categories = await getUserReceiptCategories(userId);
  return NextResponse.json({ categories });
});

export const POST = withApiErrors(async (req: Request) => {
  const userId = await requireUserId();
  const body = createReceiptCategorySchema.parse(await req.json());

  const [category] = await db
    .insert(receiptCategories)
    .values({ userId, ...body })
    .returning();

  return NextResponse.json({ category }, { status: 201 });
});
