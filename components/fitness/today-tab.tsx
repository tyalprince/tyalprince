"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, CircleDot, Play, Sparkles, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { PlanWizard } from "./plan-wizard";
import { PlanReviewView } from "./plan-review";
import { WorkoutSession } from "./workout-session";
import { WorkoutSummaryView } from "./workout-summary";
import { DayTypeBadge, ProgressBar, cardClass, describeTarget, formatDay, localToday, selectClass } from "./shared";
import type { PlanDayRow, PlanDetail, PlanRow, WorkoutLogRow } from "@/lib/fitness/types";

type View =
  | { kind: "home" }
  | { kind: "wizard" }
  | { kind: "session"; id: string; title?: string }
  | { kind: "summary"; id: string; title?: string }
  | { kind: "review"; planId: string };

const isOpen = (log: WorkoutLogRow) => log.status === "planned" && !log.endTime;

export function TodayTab() {
  const [view, setView] = useState<View>({ kind: "home" });
  const [plans, setPlans] = useState<PlanRow[] | null>(null);
  const [logs, setLogs] = useState<WorkoutLogRow[]>([]);
  const [planId, setPlanId] = useState("");
  const [detail, setDetail] = useState<PlanDetail | null>(null);
  const [selectedDayId, setSelectedDayId] = useState("");
  const [starting, setStarting] = useState(false);
  const today = localToday();

  const load = useCallback(
    () =>
      Promise.all([
        apiFetch<{ plans: PlanRow[] }>("/api/fitness/plans"),
        apiFetch<{ logs: WorkoutLogRow[] }>("/api/fitness/workouts"),
      ])
        .then(([{ plans }, { logs }]) => {
          setPlans(plans);
          setLogs(logs);
          const active = plans.filter((p) => p.status === "active");
          setPlanId((current) => (active.some((p) => p.id === current) ? current : (active[0]?.id ?? "")));
        })
        .catch(() => setPlans((current) => current ?? [])),
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!planId) return;
    apiFetch<PlanDetail>(`/api/fitness/plans/${planId}`)
      .then((d) => {
        setDetail(d);
        const todays = d.days.find((day) => day.scheduledDate?.slice(0, 10) === today);
        const nextUp = d.days.find((day) => (day.scheduledDate?.slice(0, 10) ?? "") >= today);
        setSelectedDayId((todays ?? nextUp ?? d.days[0])?.id ?? "");
      })
      .catch(() => setDetail(null));
  }, [planId, today]);

  const planDetail = detail && detail.plan.id === planId ? detail : null;
  const activePlans = (plans ?? []).filter((p) => p.status === "active");

  const logsByDay = useMemo(() => {
    const map = new Map<string, WorkoutLogRow[]>();
    for (const log of logs) {
      if (!log.planDayId) continue;
      map.set(log.planDayId, [...(map.get(log.planDayId) ?? []), log]);
    }
    return map;
  }, [logs]);

  const dayStatus = (day: PlanDayRow): "done" | "open" | "none" => {
    const dayLogs = logsByDay.get(day.id) ?? [];
    if (dayLogs.some((l) => l.status === "completed")) return "done";
    if (dayLogs.some(isOpen)) return "open";
    return "none";
  };

  async function startPlanDay(day: PlanDayRow) {
    const open = (logsByDay.get(day.id) ?? []).find(isOpen);
    if (open) return setView({ kind: "session", id: open.id, title: day.title });
    setStarting(true);
    try {
      const { log } = await apiFetch<{ log: WorkoutLogRow }>("/api/fitness/workouts", {
        method: "POST",
        body: JSON.stringify({
          planId,
          planDayId: day.id,
          date: today,
          status: "planned",
          fromPlanDay: true,
        }),
      });
      setView({ kind: "session", id: log.id, title: day.title });
    } finally {
      setStarting(false);
    }
  }

  async function startFreeform() {
    setStarting(true);
    try {
      const { log } = await apiFetch<{ log: WorkoutLogRow }>("/api/fitness/workouts", {
        method: "POST",
        body: JSON.stringify({ date: today, status: "planned" }),
      });
      setView({ kind: "session", id: log.id, title: "Quick log" });
    } finally {
      setStarting(false);
    }
  }

  async function completePlan() {
    await apiFetch(`/api/fitness/plans/${planId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "completed" }),
    });
    const id = planId;
    await load();
    setView({ kind: "review", planId: id });
  }

  function goHome() {
    setView({ kind: "home" });
    load();
  }

  // ---------------------------------------------------------------------
  // Non-home views
  // ---------------------------------------------------------------------

  if (view.kind === "wizard") {
    return (
      <PlanWizard
        onCancel={() => setView({ kind: "home" })}
        onCreated={(plan) => {
          setPlanId(plan.id);
          goHome();
        }}
      />
    );
  }
  if (view.kind === "session") {
    return (
      <WorkoutSession
        workoutLogId={view.id}
        title={view.title}
        onFinish={(id) => setView({ kind: "summary", id, title: view.title })}
        onClose={goHome}
      />
    );
  }
  if (view.kind === "summary") {
    return (
      <WorkoutSummaryView
        workoutLogId={view.id}
        onDone={goHome}
        onKeepLogging={() => setView({ kind: "session", id: view.id, title: view.title })}
      />
    );
  }
  if (view.kind === "review") {
    return <PlanReviewView planId={view.planId} onBack={goHome} />;
  }

  // ---------------------------------------------------------------------
  // Home
  // ---------------------------------------------------------------------

  if (plans === null) return <p className="text-sm text-neutral-500">Loading…</p>;

  const openFreeform = logs.filter((l) => isOpen(l) && !l.planDayId);
  const scheduled = planDetail?.days.some((d) => d.scheduledDate) ?? false;

  return (
    <div className="space-y-4">
      {activePlans.length === 0 && (
        <div className={cn(cardClass, "space-y-3 border-indigo-200 dark:border-indigo-900")}>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-500" />
            <h2 className="text-base font-semibold">
              {plans.length === 0 ? "Build your workout plan" : "Start your next plan"}
            </h2>
          </div>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Name it, rate what you want to focus on, choose your gym / home / cardio / recovery days and how weeks
            should vary — we&apos;ll generate a 4-week split you can review and edit before you start.
          </p>
          <Button onClick={() => setView({ kind: "wizard" })} className="w-full sm:w-auto">
            <Sparkles className="h-4 w-4" />
            Build a workout plan
          </Button>
        </div>
      )}

      {activePlans.length > 1 && (
        <select value={planId} onChange={(e) => setPlanId(e.target.value)} className={cn(selectClass, "w-full")}>
          {activePlans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      )}

      {planDetail && scheduled && (
        <ScheduledPlan
          detail={planDetail}
          today={today}
          selectedDayId={selectedDayId}
          onSelectDay={setSelectedDayId}
          dayStatus={dayStatus}
          logsByDay={logsByDay}
          starting={starting}
          onStart={startPlanDay}
          onOpenSummary={(log, title) => setView({ kind: "summary", id: log.id, title })}
          onReview={() => setView({ kind: "review", planId })}
          onComplete={completePlan}
        />
      )}

      {planDetail && !scheduled && (
        <LegacyPlan detail={planDetail} starting={starting} onStart={startPlanDay} />
      )}

      {openFreeform.length > 0 && (
        <div className={cn(cardClass, "space-y-2")}>
          <h2 className="text-sm font-semibold">Unfinished workouts</h2>
          {openFreeform.map((log) => (
            <div key={log.id} className="flex items-center justify-between text-sm">
              <span>
                {formatDay(log.date)} · {log.activityType ?? "Quick log"}
              </span>
              <Button variant="secondary" onClick={() => setView({ kind: "session", id: log.id })}>
                Resume
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className={cardClass}>
        <h2 className="mb-2 text-sm font-semibold">Off-plan workout</h2>
        <Button variant={activePlans.length ? "secondary" : "primary"} onClick={startFreeform} disabled={starting}>
          <Play className="h-4 w-4" />
          Freeform / quick log
        </Button>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          Log any exercise on the fly — pickup basketball, a freeform run, or an unplanned lift.
        </p>
        {activePlans.length > 0 && (
          <button
            onClick={() => setView({ kind: "wizard" })}
            className="mt-3 text-xs text-indigo-600 underline dark:text-indigo-400"
          >
            Build another plan
          </button>
        )}
      </div>
    </div>
  );
}

function ScheduledPlan({
  detail,
  today,
  selectedDayId,
  onSelectDay,
  dayStatus,
  logsByDay,
  starting,
  onStart,
  onOpenSummary,
  onReview,
  onComplete,
}: {
  detail: PlanDetail;
  today: string;
  selectedDayId: string;
  onSelectDay: (id: string) => void;
  dayStatus: (day: PlanDayRow) => "done" | "open" | "none";
  logsByDay: Map<string, WorkoutLogRow[]>;
  starting: boolean;
  onStart: (day: PlanDayRow) => void;
  onOpenSummary: (log: WorkoutLogRow, title: string) => void;
  onReview: () => void;
  onComplete: () => void;
}) {
  const { plan, days } = detail;
  const training = days.filter((d) => d.dayType !== "rest");
  const completed = training.filter((d) => dayStatus(d) === "done").length;
  const lastDate = days[days.length - 1]?.scheduledDate?.slice(0, 10) ?? "";
  const finished = training.length > 0 && (completed === training.length || today > lastDate);
  const selected = days.find((d) => d.id === selectedDayId) ?? days[0];
  const weekCount = Math.max(...days.map((d) => d.weekNumber ?? 1));
  const week = selected?.weekNumber ?? 1;
  const weekDays = days.filter((d) => (d.weekNumber ?? 1) === week);
  const todayWeek = days.find((d) => d.scheduledDate?.slice(0, 10) === today)?.weekNumber;

  function shiftWeek(delta: number) {
    const target = days.find((d) => d.weekNumber === week + delta && d.dayOfWeek === selected?.dayOfWeek);
    const fallback = days.find((d) => d.weekNumber === week + delta);
    if (target ?? fallback) onSelectDay((target ?? fallback)!.id);
  }

  const status = selected ? dayStatus(selected) : "none";
  const selectedLogs = selected ? (logsByDay.get(selected.id) ?? []) : [];
  const doneLog = selectedLogs.find((l) => l.status === "completed");
  const isToday = selected?.scheduledDate?.slice(0, 10) === today;

  return (
    <>
      <div className={cn(cardClass, "space-y-2")}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">{plan.title}</h2>
            <p className="text-xs text-neutral-500">
              {todayWeek ? `Week ${todayWeek} of ${weekCount}` : today < (days[0]?.scheduledDate ?? "") ? "Starts soon" : "Plan window ended"}
            </p>
          </div>
          <Button variant="ghost" className="px-2 text-xs" onClick={onReview}>
            Progress
          </Button>
        </div>
        <div className="flex justify-between text-xs text-neutral-500">
          <span>
            {completed}/{training.length} workouts
          </span>
          <span>{training.length ? Math.round((completed / training.length) * 100) : 0}%</span>
        </div>
        <ProgressBar value={training.length ? completed / training.length : 0} />
      </div>

      {finished && (
        <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
            <Trophy className="h-4 w-4" />
            {completed === training.length ? "You finished every workout in this plan!" : "This plan's 4 weeks are up."}
          </p>
          <p className="text-xs text-amber-800 dark:text-amber-300">
            See where you progressed — volume, reps, time and every exercise, first session vs. last.
          </p>
          <Button onClick={onComplete}>Complete plan & see review</Button>
        </div>
      )}

      <div className={cn(cardClass, "space-y-3")}>
        <div className="flex items-center justify-between">
          <button
            onClick={() => shiftWeek(-1)}
            disabled={week <= 1}
            className="rounded p-1 text-neutral-500 disabled:opacity-30"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium">Week {week}</span>
          <button
            onClick={() => shiftWeek(1)}
            disabled={week >= weekCount}
            className="rounded p-1 text-neutral-500 disabled:opacity-30"
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((d) => {
            const s = dayStatus(d);
            const date = d.scheduledDate?.slice(0, 10) ?? "";
            return (
              <button
                key={d.id}
                onClick={() => onSelectDay(d.id)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-md border py-1.5 text-[11px]",
                  d.id === selected?.id
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40"
                    : "border-transparent hover:bg-neutral-50 dark:hover:bg-neutral-800",
                )}
              >
                <span className={cn(date === today ? "font-bold text-indigo-600 dark:text-indigo-400" : "text-neutral-500")}>
                  {formatDay(date).slice(0, 3)}
                </span>
                <span className="text-xs tabular-nums">{Number(date.slice(8, 10))}</span>
                <DayTypeBadge type={d.dayType} compact className="px-1" />
                {s === "done" ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" aria-label="Completed" />
                ) : s === "open" ? (
                  <CircleDot className="h-3.5 w-3.5 text-amber-500" aria-label="In progress" />
                ) : (
                  <span className="h-3.5" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {selected && (
        <div className={cn(cardClass, "space-y-3")}>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                {isToday ? "Today" : formatDay(selected.scheduledDate ?? "")}
              </span>
              <DayTypeBadge type={selected.dayType} />
            </div>
            <h3 className="mt-1 text-lg font-semibold">{selected.title}</h3>
            {selected.notes && <p className="text-xs text-amber-700 dark:text-amber-400">{selected.notes}</p>}
          </div>

          {selected.dayType === "rest" ? (
            <p className="text-sm text-neutral-500">
              Rest day — let your body recover. Feeling good? Log a quick session below.
            </p>
          ) : (
            <>
              <ul className="space-y-1.5">
                {selected.exercises.map((ex) => (
                  <li key={ex.id} className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate">{ex.exerciseName}</span>
                    <span className="shrink-0 text-xs text-neutral-500">{describeTarget(ex)}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                {status === "done" && doneLog ? (
                  <>
                    <Button variant="secondary" onClick={() => onOpenSummary(doneLog, selected.title)}>
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      View summary
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => onStart(selected)} disabled={starting}>
                    <Play className="h-4 w-4" />
                    {status === "open" ? "Resume workout" : isToday ? "Start today's workout" : "Start this workout"}
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

/** Hand-built plans from before the wizard: no calendar, just pick a day. */
function LegacyPlan({
  detail,
  starting,
  onStart,
}: {
  detail: PlanDetail;
  starting: boolean;
  onStart: (day: PlanDayRow) => void;
}) {
  const [dayId, setDayId] = useState(detail.days[0]?.id ?? "");
  const day = detail.days.find((d) => d.id === dayId);
  return (
    <div className={cn(cardClass, "space-y-2")}>
      <h2 className="text-sm font-semibold">Follow {detail.plan.title}</h2>
      <div className="flex flex-wrap gap-2">
        <select value={dayId} onChange={(e) => setDayId(e.target.value)} className={selectClass}>
          {detail.days.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title}
            </option>
          ))}
        </select>
        <Button variant="secondary" onClick={() => day && onStart(day)} disabled={!day || starting}>
          Start this day
        </Button>
      </div>
    </div>
  );
}
