import { computeSetStats, emptyStats, headlineMetric, mergeStats } from "@/lib/fitness/stats";
import type { InferSelectModel } from "drizzle-orm";
import type { fitnessPlans } from "@/lib/db/schema";
import type {
  DayType,
  ExerciseCategory,
  HistoryExercise,
  HistoryWorkout,
  LoggedExerciseRow,
  LoggedSetRow,
  PlanReview,
  PlanRow,
  SetStats,
  WorkoutLogRow,
  WorkoutSummary,
} from "@/lib/fitness/types";

// Pure report builders over already-fetched rows (no DB access here) so the
// maths behind the workout summary, plan review and history views is unit
// testable. API routes fetch the rows and hand them in.

type DateLike = Date | string;

export type SetRow = {
  workoutLogId: string;
  date: DateLike;
  loggedExerciseId: string;
  exerciseId: string;
  exerciseName: string;
  category: ExerciseCategory;
  reps: number | null;
  weight: string | null;
  durationSeconds: number | null;
  distance: string | null;
};

// Rows straight from Drizzle carry Date objects where the client types have
// ISO strings; they serialize to exactly those strings over JSON.
type ExerciseInput = Omit<LoggedExerciseRow, "sets"> & {
  sets: (Omit<LoggedSetRow, "completedAt"> & { completedAt: DateLike | null })[];
};

type LogLike = Omit<WorkoutLogRow, "date" | "startTime" | "endTime" | "createdAt"> & {
  date: DateLike;
  startTime: DateLike | null;
  endTime: DateLike | null;
  createdAt: DateLike;
};

const iso = (d: DateLike) => (typeof d === "string" ? d : d.toISOString());
const dayKey = (d: DateLike) => iso(d).slice(0, 10);

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}

/** True when `after` beats `before` on the exercise's headline metric. */
function beats(before: SetStats, after: SetStats): boolean {
  const a = headlineMetric(before);
  const b = headlineMetric(after);
  return a.metric !== "none" && a.metric === b.metric && b.value > a.value;
}

// ---------------------------------------------------------------------------
// Single workout
// ---------------------------------------------------------------------------

export function buildWorkoutSummary(input: {
  log: LogLike;
  exercises: ExerciseInput[];
  planTitle: string | null;
  dayTitle: string | null;
  dayType: DayType | null;
  targets: {
    exerciseId: string;
    targetSets: number | null;
    targetReps: number | null;
    targetWeight: string | null;
    targetDurationSeconds: number | null;
  }[];
  /** The user's sets for the exercises in this workout, from all workouts. */
  historyRows: SetRow[];
}): WorkoutSummary {
  const { log } = input;
  const thisDay = dayKey(log.date);
  // Only workouts on or before this one count as "previous".
  const prior = input.historyRows.filter(
    (r) => r.workoutLogId !== log.id && dayKey(r.date) <= thisDay,
  );
  const priorByExercise = groupBy(prior, (r) => r.exerciseId);
  const targetByExercise = new Map(input.targets.map((t) => [t.exerciseId, t]));

  let prCount = 0;
  let totals = emptyStats();
  const exercises = input.exercises.map((ex) => {
    const stats = computeSetStats(ex.sets);
    totals = mergeStats(totals, stats);

    const history = priorByExercise.get(ex.exerciseId) ?? [];
    const allPrior = computeSetStats(history);
    let previous: WorkoutSummary["exercises"][number]["previous"] = null;
    if (history.length) {
      const sessions = [...groupBy(history, (r) => r.workoutLogId).values()].sort((a, b) =>
        iso(a[0].date) < iso(b[0].date) ? -1 : 1,
      );
      const lastRows = sessions[sessions.length - 1];
      previous = { date: iso(lastRows[0].date), stats: computeSetStats(lastRows) };
    }
    const isPr = history.length > 0 && beats(allPrior, stats);
    if (isPr) prCount += 1;

    const target = targetByExercise.get(ex.exerciseId);
    return {
      loggedExerciseId: ex.id,
      exerciseId: ex.exerciseId,
      name: ex.exerciseName,
      category: ex.exerciseCategory,
      sets: ex.sets as LoggedSetRow[],
      stats,
      target: target
        ? {
            sets: target.targetSets,
            reps: target.targetReps,
            weight: target.targetWeight,
            durationSeconds: target.targetDurationSeconds,
          }
        : null,
      previous,
      isPr,
    };
  });

  const plannedSets = input.targets.reduce((sum, t) => sum + (t.targetSets ?? 1), 0);
  let doneSets = 0;
  for (const t of input.targets) {
    const logged = input.exercises
      .filter((e) => e.exerciseId === t.exerciseId)
      .reduce((n, e) => n + e.sets.length, 0);
    doneSets += Math.min(logged, t.targetSets ?? 1);
  }

  const start = log.startTime ? new Date(log.startTime).getTime() : null;
  const end = log.endTime ? new Date(log.endTime).getTime() : null;

  return {
    log: {
      ...log,
      date: iso(log.date),
      startTime: log.startTime ? iso(log.startTime) : null,
      endTime: log.endTime ? iso(log.endTime) : null,
      createdAt: iso(log.createdAt),
    },
    planTitle: input.planTitle,
    dayTitle: input.dayTitle,
    dayType: input.dayType,
    elapsedSeconds: start && end && end > start ? Math.round((end - start) / 1000) : null,
    totals,
    exercises,
    prCount,
    targetCompletion: plannedSets > 0 ? doneSets / plannedSets : null,
  };
}

