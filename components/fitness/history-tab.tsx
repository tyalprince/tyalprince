"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api-client";
import { PlanReviewView } from "./plan-review";
import { WorkoutSession, describeSet } from "./workout-session";
import { WorkoutSummaryView, headline } from "./workout-summary";
import { DayTypeBadge, cardClass, formatDay } from "./shared";
import { computeSetStats, formatDuration, formatNumber, headlineMetric } from "@/lib/fitness/stats";
import type { HistoryExercise, HistoryWorkout, PlanRow } from "@/lib/fitness/types";

type Segment = "workouts" | "plans" | "exercises";
type Detail =
  | { kind: "workout"; id: string }
  | { kind: "session"; id: string }
  | { kind: "plan"; id: string }
  | { kind: "exercise"; exercise: HistoryExercise };

type HistoryData = { plans: PlanRow[]; workouts: HistoryWorkout[]; exercises: HistoryExercise[] };

export function HistoryTab() {
  const [segment, setSegment] = useState<Segment>("workouts");
  const [data, setData] = useState<HistoryData | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(() => {
    apiFetch<HistoryData>("/api/fitness/history")
      .then(setData)
      .catch(() => setData({ plans: [], workouts: [], exercises: [] }));
  }, []);
  useEffect(load, [load]);

  const back = () => {
    setDetail(null);
    load();
  };

  if (detail?.kind === "workout") {
    return (
      <WorkoutSummaryView
        workoutLogId={detail.id}
        onDone={back}
        doneLabel="Back to history"
        onKeepLogging={() => setDetail({ kind: "session", id: detail.id })}
      />
    );
  }
  if (detail?.kind === "session") {
    return (
      <WorkoutSession
        workoutLogId={detail.id}
        onFinish={(id) => setDetail({ kind: "workout", id })}
        onClose={back}
      />
    );
  }
  if (detail?.kind === "plan") return <PlanReviewView planId={detail.id} onBack={back} />;
  if (detail?.kind === "exercise") return <ExerciseHistory exercise={detail.exercise} onBack={back} />;

  const q = query.trim().toLowerCase();
  const matches = (...fields: (string | null)[]) => !q || fields.some((f) => f?.toLowerCase().includes(q));

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-md bg-neutral-100 p-1 dark:bg-neutral-800">
        {(["workouts", "plans", "exercises"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSegment(s)}
            className={cn(
              "flex-1 rounded px-3 py-1 text-sm font-medium capitalize",
              segment === s ? "bg-white shadow-sm dark:bg-neutral-950" : "text-neutral-500 dark:text-neutral-400",
            )}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-neutral-400" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${segment}…`} className="pl-8" />
      </div>

      {!data ? (
        <p className="text-sm text-neutral-500">Loading history…</p>
      ) : segment === "workouts" ? (
        <List
          empty="No workouts logged yet."
          items={data.workouts
            .filter((w) => matches(w.dayTitle, w.planTitle, ...w.exerciseNames))
            .map((w) => ({
              key: w.id,
              onClick: () => setDetail({ kind: "workout", id: w.id }),
              title: (
                <span className="flex items-center gap-2">
                  {w.dayTitle ?? "Quick log"}
                  <DayTypeBadge type={w.dayType} compact />
                </span>
              ),
              sub: [
                formatDay(w.date),
                w.planTitle,
                `${w.stats.sets} sets`,
                w.stats.reps ? `${formatNumber(w.stats.reps)} reps` : null,
                w.stats.volume ? `${formatNumber(w.stats.volume)} lb` : null,
                w.stats.durationSeconds ? formatDuration(w.stats.durationSeconds) : null,
                w.status !== "completed" ? "in progress" : null,
              ]
                .filter(Boolean)
                .join(" · "),
              detail: w.exerciseNames.join(", "),
            }))}
        />
      ) : segment === "plans" ? (
        <List
          empty="No plans yet."
          items={data.plans
            .filter((p) => matches(p.title))
            .map((p) => ({
              key: p.id,
              onClick: () => setDetail({ kind: "plan", id: p.id }),
              title: p.title,
              sub: [
                p.status,
                p.startDate && p.endDate ? `${formatDay(p.startDate)} – ${formatDay(p.endDate)}` : null,
                `${data.workouts.filter((w) => w.planId === p.id && w.status === "completed").length} workouts`,
              ]
                .filter(Boolean)
                .join(" · "),
            }))}
        />
      ) : (
        <List
          empty="Log some sets to build your exercise history."
          items={data.exercises
            .filter((e) => matches(e.name, e.category))
            .map((e) => ({
              key: e.exerciseId,
              onClick: () => setDetail({ kind: "exercise", exercise: e }),
              title: e.name,
              sub: `${e.sessions} session${e.sessions > 1 ? "s" : ""} · last ${formatDay(e.lastDate)} · best ${headline(e.best)}`,
            }))}
        />
      )}
    </div>
  );
}

function List({
  items,
  empty,
}: {
  items: { key: string; onClick: () => void; title: React.ReactNode; sub: string; detail?: string }[];
  empty: string;
}) {
  if (items.length === 0) return <p className="py-6 text-center text-sm text-neutral-500">{empty}</p>;
  return (
    <div className={cn(cardClass, "divide-y divide-neutral-100 p-0 dark:divide-neutral-800")}>
      {items.map((item) => (
        <button
          key={item.key}
          onClick={item.onClick}
          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
        >
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{item.title}</div>
            <p className="text-xs text-neutral-500">{item.sub}</p>
            {item.detail && <p className="truncate text-xs text-neutral-400">{item.detail}</p>}
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" />
        </button>
      ))}
    </div>
  );
}

type HistorySet = {
  setId: string;
  workoutLogId: string;
  reps: number | null;
  weight: string | null;
  durationSeconds: number | null;
  distance: string | null;
  date: string | null;
};

function ExerciseHistory({ exercise, onBack }: { exercise: HistoryExercise; onBack: () => void }) {
  const [rows, setRows] = useState<HistorySet[] | null>(null);

  useEffect(() => {
    apiFetch<{ history: HistorySet[] }>(`/api/fitness/exercises/${exercise.exerciseId}/history`)
      .then((res) => setRows(res.history))
      .catch(() => setRows([]));
  }, [exercise.exerciseId]);

  const sessions = useMemo(() => {
    const map = new Map<string, HistorySet[]>();
    for (const r of rows ?? []) map.set(r.workoutLogId, [...(map.get(r.workoutLogId) ?? []), r]);
    return [...map.values()].map((sets) => ({ date: sets[0].date ?? "", sets, stats: computeSetStats(sets) }));
  }, [rows]);

  const metric = headlineMetric(exercise.best).metric;
  const chartLabel =
    metric === "e1rm" ? "Est. 1RM (lb)" : metric === "reps" ? "Best set (reps)" : metric === "duration" ? "Longest (sec)" : "";
  const chartData = sessions
    .map((s) => ({ date: s.date.slice(5, 10), value: Math.round(headlineMetric(s.stats).value * 10) / 10 }))
    .filter((d) => d.value > 0);

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
      >
        <ChevronLeft className="h-4 w-4" />
        Back
      </button>
      <div className={cardClass}>
        <h2 className="text-lg font-semibold">{exercise.name}</h2>
        <p className="text-sm capitalize text-neutral-500">
          {exercise.category} · {exercise.sessions} sessions · best {headline(exercise.best)}
        </p>
      </div>

      {chartData.length > 1 && (
        <div className={cardClass}>
          <h3 className="mb-2 text-sm font-semibold">{chartLabel}</h3>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" strokeOpacity={0.1} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} width={44} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v) => [v, chartLabel]} />
                <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className={cn(cardClass, "divide-y divide-neutral-100 p-0 dark:divide-neutral-800")}>
        {rows === null && <p className="p-4 text-sm text-neutral-500">Loading…</p>}
        {[...sessions].reverse().map((s, i) => (
          <div key={i} className="space-y-0.5 px-4 py-3">
            <div className="flex justify-between text-sm">
              <span className="font-medium">{formatDay(s.date)}</span>
              <span className="text-xs text-neutral-500">
                {s.stats.sets} sets
                {s.stats.volume ? ` · ${formatNumber(s.stats.volume)} lb` : ""}
                {s.stats.durationSeconds ? ` · ${formatDuration(s.stats.durationSeconds)}` : ""}
              </span>
            </div>
            <p className="text-xs text-neutral-600 dark:text-neutral-400">{s.sets.map(describeSet).join(", ")}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
