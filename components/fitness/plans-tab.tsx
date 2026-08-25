"use client";

import { useEffect, useState } from "react";
import { Plus, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api-client";
import { ExercisePicker } from "./exercise-picker";
import type { ExerciseRow, GoalRow, PlanDayRow, PlanDetail, PlanRow } from "@/lib/fitness/types";

export function PlansTab() {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [newOpen, setNewOpen] = useState(false);
  const [managingId, setManagingId] = useState<string | null>(null);

  function load() {
    apiFetch<{ plans: PlanRow[] }>("/api/fitness/plans")
      .then((res) => setPlans(res.plans))
      .catch(() => {});
  }

  useEffect(() => {
    load();
    apiFetch<{ goals: GoalRow[] }>("/api/fitness/goals")
      .then((res) => setGoals(res.goals))
      .catch(() => {});
  }, []);

  async function updateStatus(plan: PlanRow, status: PlanRow["status"]) {
    await apiFetch(`/api/fitness/plans/${plan.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    load();
  }

  async function remove(plan: PlanRow) {
    if (!confirm(`Delete plan "${plan.title}"? This removes its days and exercises too.`)) return;
    await apiFetch(`/api/fitness/plans/${plan.id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setNewOpen(true)}>
          <Plus className="h-4 w-4" />
          New plan
        </Button>
      </div>

      {plans.length === 0 ? (
        <p className="text-center text-sm text-neutral-500">
          No plans yet — build one to structure your training week.
        </p>
      ) : (
        <div className="space-y-3">
          {plans.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
            >
              <div>
                <p className="font-medium">{p.title}</p>
                <p className="text-xs capitalize text-neutral-500">{p.sportFocus}</p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={p.status}
                  onChange={(e) => updateStatus(p, e.target.value as PlanRow["status"])}
                  className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
                <Button variant="ghost" className="px-2" onClick={() => setManagingId(p.id)}>
                  <Settings2 className="h-4 w-4" />
                </Button>
                <button
                  onClick={() => remove(p)}
                  className="text-xs text-neutral-400 underline hover:text-red-500"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <NewPlanDialog
        open={newOpen}
        goals={goals}
        onClose={() => setNewOpen(false)}
        onCreated={(plan) => {
          setNewOpen(false);
          load();
          setManagingId(plan.id);
        }}
      />

      {managingId && (
        <PlanBuilder planId={managingId} onClose={() => setManagingId(null)} />
      )}
    </div>
  );
}

function NewPlanDialog({
  open,
  goals,
  onClose,
  onCreated,
}: {
  open: boolean;
  goals: GoalRow[];
  onClose: () => void;
  onCreated: (plan: PlanRow) => void;
}) {
  const [title, setTitle] = useState("");
  const [sportFocus, setSportFocus] = useState<PlanRow["sportFocus"]>("mixed");
  const [goalId, setGoalId] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { plan } = await apiFetch<{ plan: PlanRow }>("/api/fitness/plans", {
        method: "POST",
        body: JSON.stringify({ title, sportFocus, goalId: goalId || null }),
      });
      setTitle("");
      onCreated(plan);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="New training plan">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1">
          <label className="text-sm font-medium">Title</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Sport focus</label>
          <select
            value={sportFocus}
            onChange={(e) => setSportFocus(e.target.value as PlanRow["sportFocus"])}
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          >
            <option value="basketball">Basketball</option>
            <option value="lifting">Lifting</option>
            <option value="running">Running</option>
            <option value="biking">Biking</option>
            <option value="mixed">Mixed</option>
          </select>
        </div>
        {goals.length > 0 && (
          <div className="space-y-1">
            <label className="text-sm font-medium">Linked goal (optional)</label>
            <select
              value={goalId}
              onChange={(e) => setGoalId(e.target.value)}
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            >
              <option value="">None</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Creating..." : "Create & add days"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function PlanBuilder({ planId, onClose }: { planId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<PlanDetail | null>(null);
  const [newDayTitle, setNewDayTitle] = useState("");
  const [pickerForDay, setPickerForDay] = useState<string | null>(null);
  const [exerciseNames, setExerciseNames] = useState<Record<string, string>>({});

  function load() {
    apiFetch<PlanDetail>(`/api/fitness/plans/${planId}`).then(setDetail).catch(() => {});
  }

  useEffect(load, [planId]);

  useEffect(() => {
    if (!detail) return;
    const ids = new Set<string>();
    detail.days.forEach((d) => d.exercises.forEach((e) => ids.add(e.exerciseId)));
    const missing = [...ids].filter((id) => !exerciseNames[id]);
    if (missing.length === 0) return;
    Promise.all(
      missing.map((id) =>
        apiFetch<{ exercise: ExerciseRow }>(`/api/fitness/exercises/${id}`).then((r) => [id, r.exercise.name] as const),
      ),
    ).then((pairs) => setExerciseNames((prev) => ({ ...prev, ...Object.fromEntries(pairs) })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail]);

  async function addDay() {
    if (!newDayTitle.trim() || !detail) return;
    await apiFetch(`/api/fitness/plans/${planId}/days`, {
      method: "POST",
      body: JSON.stringify({ title: newDayTitle.trim(), sequenceNumber: detail.days.length }),
    });
    setNewDayTitle("");
    load();
  }

  async function removeDay(day: PlanDayRow) {
    if (!confirm(`Remove day "${day.title}"?`)) return;
    await apiFetch(`/api/fitness/plan-days/${day.id}`, { method: "DELETE" });
    load();
  }

  async function addExerciseToDay(dayId: string, exercise: ExerciseRow) {
    await apiFetch(`/api/fitness/plan-days/${dayId}/exercises`, {
      method: "POST",
      body: JSON.stringify({ exerciseId: exercise.id }),
    });
    load();
  }

  async function updateTarget(planDayExerciseId: string, field: string, value: string) {
    await apiFetch(`/api/fitness/plan-day-exercises/${planDayExerciseId}`, {
      method: "PATCH",
      body: JSON.stringify({ [field]: value === "" ? null : Number(value) }),
    });
  }

  async function removeExercise(planDayExerciseId: string) {
    await apiFetch(`/api/fitness/plan-day-exercises/${planDayExerciseId}`, { method: "DELETE" });
    load();
  }

  if (!detail) return null;

  return (
    <Dialog open onClose={onClose} title={`Build: ${detail.plan.title}`} className="max-w-2xl">
      <div className="space-y-4">
        {detail.days.map((day) => (
          <div key={day.id} className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">{day.title}</h3>
              <button
                onClick={() => removeDay(day)}
                className="text-xs text-neutral-400 underline hover:text-red-500"
              >
                Remove day
              </button>
            </div>
            <div className="space-y-1.5">
              {day.exercises.map((ex) => (
                <div key={ex.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="min-w-32 flex-1">{exerciseNames[ex.exerciseId] ?? "..."}</span>
                  <input
                    defaultValue={ex.targetSets ?? ""}
                    onBlur={(e) => updateTarget(ex.id, "targetSets", e.target.value)}
                    placeholder="sets"
                    className="w-14 rounded border border-neutral-300 px-1.5 py-0.5 text-xs dark:border-neutral-700 dark:bg-neutral-900"
                  />
                  <input
                    defaultValue={ex.targetReps ?? ""}
                    onBlur={(e) => updateTarget(ex.id, "targetReps", e.target.value)}
                    placeholder="reps"
                    className="w-14 rounded border border-neutral-300 px-1.5 py-0.5 text-xs dark:border-neutral-700 dark:bg-neutral-900"
                  />
                  <input
                    defaultValue={ex.targetWeight ?? ""}
                    onBlur={(e) => updateTarget(ex.id, "targetWeight", e.target.value)}
                    placeholder="lb"
                    className="w-14 rounded border border-neutral-300 px-1.5 py-0.5 text-xs dark:border-neutral-700 dark:bg-neutral-900"
                  />
                  <button
                    onClick={() => removeExercise(ex.id)}
                    className="text-xs text-neutral-400 hover:text-red-500"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <Button
              variant="ghost"
              className="mt-2 px-2 text-xs"
              onClick={() => setPickerForDay(day.id)}
            >
              <Plus className="h-3.5 w-3.5" />
              Add exercise
            </Button>
          </div>
        ))}

        <div className="flex gap-2">
          <Input
            value={newDayTitle}
            onChange={(e) => setNewDayTitle(e.target.value)}
            placeholder="New day title (e.g. Push Day)"
          />
          <Button variant="secondary" onClick={addDay}>
            Add day
          </Button>
        </div>
      </div>

      <ExercisePicker
        open={pickerForDay !== null}
        onClose={() => setPickerForDay(null)}
        onSelect={(ex) => pickerForDay && addExerciseToDay(pickerForDay, ex)}
      />
    </Dialog>
  );
}
