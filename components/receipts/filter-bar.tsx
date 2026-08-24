"use client";

import { Input } from "@/components/ui/input";
import { DEFAULT_EXPENSE_CATEGORIES } from "@/lib/receipts/categories";
import type { ReceiptFilters } from "@/lib/receipts/queries";

export function FilterBar({
  filters,
  onChange,
}: {
  filters: ReceiptFilters;
  onChange: (next: ReceiptFilters) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <label className="text-xs text-neutral-500">From</label>
        <Input
          type="date"
          value={filters.from ?? ""}
          onChange={(e) => onChange({ ...filters, from: e.target.value || undefined })}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-neutral-500">To</label>
        <Input
          type="date"
          value={filters.to ?? ""}
          onChange={(e) => onChange({ ...filters, to: e.target.value || undefined })}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-neutral-500">Category</label>
        <select
          value={filters.category ?? ""}
          onChange={(e) =>
            onChange({ ...filters, category: e.target.value || undefined })
          }
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        >
          <option value="">All categories</option>
          {DEFAULT_EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-neutral-500">Type</label>
        <select
          value={filters.businessOrPersonal ?? ""}
          onChange={(e) =>
            onChange({
              ...filters,
              businessOrPersonal:
                (e.target.value as "business" | "personal" | "") || undefined,
            })
          }
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        >
          <option value="">Business + Personal</option>
          <option value="business">Business</option>
          <option value="personal">Personal</option>
        </select>
      </div>
      <div className="min-w-[10rem] flex-1 space-y-1">
        <label className="text-xs text-neutral-500">Search vendor / OCR text</label>
        <Input
          value={filters.search ?? ""}
          onChange={(e) => onChange({ ...filters, search: e.target.value || undefined })}
          placeholder="e.g. Home Depot"
        />
      </div>
    </div>
  );
}
