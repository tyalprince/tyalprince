"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Trophy } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";
import { Delta, WorkoutSummaryView, headline } from "./workout-summary";
import { DayTypeBadge, ProgressBar, StatTile, cardClass, formatDay, localToday } from "./shared";
import { DAY_TYPE_LABELS } from "@/lib/fitness/generator";
import { formatDuration, formatNumber, percentChange } from "@/lib/fitness/stats";
import type { PlanReview } from "@/lib/fitness/types";

type Metric = "volume" | "reps" | "durationSeconds";
const METRICS: { key: Metric; label: string; format: (n: number) => string }[] = [
  { key: "volume", label: "Volume (lb)", format: (n) => formatNumber(n) },
  { key: "reps", label: "Reps", format: (n) => formatNumber(n) },
  { key: "durationSeconds", label: "Time", format: (n) => formatDuration(n) },
];

/** Plan-level dashboard: adherence, weekly training load, and how every
 *  exercise moved from its first session in the plan to its last. */
export function PlanReviewView({ planId, onBack }: { planId: string; onBack: () => void }) {
  const [review, setReview] = useState<PlanReview | null>(null);
  const [metric, setMetric] = useState<Metric>("volume");
  const [openWorkout, setOpenWorkout] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ review: PlanReview }>(`/api/fitness/plans/${planId}/review?today=${localToday()}`)
      .then((res) => setReview(res.review))
      .catch(() => {});
  }, [planId]);

  if (openWorkout) {
    return <WorkoutSummaryView workoutLogId={openWorkout} onDone={() => setOpenWorkout(null)} doneLabel="Back to plan review" />;
  }

  if (!review) return <p className="text-sm text-neutral-500">Loading plan review…</p>;

  const adherence = review.scheduled ? review.completed / review.scheduled : 0;
  const improved = review.exercises.filter((e) => (percentChange(e.first, e.last) ?? 0) > 0).length;
  const metricInfo = METRICS.find((m) => m.key === metric)!;
  const chartData = review.weeks.map((w) => ({ week: `Wk ${w.weekNumber}`, value: w[metric] }));

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
      >
        <ChevronLeft className="h-4 w-4" />
        Back
      </button>

      <div className={cn(cardClass, "space-y-2")}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{review.plan.title}</h2>
          <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs capitalize dark:bg-neutral-800">
            {review.plan.status}
          </span>
        </div>
        <p className="text-sm text-neutral-500">
          {review.plan.startDate && review.plan.endDate
            ? `${formatDay(review.plan.startDate)} – ${formatDay(review.plan.endDate)}`
            : "Custom plan"}
        </p>
        <div className="flex justify-between text-sm">
          <span>Workouts completed</span>
          <span className="tabular-nums">
            {review.completed}/{review.scheduled} · {Math.round(adherence * 100)}%
          </span>
        </div>
        <ProgressBar value={adherence} />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label="Total volume" value={`${formatNumber(review.totals.volume)} lb`} />
        <StatTile label="Total reps" value={formatNumber(review.totals.reps)} sub={`${review.totals.sets} sets`} />
        <StatTile label="Timed work" value={formatDuration(review.totals.durationSeconds)} />
        <StatTile
          label="Exercises improved"
          value={`${improved}/${review.exercises.filter((e) => e.sessions > 1).length}`}
          sub={review.skipped ? `${review.skipped} missed days` : "No missed days"}
        />
      </div>

      {review.weeks.length > 0 && (
        <div className={cardClass}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{metricInfo.label} by week</h3>
            <div className="flex gap-1 rounded-md bg-neutral-100 p-0.5 dark:bg-neutral-800">
              {METRICS.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setMetric(m.key)}
                  className={cn(
                    "rounded px-2 py-0.5 text-xs",
                    metric === m.key ? "bg-white shadow-sm dark:bg-neutral-950" : "text-neutral-500",
                  )}
                >
                  {m.label.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" strokeOpacity={0.1} />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  width={52}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => metricInfo.format(v)}
                />
                <Tooltip
                  cursor={{ fillOpacity: 0.06 }}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  formatter={(v) => [metricInfo.format(Number(v)), metricInfo.label]}
                />
                <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table className="mt-2 w-full text-xs text-neutral-500">
            <tbody>
              {review.weeks.map((w) => (
                <tr key={w.weekNumber}>
                  <td className="py-0.5">Week {w.weekNumber}</td>
                  <td className="py-0.5 text-right tabular-nums">
                    {w.completed}/{w.scheduled} workouts
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {review.byDayType.length > 0 && (
        <div className={cn(cardClass, "space-y-2")}>
          <h3 className="text-sm font-semibold">By day type</h3>
          {review.byDayType.map((t) => (
            <div key={t.dayType} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <DayTypeBadge type={t.dayType} />
                <span className="tabular-nums text-neutral-500">
                  {t.completed}/{t.scheduled} {DAY_TYPE_LABELS[t.dayType].toLowerCase()} days
                </span>
              </div>
              <ProgressBar value={t.scheduled ? t.completed / t.scheduled : 0} />
            </div>
          ))}
        </div>
      )}

      <div className={cardClass}>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Trophy className="h-4 w-4" />
          Exercise progress (first → latest session)
        </h3>
        {review.exercises.length === 0 ? (
          <p className="text-sm text-neutral-500">Log workouts in this plan to see progress.</p>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {review.exercises.map((e) => (
              <div key={e.exerciseId} className="flex items-start justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{e.name}</p>
                  <p className="text-xs text-neutral-500">
                    {e.sessions} session{e.sessions > 1 ? "s" : ""} ·{" "}
                    {e.sessions > 1 ? `${headline(e.first)} → ${headline(e.last)}` : headline(e.best)}
                  </p>
                </div>
                <Delta before={e.sessions > 1 ? e.first : null} after={e.last} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={cardClass}>
        <h3 className="mb-2 text-sm font-semibold">Workouts</h3>
        {review.workouts.length === 0 ? (
          <p className="text-sm text-neutral-500">No workouts logged yet.</p>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {review.workouts.map((w) => (
              <button
                key={w.id}
                onClick={() => setOpenWorkout(w.id)}
                className="flex w-full items-center justify-between gap-2 py-2 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{w.title}</p>
                  <p className="text-xs text-neutral-500">
                    {formatDay(w.date)} · {w.stats.sets} sets
                    {w.stats.volume ? ` · ${formatNumber(w.stats.volume)} lb` : ""}
                    {w.status !== "completed" ? " · in progress" : ""}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