// ---------------------------------------------------------------------------
// Whole plan
// ---------------------------------------------------------------------------

export function buildPlanReview(input: {
  plan: PlanRow | InferSelectModel<typeof fitnessPlans>;
  days: {
    id: string;
    weekNumber: number | null;
    dayType: DayType | null;
    title: string;
    scheduledDate: DateLike | null;
  }[];
  logs: { log: LogLike; dayTitle: string | null; dayType: DayType | null }[];
  setRows: SetRow[];
  today: string; // YYYY-MM-DD
}): PlanReview {
  const trainingDays = input.days.filter((d) => d.dayType !== "rest");
  const completedLogs = input.logs.filter((l) => l.log.status === "completed");
  const completedDayIds = new Set(completedLogs.map((l) => l.log.planDayId).filter(Boolean));
  const setsByLog = groupBy(input.setRows, (r) => r.workoutLogId);
  const statsByLog = new Map(
    [...setsByLog.entries()].map(([id, rows]) => [id, computeSetStats(rows)]),
  );

  const skipped = trainingDays.filter(
    (d) => d.scheduledDate && dayKey(d.scheduledDate) < input.today && !completedDayIds.has(d.id),
  ).length;

  const dayById = new Map(input.days.map((d) => [d.id, d]));
  const weekNumbers = [...new Set(input.days.map((d) => d.weekNumber ?? 1))].sort((a, b) => a - b);
  const weeks = weekNumbers.map((weekNumber) => {
    const days = trainingDays.filter((d) => (d.weekNumber ?? 1) === weekNumber);
    const stats = input.logs
      .filter((l) => (dayById.get(l.log.planDayId ?? "")?.weekNumber ?? null) === weekNumber)
      .reduce((acc, l) => mergeStats(acc, statsByLog.get(l.log.id) ?? emptyStats()), emptyStats());
    return {
      weekNumber,
      scheduled: days.length,
      completed: days.filter((d) => completedDayIds.has(d.id)).length,
      volume: stats.volume,
      reps: stats.reps,
      durationSeconds: stats.durationSeconds,
    };
  });

  const types: DayType[] = ["gym", "home", "cardio", "recovery"];
  const byDayType = types
    .map((dayType) => {
      const days = trainingDays.filter((d) => d.dayType === dayType);
      return {
        dayType,
        scheduled: days.length,
        completed: days.filter((d) => completedDayIds.has(d.id)).length,
      };
    })
    .filter((t) => t.scheduled > 0);

  const exercises = [...groupBy(input.setRows, (r) => r.exerciseId).values()]
    .map((rows) => {
      const sessions = [...groupBy(rows, (r) => r.workoutLogId).values()].sort((a, b) =>
        iso(a[0].date) < iso(b[0].date) ? -1 : 1,
      );
      return {
        exerciseId: rows[0].exerciseId,
        name: rows[0].exerciseName,
        category: rows[0].category,
        sessions: sessions.length,
        first: computeSetStats(sessions[0]),
        last: computeSetStats(sessions[sessions.length - 1]),
        best: computeSetStats(rows),
      };
    })
    .sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name));

  return {
    plan: input.plan as PlanRow,
    scheduled: trainingDays.length,
    completed: trainingDays.filter((d) => completedDayIds.has(d.id)).length,
    skipped,
    totals: computeSetStats(input.setRows),
    weeks,
    byDayType,
    exercises,
    workouts: input.logs.map((l) => ({
      id: l.log.id,
      date: iso(l.log.date),
      title: l.dayTitle ?? l.log.activityType ?? "Workout",
      dayType: l.dayType,
      status: l.log.status,
      stats: statsByLog.get(l.log.id) ?? emptyStats(),
    })),
  };
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

export function buildHistory(input: {
  logs: { log: LogLike; planTitle: string | null; dayTitle: string | null; dayType: DayType | null }[];
  setRows: SetRow[];
}): { workouts: HistoryWorkout[]; exercises: HistoryExercise[] } {
  const setsByLog = groupBy(input.setRows, (r) => r.workoutLogId);

  const workouts = input.logs.map(({ log, planTitle, dayTitle, dayType }) => {
    const rows = setsByLog.get(log.id) ?? [];
    return {
      id: log.id,
      date: iso(log.date),
      status: log.status,
      startTime: log.startTime ? iso(log.startTime) : null,
      endTime: log.endTime ? iso(log.endTime) : null,
      planId: log.planId,
      planTitle,
      dayTitle,
      dayType,
      exerciseNames: [...new Set(rows.map((r) => r.exerciseName))],
      stats: computeSetStats(rows),
    };
  });

  const exercises = [...groupBy(input.setRows, (r) => r.exerciseId).values()]
    .map((rows) => ({
      exerciseId: rows[0].exerciseId,
      name: rows[0].exerciseName,
      category: rows[0].category,
      sessions: new Set(rows.map((r) => r.workoutLogId)).size,
      lastDate: rows.reduce((max, r) => (iso(r.date) > max ? iso(r.date) : max), ""),
      best: computeSetStats(rows),
    }))
    .sort((a, b) => (a.lastDate < b.lastDate ? 1 : -1));

  return { workouts, exercises };
}
