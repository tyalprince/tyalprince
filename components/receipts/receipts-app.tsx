"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { UploadPanel } from "./upload-panel";
import { ReviewDialog } from "./review-dialog";
import { ReceiptTable } from "./receipt-table";
import { FilterBar } from "./filter-bar";
import { SummaryChart } from "./summary-chart";
import type { ReceiptRow } from "@/lib/receipts/types";
import type { ReceiptFilters } from "@/lib/receipts/queries";
import type { ParsedReceiptFields } from "@/lib/ocr/parse-fields";
import type { CategorySuggestion } from "@/lib/receipts/categorize";

type QueueItem = {
  receipt: ReceiptRow;
  fields: ParsedReceiptFields;
  suggestion: CategorySuggestion;
  confidence: number | null;
};

export function ReceiptsApp() {
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [filters, setFilters] = useState<ReceiptFilters>({});
  const [uploading, setUploading] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function loadReceipts() {
    const params = new URLSearchParams();
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (filters.category) params.set("category", filters.category);
    if (filters.businessOrPersonal)
      params.set("businessOrPersonal", filters.businessOrPersonal);
    if (filters.search) params.set("q", filters.search);

    const { receipts: rows } = await apiFetch<{ receipts: ReceiptRow[] }>(
      `/api/receipts?${params.toString()}`,
    );
    setReceipts(rows);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadReceipts().catch((err) =>
      setError(err instanceof Error ? err.message : "Failed to load receipts."),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  async function handleFiles(files: File[]) {
    setUploading(true);
    setError(null);
    const newItems: QueueItem[] = [];
    try {
      for (const file of files) {
        const { uploadUrl, key } = await apiFetch<{ uploadUrl: string; key: string }>(
          "/api/receipts/presign-upload",
          {
            method: "POST",
            body: JSON.stringify({ fileName: file.name, contentType: file.type }),
          },
        );

        await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });

        const { receipt } = await apiFetch<{ receipt: ReceiptRow }>("/api/receipts", {
          method: "POST",
          body: JSON.stringify({ s3Key: key }),
        });

        const ocr = await apiFetch<{
          rawText: string;
          confidence: number | null;
          fields: ParsedReceiptFields;
          suggestion: CategorySuggestion;
        }>(`/api/receipts/${receipt.id}/ocr`, { method: "POST" });

        newItems.push({
          receipt,
          fields: ocr.fields,
          suggestion: ocr.suggestion,
          confidence: ocr.confidence,
        });
      }
      setQueue((prev) => [...prev, ...newItems]);
      await loadReceipts();
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(r: ReceiptRow) {
    if (!confirm(`Delete the receipt from ${r.vendorName ?? "this vendor"}?`)) return;
    await apiFetch(`/api/receipts/${r.id}`, { method: "DELETE" });
    setReceipts((prev) => prev.filter((x) => x.id !== r.id));
    setRefreshKey((k) => k + 1);
  }

  const [editing, setEditing] = useState<ReceiptRow | null>(null);

  const current = queue[0];

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Receipts</h1>
        <a
          href={(() => {
            const params = new URLSearchParams();
            if (filters.from) params.set("from", filters.from);
            if (filters.to) params.set("to", filters.to);
            if (filters.category) params.set("category", filters.category);
            if (filters.businessOrPersonal)
              params.set("businessOrPersonal", filters.businessOrPersonal);
            return `/api/receipts/export?${params.toString()}`;
          })()}
        >
          <Button variant="secondary">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </a>
      </div>

      <UploadPanel onFiles={handleFiles} busy={uploading} />

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <SummaryChart refreshKey={refreshKey} />

      <div className="rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="border-b border-neutral-200 p-4 dark:border-neutral-800">
          <FilterBar filters={filters} onChange={setFilters} />
        </div>
        <ReceiptTable receipts={receipts} onEdit={setEditing} onDelete={handleDelete} />
      </div>

      {current && (
        <ReviewDialog
          receipt={current.receipt}
          fields={current.fields}
          suggestion={current.suggestion}
          confidence={current.confidence}
          queuePosition={{ index: 0, total: queue.length }}
          onSaved={(saved) => {
            setReceipts((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
            setQueue((prev) => prev.slice(1));
            setRefreshKey((k) => k + 1);
          }}
          onSkip={() => setQueue((prev) => prev.slice(1))}
        />
      )}

      {editing && (
        <ReviewDialog
          receipt={editing}
          fields={{
            vendorName: editing.vendorName,
            date: editing.receiptDate ? editing.receiptDate.slice(0, 10) : null,
            totalAmount: editing.totalAmount ? Number(editing.totalAmount) : null,
            taxAmount: editing.taxAmount ? Number(editing.taxAmount) : null,
            lineItems: editing.lineItems ?? [],
          }}
          suggestion={{
            category: editing.category ?? "Other",
            businessOrPersonal: editing.businessOrPersonal ?? "personal",
            source: "default",
          }}
          confidence={null}
          onSaved={(saved) => {
            setReceipts((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
            setEditing(null);
            setRefreshKey((k) => k + 1);
          }}
          onSkip={() => setEditing(null)}
        />
      )}
    </div>
  );
}
