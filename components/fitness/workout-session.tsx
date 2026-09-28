"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, History, Plus, Trash2, Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api-client";
import { ExercisePicker } from "./exercise-picker";
import { RestTimer } from "./rest-timer";
import { cardClass, describeTarget, formatDay } from "./shared";
import { formatDuration } from "@/lib/fitness/stats";
import type {
  ExerciseRow,
  LoggedExerciseRow,
  LoggedSetRow,
  PlanDayExerciseRow,
  PrCheckResult,
  WorkoutLogRow,
} from "@/lib/fitness/types";

const CARDIO_CATEGORIES = new Set(["cardio", "running", "cycling", "basketball"]);

type Target = Pick<
  PlanDayExerciseRow,
  "exerciseId" | "targetSets" | "targetReps" | "targetWeight" | "targetDurationSeconds" | "targetRestSeconds" | "notes"
>;

type WorkoutDetail = { log: WorkoutLogRow; exercises: LoggedExerciseRow[]; targets: Target[] };

type HistorySet = {
  workoutLogId: string;
  reps: number | null;
  weight: string | null;
  durationSeconds: number | null;
  distance: string | null;
  date: string | null;
};

export function WorkoutSession({
  workoutLogId,
  title,
  onFinish,
  onClose,
}: {
  workoutLogId: string;
  title?: string;
  onFinish: (workoutLogId: string) => void;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<WorkoutDetail | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [restTimer, setRestTimer] = useState<{ key: string; seconds: number } | null>(null);
  const [lastPr, setLastPr] = useState<{ exerciseName: string; pr: PrCheckResult } | null>(null);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    apiFetch<WorkoutDetail>(`/api/fitness/workouts/${workoutLogId}`)
      .then(setDetail)
      .catch(() => {});
  }, [workoutLogId]);

  useEffect(() => {
    if (!lastPr) return;
    const t = setTimeout(() => setLastPr(null), 5000);
    return () => clearTimeout(t);
  }, [lastPr]);

  if (!detail) return <p className="text-sm text-neutral-500">Loading workout…</p>;

  const targetsByExercise = new Map(detail.targets.map((t) => [t.exerciseId, t]));

  function updateExercise(id: string, fn: (e: LoggedExerciseRow) => LoggedExerciseRow) {
    setDetail((d) => d && { ...d, exercises: d.exercises.map((e) => (e.id === id ? fn(e) : e)) });
  }

  async function addExercise(exercise: ExerciseRow) {
    const { loggedExercise } = await apiFetch<{ loggedExercise: LoggedExerciseRow }>(
      `/api/fitness/workouts/${workoutLogId}/exercises`,
      {
        method: "POST",
        body: JSON.stringify({ exerciseId: exercise.id, orderIndex: detail!.exercises.length }),
      },
    );
    setDetail(
      (d) =>
        d && {
          ...d,
          exercises: [
            ...d.exercises,
            { ...loggedExercise, sets: [], exerciseName: exercise.name, exerciseCategory: exercise.category },
          ],
        },
    );
  }

  async function removeExercise(entry: LoggedExerciseRow) {
    if (entry.sets.length && !confirm(`Remove ${entry.exerciseName} and its ${entry.sets.length} logged sets?`)) return;
    await apiFetch(`/api/fitness/logged-exercises/${entry.id}`, { method: "DELETE" });
    setDetail((d) => d && { ...d, exercises: d.exercises.filter((e) => e.id !== entry.id) });
  }

  function handleSetLogged(entry: LoggedExerciseRow, set: LoggedSetRow, pr: PrCheckResult | null) {
    updateExercise(entry.id, (e) => ({ ...e, sets: [...e.sets, set] }));
    const target = targetsByExercise.get(entry.exerciseId);
    const restSeconds =
      set.restSeconds ?? target?.targetRestSeconds ?? (CARDIO_CATEGORIES.has(entry.exerciseCategory) ? 60 : 90);
    if (restSeconds > 0) setRestTimer({ key: set.id, seconds: restSeconds });
    if (pr?.isPr && pr.previousBest) setLastPr({ exerciseName: entry.exerciseName, pr });
  }

  async function deleteSet(entry: LoggedExerciseRow, set: LoggedSetRow) {
    await apiFetch(`/api/fitness/logged-sets/${set.id}`, { method: "DELETE" });
    updateExercise(entry.id, (e) => ({ ...e, sets: e.sets.filter((s) => s.id !== set.id) }));
  }

  async function finishWorkout() {
    setFinishing(true);
    try {
      await apiFetch(`/api/fitness/workouts/${workoutLogId}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "completed",
          // Keep the original end time when re-opening a finished workout to add more.
          ...(detail!.log.endTime ? {} : { endTime: new Date().toISOString() }),
        }),
      });
      onFinish(workoutLogId);
    } finally {
      setFinishing(false);
    }
  }

  async function discardWorkout() {
    if (!confirm("Discard this workout and everything logged in it?")) return;
    await apiFetch(`/api/fitness/workouts/${workoutLogId}`, { method: "DELETE" });
    onClose();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">{title ?? detail.log.activityType ?? "Workout"}</h2>
          <p className="text-xs text-neutral-500">
            {formatDay(detail.log.date)}
            {detail.log.status === "completed" ? " · adding to a finished workout" : ""}
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800"
          aria-label="Leave workout (progress is saved)"
          title="Leave — progress is saved"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {lastPr && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <Trophy className="h-4 w-4 shrink-0" />
          New personal record on {lastPr.exerciseName}!
        </div>
      )}

      {restTimer && (
        <RestTimer key={restTimer.key} seconds={restTimer.seconds} onDismiss={() => setRestTimer(null)} />
      )}

      {detail.exercises.length === 0 && (
        <p className="text-sm text-neutral-500">No exercises yet — add whatever you&apos;re doing.</p>
      )}

      {detail.exercises.map((entry) => (
        <ExerciseCard
          key={entry.id}
          workoutLogId={workoutLogId}
          entry={entry}
          target={targetsByExercise.get(entry.exerciseId)}
          onSetLogged={(set, pr) => handleSetLogged(entry, set, pr)}
          onDeleteSet={(set) => deleteSet(entry, set)}
          onRemove={() => removeExercise(entry)}
        />
      ))}

      <Button variant="secondary" onClick={() => setPickerOpen(true)} className="w-full">
        <Plus className="h-4 w-4" />
        Add exercise
      </Button>

      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" onClick={discardWorkout} className="text-red-600">
          <Trash2 className="h-4 w-4" />
          Discard
        </Button>
        <Button onClick={finishWorkout} disabled={finishing}>
          <CheckCircle2 className="h-4 w-4" />
          Finish workout
        </Button>
      </div>

      <ExercisePicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={addExercise} />
    </div>
  );
}

function ExerciseCard({
  workoutLogId,
  entry,
  target,
  onSetLogged,
  onDeleteSet,
  onRemove,
}: {
  workoutLogId: string;
  entry: LoggedExerciseRow;
  target?: Target;
  onSetLogged: (set: LoggedSetRow, pr: PrCheckResult | null) => void;
  onDeleteSet: (set: LoggedSetRow) => void;
  onRemove: () => void;
}) {
  const category = entry.exerciseCategory;
  const isCardio = CARDIO_CATEGORIES.has(category);
  const isTimed = isCardio || category === "mobility" || Boolean(target?.targetDurationSeconds && !target.targetReps);

  const [reps, setReps] = useState(target?.targetReps?.toString() ?? "");
  const [weight, setWeight] = useState(target?.targetWeight ? String(Number(target.targetWeight)) : "");
  // Cardio time is entered in minutes, everything else in seconds.
  const [time, setTime] = useState(
    target?.targetDurationSeconds
      ? String(isCardio ? Math.round(target.targetDurationSeconds / 60) : target.targetDurationSeconds)
      : "",
  );
  const [distance, setDistance] = useState("");
  const [rpe, setRpe] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastTime, setLastTime] = useState<{ date: string; sets: HistorySet[] } | null>(null);

  useEffect(() => {
    apiFetch<{ history: HistorySet[] }>(`/api/fitness/exercises/${entry.exerciseId}/history`)
      .then(({ history }) => {
        const prior = history.filter((h) => h.workoutLogId !== workoutLogId);
        if (!prior.length) return;
        const lastId = prior[prior.length - 1].workoutLogId;
        const sets = prior.filter((h) => h.workoutLogId === lastId);
        setLastTime({ date: sets[0].date ?? "", sets });
        // Nothing planned? Start from what you did last time.
        const top = sets.reduce((best, s) => (Number(s.weight ?? 0) > Number(best.weight ?? 0) ? s : best), sets[0]);
        setWeight((w) => w || (top.weight ? String(Number(top.weight)) : ""));
        setReps((r) => r || (top.reps ? String(top.reps) : ""));
      })
      .catch(() => {});
  }, [entry.exerciseId, workoutLogId]);

  async function logSet() {
    const num = (v: string) => (v.trim() === "" || Number.isNaN(Number(v)) ? undefined : Number(v));
    const seconds = num(time) === undefined ? undefined : Math.round(num(time)! * (isCardio ? 60 : 1));
    setBusy(true);
    try {
      const { set, pr } = await apiFetch<{ set: LoggedSetRow; pr: PrCheckResult | null }>(
        `/api/fitness/logged-exercises/${entry.id}/sets`,
        {
          method: "POST",
          body: JSON.stringify({
            setNumber: entry.sets.length + 1,
            reps: num(reps) !== undefined ? Math.round(num(reps)!) : undefined,
            weight: num(weight),
            durationSeconds: seconds,
            distance: num(distance),
            distanceUnit: num(distance) !== undefined ? "mi" : undefined,
            rpe: num(rpe) !== undefined ? Math.min(10, Math.max(1, Math.round(num(rpe)!))) : undefined,
          }),
        },
      );
      onSetLogged(set, pr);
    } finally {
      setBusy(false);
    }
  }

  const targetSets = target?.targetSets ?? null;
  const done = targetSets !== null && entry.sets.length >= targetSets;

  return (
    <div className={cardClass}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-medium">{entry.exerciseName}</h3>
          {target && (
            <p className="text-xs text-neutral-500">
              Target: {describeTarget(target)}
              {target.notes ? ` · ${target.notes}` : ""}
            </p>
          )}
          {lastTime && (
            <p className="flex items-center gap-1 text-xs text-neutral-500">
              <History className="h-3 w-3" />
              Last ({formatDay(lastTime.date)}): {lastTime.sets.map(describeSet).join(", ")}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {targetSets !== null && (
            <span className={done ? "text-xs font-medium text-emerald-600" : "text-xs text-neutral-500"}>
              {entry.sets.length}/{targetSets}
            </span>
          )}
          <button
            onClick={onRemove}
            className="rounded p-1 text-neutral-400 hover:text-red-500"
            aria-label={`Remove ${entry.exerciseName}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {entry.sets.length > 0 && (
        <table className="mb-2 w-full text-sm">
          <tbody>
            {entry.sets.map((s, i) => (
              <tr key={s.id} className="border-b border-neutral-100 last:border-b-0 dark:border-neutral-800">
                <td className="w-14 py-1 text-neutral-500">Set {i + 1}</td>
                <td className="py-1">{describeSet(s)}</td>
                <td className="py-1 text-right text-xs text-neutral-400">{s.rpe ? `RPE ${s.rpe}` : ""}</td>
                <td className="w-6 py-1 text-right">
                  <button
                    onClick={() => onDeleteSet(s)}
                    className="text-neutral-300 hover:text-red-500"
                    aria-label={`Delete set ${i + 1}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="flex flex-wrap items-end gap-2">
        {isCardio ? (
          <>
            <Field label="Minutes">
              <Input inputMode="decimal" value={time} onChange={(e) => setTime(e.target.value)} className="w-20" />
            </Field>
            <Field label="Distance (mi)">
              <Input inputMode="decimal" value={distance} onChange={(e) => setDistance(e.target.value)} className="w-20" />
            </Field>
            {category === "basketball" && (
              <Field label="Reps">
                <Input inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} className="w-16" />
              </Field>
            )}
          </>
        ) : (
          <>
            {isTimed && (
              <Field label="Seconds">
                <Input inputMode="numeric" value={time} onChange={(e) => setTime(e.target.value)} className="w-20" />
              </Field>
            )}
            <Field label="Reps">
              <Input inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} className="w-16" />
            </Field>
            {category !== "mobility" && (
              <Field label="Weight (lb)">
                <Input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} className="w-20" />
              </Field>
            )}
            {!isTimed && (
              <Field label="Seconds">
                <Input
                  inputMode="numeric"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  placeholder="opt."
                  className="w-16"
                />
              </Field>
            )}
          </>
        )}
        <Field label="RPE">
          <Input inputMode="numeric" value={rpe} onChange={(e) => setRpe(e.target.value)} placeholder="1-10" className="w-14" />
        </Field>
        <Button onClick={logSet} disabled={busy || (!reps && !weight && !time && !distance)}>
          Log set
        </Button>
      </div>
    </div>
  );
}

export function describeSet(s: {
  reps: number | null;
  weight: string | null;
  durationSeconds: number | null;
  distance: string | null;
}): string {
  const parts: string[] = [];
  if (s.distance && Number(s.distance) > 0) parts.push(`${Number(s.distance)} mi`);
  if (s.reps) parts.push(`${s.reps} reps`);
  if (s.weight && Number(s.weight) > 0) parts.push(`${Number(s.weight)} lb`);
  if (s.durationSeconds) parts.push(formatDuration(s.durationSeconds));
  return parts.join(" · ") || "—";
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-neutral-500">{label}</label>
      {children}
    </div>
  );
}
