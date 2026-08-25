"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api-client";
import type { ExerciseRow } from "@/lib/fitness/types";

export function ExercisePicker({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (exercise: ExerciseRow) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [results, setResults] = useState<ExerciseRow[]>([]);

  useEffect(() => {
    if (!open) return;
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (category) params.set("category", category);
    const timer = setTimeout(() => {
      apiFetch<{ exercises: ExerciseRow[] }>(`/api/fitness/exercises?${params}`)
        .then((res) => setResults(res.exercises.slice(0, 50)))
        .catch(() => setResults([]));
    }, 200);
    return () => clearTimeout(timer);
  }, [open, query, category]);

  if (!open) return null;

  return (
    <Dialog open={open} onClose={onClose} title="Choose an exercise">
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-neutral-400" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search exercises..."
              className="pl-8"
            />
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-md border border-neutral-300 bg-white px-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          >
            <option value="">All</option>
            <option value="strength">Strength</option>
            <option value="cardio">Cardio</option>
            <option value="basketball">Basketball</option>
            <option value="cycling">Cycling</option>
            <option value="running">Running</option>
            <option value="mobility">Mobility</option>
          </select>
        </div>
        <div className="max-h-96 overflow-y-auto rounded-md border border-neutral-200 dark:border-neutral-800">
          {results.length === 0 ? (
            <p className="p-4 text-center text-sm text-neutral-500">No matches.</p>
          ) : (
            results.map((ex) => (
              <button
                key={ex.id}
                onClick={() => {
                  onSelect(ex);
                  onClose();
                }}
                className="flex w-full items-center justify-between border-b border-neutral-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-neutral-50 dark:border-neutral-900 dark:hover:bg-neutral-800"
              >
                <span>{ex.name}</span>
                <span className="text-xs capitalize text-neutral-400">{ex.category}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </Dialog>
  );
}
