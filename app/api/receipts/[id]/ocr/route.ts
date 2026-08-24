import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { getUserReceipt, getUserVendorRules } from "@/lib/receipts/queries";
import { getReceiptObjectBuffer } from "@/lib/s3/presign";
import { runOcr } from "@/lib/ocr/run-ocr";
import { suggestCategory } from "@/lib/receipts/categorize";

type Params = { params: Promise<{ id: string }> };

// Runs OCR + rule-based categorization for a receipt and returns the
// suggestion for the user to review/correct — it does not save anything.
// The client presents this on an editable confirmation screen and only
// persists it via PATCH /api/receipts/:id once the user accepts it.
export const POST = withApiErrors(async (_req: Request, { params }: Params) => {
  const userId = await requireUserId();
  const { id } = await params;

  const receipt = await getUserReceipt(userId, id);
  if (!receipt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { buffer, contentType } = await getReceiptObjectBuffer(receipt.s3Key);
  const ocr = await runOcr(buffer, receipt.s3Key, contentType);

  const vendorName = ocr.parsedFields.vendorName;
  const rules = await getUserVendorRules(userId);
  const suggestion = suggestCategory(vendorName, rules);

  return NextResponse.json({
    rawText: ocr.rawText,
    confidence: ocr.confidence,
    fields: ocr.parsedFields,
    suggestion,
  });
});
