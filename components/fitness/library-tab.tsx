"use client";

import { useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api-client";
import type { ExerciseCategory, ExerciseRow } from "@/lib/fitness/types";

export function LibraryTab() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [muscleGroup, setMuscleGroup] = useState("");
  const [results, setResults] = useState<ExerciseRow[]>([]);
  const [newOpen, setNewOpen] = useState(false);

  function load() {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (category) params.set("category", category);
    if (muscleGroup) params.set("muscleGroup", muscleGroup);
    apiFetch<{ exercises: ExerciseRow[] }>(`/api/fitness/exercises?${params}`)
      .then((res) => setResults(res.exercises))
      .catch(() => setResults([]));
  }

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, category, muscleGroup]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[10rem] flex-1">
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
          className="rounded-md border border-neutral-300 bg-white px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        >
          <option value="">All categories</option>
          <option value="strength">Strength</option>
          <option value="cardio">Cardio</option>
          <option value="basketball">Basketball</option>
          <option value="cycling">Cycling</option>
          <option value="running">Running</option>
          <option value="mobility">Mobility</option>
        </select>
        <Input
          value={muscleGroup}
          onChange={(e) => setMuscleGroup(e.target.value)}
          placeholder="Muscle group"
          className="w-36"
        />
        <Button variant="secondary" onClick={() => setNewOpen(true)}>
          <Plus className="h-4 w-4" />
          Custom exercise
        </Button>
      </div>

      <p className="text-xs text-neutral-500">{results.length} exercises</p>

      <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
        {results.map((ex) => (
          <div
            key={ex.id}
            className="border-b border-neutral-100 px-4 py-3 last:border-b-0 dark:border-neutral-900"
          >
            <div className="flex items-center justify-between">
              <p className="font-medium">
                {ex.name}
                {ex.isCustom && (
                  <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] uppercase text-neutral-500 dark:bg-neutral-800">
                    Custom
                  </span>
                )}
              </p>
              <span className="text-xs capitalize text-neutral-400">{ex.category}</span>
            </div>
            {(ex.muscleGroups.length > 0 || ex.equipment) && (
              <p className="mt-0.5 text-xs text-neutral-500">
                {[ex.equipment, ex.muscleGroups.join(", ")].filter(Boolean).join(" · ")}
              </p>
            )}
            {ex.instructions && (
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                {ex.instructions}
              </p>
            )}
          </div>
        ))}
      </div>

      <NewExerciseDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={() => {
          setNewOpen(false);
          load();
        }}
      />
    </div>
  );
}

function NewExerciseDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ExerciseCategory>("strength");
  const [muscleGroups, setMuscleGroups] = useState("");
  const [equipment, setEquipment] = useState("");
  const [instructions, setInstructions] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await apiFetch("/api/fitness/exercises", {
        method: "POST",
        body: JSON.stringify({
          name,
          category,
          muscleGroups: muscleGroups
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          equipment: equipment || null,
          instructions: instructions || null,
        }),
      });
      setName("");
      setMuscleGroups("");
      setEquipment("");
      setInstructions("");
      onCreated();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Add custom exercise">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1">
          <label className="text-sm font-medium">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ExerciseCategory)}
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          >
            <option value="strength">Strength</option>
            <option value="cardio">Cardio</option>
            <option value="basketball">Basketball</option>
            <option value="cycling">Cycling</option>
            <option value="running">Running</option>
            <option value="mobility">Mobility</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Muscle groups (comma-separated)</label>
          <Input value={muscleGroups} onChange={(e) => setMuscleGroups(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Equipment</label>
          <Input value={equipment} onChange={(e) => setEquipment(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Instructions</label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving..." : "Save"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
