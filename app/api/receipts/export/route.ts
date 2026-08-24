import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { getUserReceipts, type ReceiptFilters } from "@/lib/receipts/queries";
import { toCsv } from "@/lib/csv";
import { createReceiptDownloadUrl } from "@/lib/s3/presign";

export const GET = withApiErrors(async (req: Request) => {
  const userId = await requireUserId();
  const params = new URL(req.url).searchParams;

  const filters: ReceiptFilters = {
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
    category: params.get("category") ?? undefined,
    businessOrPersonal:
      (params.get("businessOrPersonal") as "business" | "personal" | null) ?? undefined,
  };

  const rows = await getUserReceipts(userId, filters);

  const csvRows = await Promise.all(
    rows.map(async (r) => {
      let link = "";
      try {
        link = await createReceiptDownloadUrl(r.s3Key);
      } catch {
        // S3 not configured in this environment — leave the link blank.
      }
      return [
        r.receiptDate ? r.receiptDate.toISOString().slice(0, 10) : "",
        r.vendorName ?? "",
        r.businessOrPersonal ?? "",
        r.category ?? "",
        r.subcategory ?? "",
        r.totalAmount ?? "",
        r.taxAmount ?? "",
        r.currency,
        r.notes ?? "",
        link,
      ];
    }),
  );

  const csv = toCsv(
    [
      "Date",
      "Vendor",
      "Business/Personal",
      "Category",
      "Subcategory",
      "Total",
      "Tax",
      "Currency",
      "Notes",
      "Receipt Link (expires in 15 min)",
    ],
    csvRows,
  );

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="receipts-${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`,
    },
  });
});
