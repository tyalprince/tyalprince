import { progressExercise } from "@/lib/fitness/generator";
import type { DraftDay, DraftExercise } from "@/lib/fitness/types";

// Pure editing rules for a plan's schedule, shared by the plan editor and the
// Today view. The key idea: in a weekly / bi-weekly split, the "same" workout
// appears on the same weekday in several weeks. With syncing on, an edit made
// in one week lands on every matching day, and progressive-overload plans
// keep each week's step-up relative to the edited values.

export type TargetField = "targetSets" | "targetReps" | "targetWeight" | "targetDurationSeconds";

/** Two days "match" when they're the same weekday with the same workout. */
export function daySignature(d: DraftDay): string {
  return `${d.dayOfWeek}|${d.dayType}|${d.exercises.map((e) => e.exerciseId).join(",")}`;
}

/** Indexes of the days an edit to `idx` should touch (always including `idx`). */
export function matchingDayIndexes(days: DraftDay[], idx: number, sync: boolean): number[] {
  const source = days[idx];
  if (!sync) return [idx];
  const sig = daySignature(source);
  return days
    .map((d, i) => ({ d, i }))
    .filter(({ d, i }) => i === idx || (d.weekNumber !== source.weekNumber && daySignature(d) === sig))
    .map(({ i }) => i);
}

/** Freshly built targets for a given week: base targets plus that week's progression. */
export function progressFor(exercises: DraftExercise[], weekNumber: number, progressive: boolean): DraftExercise[] {
  return progressive ? exercises.map((e) => progressExercise(e, weekNumber - 1)) : exercises;
}

/** Applies a structural change (rebuild, add, swap, reorder, remove) to `idx` and its matching days. */
export function applyDayEdit(
  days: DraftDay[],
  idx: number,
  fn: (day: DraftDay) => DraftDay,
  sync: boolean,
): DraftDay[] {
  const targets = new Set(matchingDayIndexes(days, idx, sync));
  return days.map((d, i) => (targets.has(i) ? fn(d) : d));
}

/**
 * Sets one target on one exercise and carries it to matching days. Sets,
 * reps and time move by the same amount in every matched week, so a week
 * that was progressed (+1 set, +2 reps…) stays that much ahead of the edited
 * one. Weight doesn't progress, so it's copied as-is.
 */
export function applyTargetEdit(
  days: DraftDay[],
  dayIdx: number,
  exIdx: number,
  field: TargetField,
  value: number | null,
  sync: boolean,
): DraftDay[] {
  const before = days[dayIdx].exercises[exIdx]?.[field] ?? null;
  const targets = new Set(matchingDayIndexes(days, dayIdx, sync));

  return days.map((d, i) => {
    if (!targets.has(i)) return d;
    return {
      ...d,
      exercises: d.exercises.map((e, j) => {
        if (j !== exIdx) return e;
        if (i === dayIdx || field === "targetWeight" || value === null) return { ...e, [field]: value };
        const current = e[field];
        const next = before === null || current === null ? value : Math.max(1, current + (value - before));
        return { ...e, [field]: next };
      }),
    };
  });
}
