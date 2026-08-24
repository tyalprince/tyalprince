"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiFetch } from "@/lib/api-client";
import type { MonthlySummaryRow } from "@/lib/receipts/queries";

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function SummaryChart({ refreshKey }: { refreshKey: number }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [rows, setRows] = useState<MonthlySummaryRow[]>([]);

  useEffect(() => {
    apiFetch<{ rows: MonthlySummaryRow[] }>(`/api/receipts/summary?year=${year}`)
      .then((res) => setRows(res.rows))
      .catch(() => setRows([]));
  }, [year, refreshKey]);

  const byMonth = useMemo(() => {
    const totals = new Map<string, number>();
    for (const r of rows) {
      totals.set(r.month, (totals.get(r.month) ?? 0) + Number(r.total));
    }
    return Array.from({ length: 12 }, (_, i) => {
      const month = `${year}-${String(i + 1).padStart(2, "0")}`;
      return { month: MONTH_LABELS[i], total: Math.round((totals.get(month) ?? 0) * 100) / 100 };
    });
  }, [rows, year]);

  const byCategory = useMemo(() => {
    const totals = new Map<string, number>();
    for (const r of rows) {
      const key = r.category ?? "Uncategorized";
      totals.set(key, (totals.get(key) ?? 0) + Number(r.total));
    }
    return Array.from(totals.entries())
      .map(([category, total]) => ({ category, total: Math.round(total * 100) / 100 }))
      .sort((a, b) => b.total - a.total);
  }, [rows]);

  const yearTotal = byMonth.reduce((s, m) => s + m.total, 0);

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Yearly summary</h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Total for {year}:{" "}
            {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
              yearTotal,
            )}
          </p>
        </div>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        >
          {[year, year - 1, year - 2].map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={byMonth} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-neutral-200 dark:text-neutral-800" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="currentColor" className="text-neutral-500" />
            <YAxis tick={{ fontSize: 12 }} stroke="currentColor" className="text-neutral-500" width={48} />
            <Tooltip
              formatter={(value) => [`$${Number(value).toFixed(2)}`, "Total"]}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Bar dataKey="total" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {byCategory.length > 0 && (
        <table className="mt-4 w-full text-sm">
          <tbody>
            {byCategory.map((c) => (
              <tr key={c.category} className="border-t border-neutral-100 dark:border-neutral-900">
                <td className="py-1.5 text-neutral-600 dark:text-neutral-300">{c.category}</td>
                <td className="py-1.5 text-right font-medium">
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                  }).format(c.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
