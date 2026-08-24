import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { receipts } from "@/lib/db/schema";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { getUserReceipts, type ReceiptFilters } from "@/lib/receipts/queries";
import { createReceiptSchema } from "@/lib/validation/receipts";

export const GET = withApiErrors(async (req: Request) => {
  const userId = await requireUserId();
  const params = new URL(req.url).searchParams;

  const filters: ReceiptFilters = {
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
    category: params.get("category") ?? undefined,
    businessOrPersonal:
      (params.get("businessOrPersonal") as "business" | "personal" | null) ?? undefined,
    vendor: params.get("vendor") ?? undefined,
    minAmount: params.get("minAmount") ? Number(params.get("minAmount")) : undefined,
    maxAmount: params.get("maxAmount") ? Number(params.get("maxAmount")) : undefined,
    search: params.get("q") ?? undefined,
  };

  const rows = await getUserReceipts(userId, filters);
  return NextResponse.json({ receipts: rows });
});

export const POST = withApiErrors(async (req: Request) => {
  const userId = await requireUserId();
  const body = createReceiptSchema.parse(await req.json());

  const [receipt] = await db
    .insert(receipts)
    .values({
      userId,
      s3Key: body.s3Key,
      vendorName: body.vendorName,
      receiptDate: body.receiptDate ? new Date(body.receiptDate) : null,
      totalAmount: body.totalAmount?.toString(),
      taxAmount: body.taxAmount?.toString(),
      currency: body.currency,
      businessOrPersonal: body.businessOrPersonal,
      category: body.category,
      subcategory: body.subcategory,
      notes: body.notes,
      ocrRawText: body.ocrRawText,
      ocrConfidence: body.ocrConfidence?.toString(),
      lineItems: body.lineItems,
    })
    .returning();

  return NextResponse.json({ receipt }, { status: 201 });
});
