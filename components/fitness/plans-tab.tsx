"use client";

import { useEffect, useState } from "react";
import { BarChart3, Pencil, Plus, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api-client";
import { ExercisePicker } from "./exercise-picker";
import { PlanWizard } from "./plan-wizard";
import { PlanReviewView } from "./plan-review";
import { PlanScheduleEditor } from "./plan-schedule-editor";
import { NEUTRAL_FOCUS, cardClass, draftsToPayload, formatDay, planDaysToDrafts, useExerciseLibrary } from "./shared";
import type { DraftDay, ExerciseRow, PlanDayRow, PlanDetail, PlanRow } from "@/lib/fitness/types";

type View = { kind: "list" } | { kind: "wizard" } | { kind: "review"; id: string } | { kind: "edit"; id: string };

export function PlansTab() {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [view, setView] = useState<View>({ kind: "list" });
  const [legacyId, setLegacyId] = useState<string | null>(null);

  function load() {
    apiFetch<{ plans: PlanRow[] }>("/api/fitness/plans")
      .then((res) => setPlans(res.plans))
      .catch(() => {});
  }

  useEffect(load, []);

  async function updateStatus(plan: PlanRow, status: PlanRow["status"]) {
    await apiFetch(`/api/fitness/plans/${plan.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    load();
  }

  async function remove(plan: PlanRow) {
    if (!confirm(`Delete plan "${plan.title}"? Its schedule is removed; logged workouts stay in your history.`)) return;
    await apiFetch(`/api/fitness/plans/${plan.id}`, { method: "DELETE" });
    load();
  }

  const backToList = () => {
    setView({ kind: "list" });
    load();
  };

  if (view.kind === "wizard") return <PlanWizard onCancel={backToList} onCreated={backToList} />;
  if (view.kind === "review") return <PlanReviewView planId={view.id} onBack={backToList} />;
  if (view.kind === "edit") return <ScheduleEditorScreen planId={view.id} onDone={backToList} />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setView({ kind: "wizard" })}>
          <Plus className="h-4 w-4" />
          New plan
        </Button>
      </div>

      {plans.length === 0 ? (
        <p className="text-center text-sm text-neutral-500">
          No plans yet — build one to structure your training weeks.
        </p>
      ) : (
        <div className="space-y-3">
          {plans.map((p) => (
            <div key={p.id} className={cardClass}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{p.title}</p>
                  <p className="text-xs text-neutral-500">
                    {p.startDate && p.endDate
                      ? `${formatDay(p.startDate)} – ${formatDay(p.endDate)}`
                      : <span className="capitalize">{p.sportFocus}</span>}
                    {p.splitType ? ` · ${p.splitType} split` : ""}
                  </p>
                </div>
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
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1">
                <Button variant="ghost" className="px-2 text-xs" onClick={() => setView({ kind: "review", id: p.id })}>
                  <BarChart3 className="h-3.5 w-3.5" />
                  Review
                </Button>
                {p.durationWeeks ? (
                  <Button variant="ghost" className="px-2 text-xs" onClick={() => setView({ kind: "edit", id: p.id })}>
                    <Pencil className="h-3.5 w-3.5" />
                    Edit schedule
                  </Button>
                ) : (
                  <Button variant="ghost" className="px-2 text-xs" onClick={() => setLegacyId(p.id)}>
                    <Settings2 className="h-3.5 w-3.5" />
                    Edit days
                  </Button>
                )}
                <button
                  onClick={() => remove(p)}
                  className="ml-auto text-xs text-neutral-400 underline hover:text-red-500"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {legacyId && <PlanBuilder planId={legacyId} onClose={() => setLegacyId(null)} />}
    </div>
  );
}

/** Loads a saved generated plan into the schedule editor and saves it back. */
function ScheduleEditorScreen({ planId, onDone }: { planId: string; onDone: () => void }) {
  const library = useExerciseLibrary();
  const [detail, setDetail] = useState<PlanDetail | null>(null);
  const [title, setTitle] = useState("");
  const [days, setDays] = useState<DraftDay[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<PlanDetail>(`/api/fitness/plans/${planId}`)
      .then((d) => {
        setDetail(d);
        setTitle(d.plan.title);
        setDays(planDaysToDrafts(d.days));
      })
      .catch(() => {});
  }, [planId]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/fitness/plans/${planId}/schedule`, {
        method: "PUT",
        body: JSON.stringify({
          title: title.trim() || undefined,
          days: draftsToPayload(days),
        }),
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  if (!detail || !library) return <p className="text-sm text-neutral-500">Loading plan…</p>;

  return (
    <div className="space-y-4">
      <div className={cardClass}>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Plan name</span>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
      </div>
      <PlanScheduleEditor
        days={days}
        onChange={setDays}
        library={library}
        focus={detail.plan.focus ?? NEUTRAL_FOCUS}
        progressive={detail.plan.progressive}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

function PlanBuilder({ planId, onClose }: { planId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<PlanDetail | null>(null);
  const [newDayTitle, setNewDayTitle] = useState("");
  const [pickerForDay, setPickerForDay] = useState<string | null>(null);
  function load() {
    apiFetch<PlanDetail>(`/api/fitness/plans/${planId}`).then(setDetail).catch(() => {});
  }

  useEffect(load, [planId]);

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
                  <span className="min-w-32 flex-1">{ex.exerciseName}</span>
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
