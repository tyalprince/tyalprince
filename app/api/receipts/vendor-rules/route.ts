import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { receiptVendorRules } from "@/lib/db/schema";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { getUserVendorRules } from "@/lib/receipts/queries";
import { createVendorRuleSchema } from "@/lib/validation/receipts";

export const GET = withApiErrors(async () => {
  const userId = await requireUserId();
  const rules = await getUserVendorRules(userId);
  return NextResponse.json({ rules });
});

// Called when the user corrects a category on the review screen, so future
// receipts from the same vendor auto-categorize correctly.
export const POST = withApiErrors(async (req: Request) => {
  const userId = await requireUserId();
  const body = createVendorRuleSchema.parse(await req.json());

  const [rule] = await db
    .insert(receiptVendorRules)
    .values({ userId, ...body })
    .returning();

  return NextResponse.json({ rule }, { status: 201 });
});
