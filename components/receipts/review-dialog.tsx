"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { DEFAULT_EXPENSE_CATEGORIES } from "@/lib/receipts/categories";
import type { ReceiptRow } from "@/lib/receipts/types";
import type { CategorySuggestion } from "@/lib/receipts/categorize";
import type { ParsedReceiptFields } from "@/lib/ocr/parse-fields";

export function ReviewDialog({
  receipt,
  fields,
  suggestion,
  confidence,
  queuePosition,
  onSaved,
  onSkip,
}: {
  receipt: ReceiptRow;
  fields: ParsedReceiptFields;
  suggestion: CategorySuggestion;
  confidence: number | null;
  queuePosition?: { index: number; total: number };
  onSaved: (receipt: ReceiptRow) => void;
  onSkip: () => void;
}) {
  const [vendorName, setVendorName] = useState(fields.vendorName ?? "");
  const [date, setDate] = useState(fields.date ?? "");
  const [total, setTotal] = useState(fields.totalAmount?.toString() ?? "");
  const [tax, setTax] = useState(fields.taxAmount?.toString() ?? "");
  const [businessOrPersonal, setBusinessOrPersonal] = useState(
    suggestion.businessOrPersonal,
  );
  const [category, setCategory] = useState(suggestion.category);
  const [notes, setNotes] = useState("");
  const [rememberVendor, setRememberVendor] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { receipt: saved } = await apiFetch<{ receipt: ReceiptRow }>(
        `/api/receipts/${receipt.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            vendorName: vendorName || null,
            receiptDate: date || null,
            totalAmount: total ? Number(total) : null,
            taxAmount: tax ? Number(tax) : null,
            businessOrPersonal,
            category: category || null,
            notes: notes || null,
          }),
        },
      );

      if (rememberVendor && vendorName.trim()) {
        await apiFetch("/api/receipts/vendor-rules", {
          method: "POST",
          body: JSON.stringify({
            vendorPattern: vendorName.trim().toLowerCase(),
            defaultCategory: category,
            defaultBusinessFlag: businessOrPersonal,
          }),
        }).catch(() => {});
      }

      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save receipt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onSkip}
      title={
        queuePosition
          ? `Review receipt (${queuePosition.index + 1} of ${queuePosition.total})`
          : "Review receipt"
      }
    >
      <form onSubmit={handleSave} className="space-y-3">
        {confidence !== null && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            OCR confidence: {Math.round(confidence * 100)}% — please verify these
            fields before saving.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1">
            <label className="text-sm font-medium">Vendor</label>
            <Input value={vendorName} onChange={(e) => setVendorName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Date</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Total</label>
            <Input
              type="number"
              step="0.01"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Tax</label>
            <Input
              type="number"
              step="0.01"
              value={tax}
              onChange={(e) => setTax(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Business / Personal</label>
            <select
              value={businessOrPersonal}
              onChange={(e) =>
                setBusinessOrPersonal(e.target.value as "business" | "personal")
              }
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            >
              <option value="business">Business</option>
              <option value="personal">Personal</option>
            </select>
          </div>
          <div className="col-span-2 space-y-1">
            <label className="text-sm font-medium">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            >
              {DEFAULT_EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2 space-y-1">
            <label className="text-sm font-medium">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
          <input
            type="checkbox"
            checked={rememberVendor}
            onChange={(e) => setRememberVendor(e.target.checked)}
            className="h-3.5 w-3.5"
          />
          Remember this category for future receipts from &quot;{vendorName || "this vendor"}&quot;
        </label>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onSkip}>
            Skip for now
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving..." : "Save receipt"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
