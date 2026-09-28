"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api-client";
import { isHomeFriendly, similarExercises } from "@/lib/fitness/generator";
import type { ExerciseRow } from "@/lib/fitness/types";

export function ExercisePicker({
  open,
  onClose,
  onSelect,
  swapFor,
  defaultHomeOnly = false,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (exercise: ExerciseRow) => void;
  /** When swapping, list same-muscle alternatives to this exercise first. */
  swapFor?: ExerciseRow | null;
  defaultHomeOnly?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [homeOnly, setHomeOnly] = useState(defaultHomeOnly);
  const [results, setResults] = useState<ExerciseRow[]>([]);

  useEffect(() => {
    if (!open) return;
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (category) params.set("category", category);
    const timer = setTimeout(() => {
      apiFetch<{ exercises: ExerciseRow[] }>(`/api/fitness/exercises?${params}`)
        .then((res) => setResults(res.exercises))
        .catch(() => setResults([]));
    }, 200);
    return () => clearTimeout(timer);
  }, [open, query, category]);

  if (!open) return null;

  const filtered = homeOnly ? results.filter(isHomeFriendly) : results;
  const similar = swapFor && !query && !category ? similarExercises(swapFor, filtered).slice(0, 12) : [];
  const similarIds = new Set(similar.map((e) => e.id));
  const rest = filtered.filter((e) => !similarIds.has(e.id)).slice(0, 50);

  const row = (ex: ExerciseRow) => (
    <button
      key={ex.id}
      onClick={() => {
        onSelect(ex);
        onClose();
      }}
      className="flex w-full items-center justify-between gap-2 border-b border-neutral-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800"
    >
      <span className="min-w-0">{ex.name}</span>
      <span className="shrink-0 text-xs capitalize text-neutral-400">{ex.equipment ?? ex.category}</span>
    </button>
  );

  return (
    <Dialog open={open} onClose={onClose} title={swapFor ? `Swap ${swapFor.name}` : "Choose an exercise"}>
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-neutral-400" />
            <Input
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
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={homeOnly} onChange={(e) => setHomeOnly(e.target.checked)} />
          Home equipment only
        </label>
        <div className="max-h-96 overflow-y-auto rounded-md border border-neutral-200 dark:border-neutral-800">
          {similar.length > 0 && (
            <>
              <p className="bg-neutral-50 px-3 py-1.5 text-xs font-medium text-neutral-500 dark:bg-neutral-800/60">
                Similar — works the same muscles
              </p>
              {similar.map(row)}
              <p className="bg-neutral-50 px-3 py-1.5 text-xs font-medium text-neutral-500 dark:bg-neutral-800/60">
                Everything else
              </p>
            </>
          )}
          {similar.length === 0 && rest.length === 0 ? (
            <p className="p-4 text-center text-sm text-neutral-500">No matches.</p>
          ) : (
            rest.map(row)
          )}
        </div>
      </div>
    </Dialog>
  );
}
