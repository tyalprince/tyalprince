"use client";

import { useEffect, useState } from "react";
import { Plus, Trophy, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api-client";
import { ExercisePicker } from "./exercise-picker";
import { RestTimer } from "./rest-timer";
import type {
  ExerciseRow,
  LoggedExerciseRow,
  LoggedSetRow,
  PlanDayExerciseRow,
  PrCheckResult,
} from "@/lib/fitness/types";

const CARDIO_CATEGORIES = new Set(["cardio", "running", "cycling", "basketball"]);

type ExerciseEntry = {
  loggedExercise: LoggedExerciseRow;
  info: ExerciseRow;
  target?: PlanDayExerciseRow;
};

export function WorkoutSession({
  workoutLogId,
  initialExercises,
  targets,
  onFinish,
}: {
  workoutLogId: string;
  initialExercises: { loggedExercise: LoggedExerciseRow; info: ExerciseRow }[];
  targets?: Record<string, PlanDayExerciseRow>; // exerciseId -> target
  onFinish: () => void;
}) {
  const [entries, setEntries] = useState<ExerciseEntry[]>(
    initialExercises.map((e) => ({ ...e, target: targets?.[e.info.id] })),
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [restTimer, setRestTimer] = useState<{ key: string; seconds: number } | null>(null);
  const [lastPr, setLastPr] = useState<{ exerciseName: string; pr: PrCheckResult } | null>(null);

  useEffect(() => {
    if (!lastPr) return;
    const t = setTimeout(() => setLastPr(null), 5000);
    return () => clearTimeout(t);
  }, [lastPr]);

  async function addExercise(exercise: ExerciseRow) {
    const { loggedExercise } = await apiFetch<{ loggedExercise: LoggedExerciseRow }>(
      `/api/fitness/workouts/${workoutLogId}/exercises`,
      {
        method: "POST",
        body: JSON.stringify({ exerciseId: exercise.id, orderIndex: entries.length }),
      },
    );
    setEntries((prev) => [
      ...prev,
      { loggedExercise: { ...loggedExercise, sets: [] }, info: exercise },
    ]);
  }

  function handleSetLogged(entryIndex: number, set: LoggedSetRow, pr: PrCheckResult | null) {
    setEntries((prev) =>
      prev.map((e, i) =>
        i === entryIndex
          ? { ...e, loggedExercise: { ...e.loggedExercise, sets: [...e.loggedExercise.sets, set] } }
          : e,
      ),
    );
    const entry = entries[entryIndex];
    const restSeconds = set.restSeconds ?? (CARDIO_CATEGORIES.has(entry.info.category) ? 60 : 90);
    setRestTimer({ key: set.id, seconds: restSeconds });
    if (pr?.isPr) setLastPr({ exerciseName: entry.info.name, pr });
  }

  async function finishWorkout() {
    await apiFetch(`/api/fitness/workouts/${workoutLogId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "completed", endTime: new Date().toISOString() }),
    });
    onFinish();
  }

  return (
    <div className="space-y-4">
      {lastPr && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <Trophy className="h-4 w-4 shrink-0" />
          New personal record on {lastPr.exerciseName}!
        </div>
      )}

      {restTimer && (
        <RestTimer
          key={restTimer.key}
          seconds={restTimer.seconds}
          onDismiss={() => setRestTimer(null)}
        />
      )}

      {entries.map((entry, i) => (
        <ExerciseCard
          key={entry.loggedExercise.id}
          entry={entry}
          onSetLogged={(set, pr) => handleSetLogged(i, set, pr)}
        />
      ))}

      <Button variant="secondary" onClick={() => setPickerOpen(true)}>
        <Plus className="h-4 w-4" />
        Add exercise
      </Button>

      <div className="flex justify-end">
        <Button onClick={finishWorkout}>
          <CheckCircle2 className="h-4 w-4" />
          Finish workout
        </Button>
      </div>

      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={addExercise}
      />
    </div>
  );
}

function ExerciseCard({
  entry,
  onSetLogged,
}: {
  entry: ExerciseEntry;
  onSetLogged: (set: LoggedSetRow, pr: PrCheckResult | null) => void;
}) {
  const isCardio = CARDIO_CATEGORIES.has(entry.info.category);
  const [reps, setReps] = useState(entry.target?.targetReps?.toString() ?? "");
  const [weight, setWeight] = useState(entry.target?.targetWeight ?? "");
  const [duration, setDuration] = useState("");
  const [distance, setDistance] = useState(entry.target?.targetDistance ?? "");
  const [rpe, setRpe] = useState("");
  const [busy, setBusy] = useState(false);

  async function logSet() {
    setBusy(true);
    try {
      const { set, pr } = await apiFetch<{ set: LoggedSetRow; pr: PrCheckResult | null }>(
        `/api/fitness/logged-exercises/${entry.loggedExercise.id}/sets`,
        {
          method: "POST",
          body: JSON.stringify({
            setNumber: entry.loggedExercise.sets.length + 1,
            reps: reps ? Number(reps) : undefined,
            weight: weight ? Number(weight) : undefined,
            durationSeconds: duration ? Number(duration) * 60 : undefined,
            distance: distance ? Number(distance) : undefined,
            rpe: rpe ? Number(rpe) : undefined,
          }),
        },
      );
      onSetLogged(set, pr);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-medium">{entry.info.name}</h3>
        {entry.target && (
          <span className="text-xs text-neutral-500">
            Target: {entry.target.targetSets ?? "—"} x {entry.target.targetReps ?? "—"}
            {entry.target.targetWeight ? ` @ ${entry.target.targetWeight}lb` : ""}
          </span>
        )}
      </div>

      {entry.loggedExercise.sets.length > 0 && (
        <table className="mb-2 w-full text-sm">
          <tbody>
            {entry.loggedExercise.sets.map((s) => (
              <tr key={s.id} className="border-b border-neutral-100 last:border-b-0 dark:border-neutral-900">
                <td className="py-1 text-neutral-500">Set {s.setNumber}</td>
                <td className="py-1">
                  {isCardio
                    ? [
                        s.distance ? `${s.distance}${s.distanceUnit ?? "mi"}` : null,
                        s.durationSeconds ? `${Math.round(s.durationSeconds / 60)}min` : null,
                      ]
                        .filter(Boolean)
                        .join(" / ") || "—"
                    : [s.reps ? `${s.reps} reps` : null, s.weight ? `${s.weight}${s.weightUnit ?? "lb"}` : null]
                        .filter(Boolean)
                        .join(" @ ") || "—"}
                </td>
                {s.rpe && <td className="py-1 text-right text-neutral-400">RPE {s.rpe}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="flex flex-wrap items-end gap-2">
        {isCardio ? (
          <>
            <Field label="Distance">
              <Input value={distance} onChange={(e) => setDistance(e.target.value)} className="w-20" />
            </Field>
            <Field label="Minutes">
              <Input value={duration} onChange={(e) => setDuration(e.target.value)} className="w-20" />
            </Field>
          </>
        ) : (
          <>
            <Field label="Reps">
              <Input value={reps} onChange={(e) => setReps(e.target.value)} className="w-16" />
            </Field>
            <Field label="Weight">
              <Input value={weight} onChange={(e) => setWeight(e.target.value)} className="w-20" />
            </Field>
          </>
        )}
        <Field label="RPE">
          <Input value={rpe} onChange={(e) => setRpe(e.target.value)} className="w-14" />
        </Field>
        <Button onClick={logSet} disabled={busy}>
          Log set
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-neutral-500">{label}</label>
      {children}
    </div>
  );
}
