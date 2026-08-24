"use client";

import { AlertCircle, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReceiptRow } from "@/lib/receipts/types";

function formatMoney(amount: string | null, currency: string) {
  if (amount === null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    Number(amount),
  );
}

export function ReceiptTable({
  receipts,
  onEdit,
  onDelete,
}: {
  receipts: ReceiptRow[];
  onEdit: (r: ReceiptRow) => void;
  onDelete: (r: ReceiptRow) => void;
}) {
  if (receipts.length === 0) {
    return (
      <p className="p-6 text-center text-sm text-neutral-500">
        No receipts match your filters.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500 dark:border-neutral-800">
            <th className="px-3 py-2 font-medium">Date</th>
            <th className="px-3 py-2 font-medium">Vendor</th>
            <th className="px-3 py-2 font-medium">Category</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 text-right font-medium">Total</th>
            <th className="px-3 py-2 text-right font-medium">Tax</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {receipts.map((r) => {
            const incomplete = !r.totalAmount || !r.category;
            return (
              <tr
                key={r.id}
                className="border-b border-neutral-100 last:border-b-0 dark:border-neutral-900"
              >
                <td className="whitespace-nowrap px-3 py-2">
                  {r.receiptDate ? r.receiptDate.slice(0, 10) : "—"}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    {incomplete && (
                      <span title="Missing total or category">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                      </span>
                    )}
                    <span className="truncate">{r.vendorName ?? "—"}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-neutral-500 dark:text-neutral-400">
                  {r.category ?? "—"}
                </td>
                <td className="px-3 py-2 capitalize text-neutral-500 dark:text-neutral-400">
                  {r.businessOrPersonal ?? "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-medium">
                  {formatMoney(r.totalAmount, r.currency)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-neutral-500 dark:text-neutral-400">
                  {formatMoney(r.taxAmount, r.currency)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  <Button variant="ghost" className="px-2" onClick={() => onEdit(r)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    className="px-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                    onClick={() => onDelete(r)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
