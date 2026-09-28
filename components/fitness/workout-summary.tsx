"use client";

import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Plus, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { describeSet } from "./workout-session";
import { DayTypeBadge, ProgressBar, StatTile, cardClass, describeTarget, formatDay } from "./shared";
import { formatDuration, formatNumber, headlineMetric, percentChange } from "@/lib/fitness/stats";
import type { SetStats, WorkoutSummary } from "@/lib/fitness/types";

/** Post-workout review: totals for reps / weight / time, per-exercise results
 *  against the plan target and the previous session, and any PRs. */
export function WorkoutSummaryView({
  workoutLogId,
  onDone,
  onKeepLogging,
  doneLabel = "Done",
}: {
  workoutLogId: string;
  onDone: () => void;
  onKeepLogging?: () => void;
  doneLabel?: string;
}) {
  const [summary, setSummary] = useState<WorkoutSummary | null>(null);

  useEffect(() => {
    apiFetch<{ summary: WorkoutSummary }>(`/api/fitness/workouts/${workoutLogId}/summary`)
      .then((res) => setSummary(res.summary))
      .catch(() => {});
  }, [workoutLogId]);

  if (!summary) return <p className="text-sm text-neutral-500">Crunching your workout…</p>;
  const { totals } = summary;

  return (
    <div className="space-y-4">
      <div className={cn(cardClass, "space-y-1")}>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">{summary.dayTitle ?? summary.log.activityType ?? "Workout"}</h2>
          <DayTypeBadge type={summary.dayType} />
        </div>
        <p className="text-sm text-neutral-500">
          {formatDay(summary.log.date)}
          {summary.planTitle ? ` · ${summary.planTitle}` : ""}
          {summary.log.status !== "completed" ? " · in progress" : ""}
        </p>
        {summary.prCount > 0 && (
          <p className="flex items-center gap-1.5 pt-1 text-sm font-medium text-amber-700 dark:text-amber-400">
            <Trophy className="h-4 w-4" />
            {summary.prCount} personal record{summary.prCount > 1 ? "s" : ""} this session
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label="Duration" value={summary.elapsedSeconds ? formatDuration(summary.elapsedSeconds) : "—"} />
        <StatTile label="Sets" value={String(totals.sets)} sub={`${summary.exercises.length} exercises`} />
        <StatTile label="Reps" value={formatNumber(totals.reps)} />
        <StatTile
          label="Volume"
          value={totals.volume ? `${formatNumber(totals.volume)} lb` : "—"}
          sub={totals.durationSeconds ? `${formatDuration(totals.durationSeconds)} timed work` : undefined}
        />
      </div>

      {summary.targetCompletion !== null && (
        <div className={cn(cardClass, "space-y-2")}>
          <div className="flex justify-between text-sm">
            <span className="font-medium">Plan completion</span>
            <span className="tabular-nums">{Math.round(summary.targetCompletion * 100)}% of planned sets</span>
          </div>
          <ProgressBar value={summary.targetCompletion} />
        </div>
      )}

      <div className={cn(cardClass, "divide-y divide-neutral-100 p-0 dark:divide-neutral-800")}>
        {summary.exercises.length === 0 && <p className="p-4 text-sm text-neutral-500">Nothing logged.</p>}
        {summary.exercises.map((ex) => (
          <div key={ex.loggedExerciseId} className="space-y-1 p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium">
                {ex.name}
                {ex.isPr && <Trophy className="ml-1.5 inline h-3.5 w-3.5 text-amber-500" aria-label="Personal record" />}
              </p>
              <Delta before={ex.previous?.stats ?? null} after={ex.stats} />
            </div>
            <p className="text-sm">
              {ex.sets.length ? ex.sets.map(describeSet).join(", ") : <span className="text-neutral-500">Skipped</span>}
            </p>
            <p className="text-xs text-neutral-500">
              {ex.target && `Target ${describeTarget({ targetSets: ex.target.sets, targetReps: ex.target.reps, targetWeight: ex.target.weight, targetDurationSeconds: ex.target.durationSeconds })}`}
              {ex.target && ex.previous && " · "}
              {ex.previous && `Last ${formatDay(ex.previous.date)}: ${headline(ex.previous.stats)}`}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        {onKeepLogging && (
          <Button variant="secondary" onClick={onKeepLogging}>
            <Plus className="h-4 w-4" />
            Add more to this workout
          </Button>
        )}
        <Button onClick={onDone}>{doneLabel}</Button>
      </div>
    </div>
  );
}

export function headline(stats: SetStats): string {
  const h = headlineMetric(stats);
  if (h.metric === "e1rm") return `${Math.round(stats.maxWeight)} lb top set (est. 1RM ${Math.round(h.value)})`;
  if (h.metric === "reps") return `${h.value} reps best set`;
  if (h.metric === "duration") return `${formatDuration(h.value)} best`;
  return "—";
}

export function Delta({ before, after }: { before: SetStats | null; after: SetStats }) {
  if (!before) return null;
  const change = percentChange(before, after);
  if (change === null || Math.abs(change) < 0.005) return null;
  const up = change > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 text-xs font-medium tabular-nums",
        up ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-500",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {up ? "+" : ""}
      {Math.round(change * 100)}%
    </span>
  );
}
