import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { receipts } from "@/lib/db/schema";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { getUserReceipt } from "@/lib/receipts/queries";
import { updateReceiptSchema } from "@/lib/validation/receipts";
import { createReceiptDownloadUrl } from "@/lib/s3/presign";

type Params = { params: Promise<{ id: string }> };

export const GET = withApiErrors(async (_req: Request, { params }: Params) => {
  const userId = await requireUserId();
  const { id } = await params;

  const receipt = await getUserReceipt(userId, id);
  if (!receipt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const downloadUrl = await createReceiptDownloadUrl(receipt.s3Key);
  return NextResponse.json({ receipt, downloadUrl });
});

export const PATCH = withApiErrors(async (req: Request, { params }: Params) => {
  const userId = await requireUserId();
  const { id } = await params;
  const body = updateReceiptSchema.parse(await req.json());

  const [receipt] = await db
    .update(receipts)
    .set({
      ...(body.vendorName !== undefined ? { vendorName: body.vendorName } : {}),
      ...(body.receiptDate !== undefined
        ? { receiptDate: body.receiptDate ? new Date(body.receiptDate) : null }
        : {}),
      ...(body.totalAmount !== undefined
        ? { totalAmount: body.totalAmount?.toString() ?? null }
        : {}),
      ...(body.taxAmount !== undefined
        ? { taxAmount: body.taxAmount?.toString() ?? null }
        : {}),
      ...(body.currency !== undefined ? { currency: body.currency } : {}),
      ...(body.businessOrPersonal !== undefined
        ? { businessOrPersonal: body.businessOrPersonal }
        : {}),
      ...(body.category !== undefined ? { category: body.category } : {}),
      ...(body.subcategory !== undefined ? { subcategory: body.subcategory } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      ...(body.lineItems !== undefined ? { lineItems: body.lineItems } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(receipts.id, id), eq(receipts.userId, userId)))
    .returning();

  if (!receipt) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ receipt });
});

export const DELETE = withApiErrors(async (_req: Request, { params }: Params) => {
  const userId = await requireUserId();
  const { id } = await params;

  const [receipt] = await db
    .delete(receipts)
    .where(and(eq(receipts.id, id), eq(receipts.userId, userId)))
    .returning({ id: receipts.id });

  if (!receipt) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
});
