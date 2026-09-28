"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Bike, BedDouble, Dumbbell, Home, StretchHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";
import { DAY_TYPE_LABELS, type LibraryExercise } from "@/lib/fitness/generator";
import type { DayType, DraftExercise, ExerciseRow } from "@/lib/fitness/types";

/** Today's date in the user's timezone, as YYYY-MM-DD. */
export function localToday(): string {
  return format(new Date(), "yyyy-MM-dd");
}

/** "Mon, Sep 28" for a YYYY-MM-DD (or ISO) date, without timezone drift. */
export function formatDay(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  return format(new Date(y, m - 1, d), "EEE, MMM d");
}

export const cardClass =
  "rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900";

export const selectClass =
  "rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900";

const DAY_TYPE_STYLES: Record<DayType, string> = {
  gym: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  home: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  cardio: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  recovery: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  rest: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400",
};

const DAY_TYPE_ICONS: Record<DayType, typeof Dumbbell> = {
  gym: Dumbbell,
  home: Home,
  cardio: Bike,
  recovery: StretchHorizontal,
  rest: BedDouble,
};

export function DayTypeBadge({
  type,
  className,
  compact,
}: {
  type: DayType | null;
  className?: string;
  compact?: boolean; // icon only, label kept for screen readers
}) {
  if (!type) return null;
  const Icon = DAY_TYPE_ICONS[type];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium",
        DAY_TYPE_STYLES[type],
        className,
      )}
    >
      <Icon className={compact ? "h-3.5 w-3.5" : "h-3 w-3"} />
      <span className={compact ? "sr-only" : undefined}>{DAY_TYPE_LABELS[type]}</span>
    </span>
  );
}

export function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="text-xs text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-neutral-500 dark:text-neutral-400">{sub}</p>}
    </div>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
      <div
        className="h-full rounded-full bg-indigo-500"
        style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }}
      />
    </div>
  );
}

/** The whole exercise library (global + the user's custom), for the plan generator. */
export function useExerciseLibrary() {
  const [library, setLibrary] = useState<LibraryExercise[] | null>(null);
  useEffect(() => {
    apiFetch<{ exercises: ExerciseRow[] }>("/api/fitness/exercises")
      .then((res) => setLibrary(res.exercises))
      .catch(() => setLibrary([]));
  }, []);
  return library;
}

/** Human-readable target, e.g. "4 × 8 @ 135 lb" or "3 × 45s". */
export function describeTarget(t: {
  targetSets: number | null;
  targetReps: number | null;
  targetWeight: number | string | null;
  targetDurationSeconds: number | null;
}): string {
  const parts: string[] = [];
  const sets = t.targetSets ?? 1;
  if (t.targetReps) parts.push(`${sets} × ${t.targetReps}`);
  else if (t.targetDurationSeconds) {
    const d = t.targetDurationSeconds;
    const time = d >= 120 ? `${Math.round(d / 60)} min` : `${d}s`;
    parts.push(sets > 1 ? `${sets} × ${time}` : time);
  } else if (t.targetSets) parts.push(`${sets} sets`);
  if (t.targetWeight && Number(t.targetWeight) > 0) parts.push(`@ ${Number(t.targetWeight)} lb`);
  return parts.join(" ");
}

/** Sensible starting targets when the user adds an exercise by hand. */
export function defaultTargets(category: ExerciseRow["category"]): Omit<DraftExercise, "exerciseId" | "name" | "category"> {
  const blank = { targetWeight: null, notes: null };
  switch (category) {
    case "strength":
      return { ...blank, targetSets: 3, targetReps: 10, targetDurationSeconds: null, targetRestSeconds: 90 };
    case "mobility":
      return { ...blank, targetSets: 1, targetReps: null, targetDurationSeconds: 60, targetRestSeconds: null };
    default:
      return { ...blank, targetSets: 1, targetReps: null, targetDurationSeconds: 20 * 60, targetRestSeconds: null };
  }
}
