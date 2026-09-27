import { describe, expect, it } from "vitest";
import { buildHistory, buildPlanReview, buildWorkoutSummary, type SetRow } from "@/lib/fitness/reports";
import { computeSetStats, percentChange } from "@/lib/fitness/stats";
import type { PlanRow } from "@/lib/fitness/types";

const row = (over: Partial<SetRow>): SetRow => ({
  workoutLogId: "w1",
  date: "2026-09-01T00:00:00.000Z",
  loggedExerciseId: "le1",
  exerciseId: "squat",
  exerciseName: "Barbell Squat",
  category: "strength",
  reps: 5,
  weight: "100",
  durationSeconds: null,
  distance: null,
  ...over,
});

const log = (id: string, date: string, over: Record<string, unknown> = {}) => ({
  id,
  userId: "u",
  planId: "p",
  planDayId: null as string | null,
  date,
  startTime: null,
  endTime: null,
  notes: null,
  overallRpe: null,
  status: "completed" as const,
  activityType: null,
  createdAt: date,
  ...over,
});

describe("computeSetStats", () => {
  it("totals reps, volume and time and tracks bests", () => {
    const s = computeSetStats([
      { reps: 5, weight: "100", durationSeconds: null, distance: null },
      { reps: 8, weight: "80", durationSeconds: null, distance: null },
      { reps: null, weight: null, durationSeconds: 45, distance: null },
    ]);
    expect(s).toMatchObject({ sets: 3, reps: 13, volume: 1140, durationSeconds: 45, maxWeight: 100, maxReps: 8 });
    expect(s.bestE1rm).toBeCloseTo(116.67, 1);
  });

  it("compares like-for-like metrics only", () => {
    const heavy = computeSetStats([{ reps: 5, weight: 100, durationSeconds: null, distance: null }]);
    const heavier = computeSetStats([{ reps: 5, weight: 110, durationSeconds: null, distance: null }]);
    const timed = computeSetStats([{ reps: null, weight: null, durationSeconds: 60, distance: null }]);
    expect(percentChange(heavy, heavier)).toBeCloseTo(0.1);
    expect(percentChange(heavy, timed)).toBeNull();
  });
});

describe("buildWorkoutSummary", () => {
  it("compares against the previous session and flags PRs", () => {
    const summary = buildWorkoutSummary({
      log: log("w2", "2026-09-08T00:00:00.000Z", {
        planDayId: "d1",
        startTime: "2026-09-08T10:00:00.000Z",
        endTime: "2026-09-08T11:00:00.000Z",
      }),
      exercises: [
        {
          id: "le2",
          workoutLogId: "w2",
          exerciseId: "squat",
          orderIndex: 0,
          notes: null,
          exerciseName: "Barbell Squat",
          exerciseCategory: "strength",
          sets: [
            { id: "s1", loggedExerciseId: "le2", setNumber: 1, reps: 5, weight: "110", weightUnit: "lb", durationSeconds: null, distance: null, distanceUnit: null, restSeconds: null, rpe: null, completedAt: null },
          ],
        },
      ],
      planTitle: "Block",
      dayTitle: "Legs",
      dayType: "gym",
      targets: [{ exerciseId: "squat", targetSets: 2, targetReps: 5, targetWeight: null, targetDurationSeconds: null }],
      historyRows: [row({}), row({ workoutLogId: "w2", weight: "110" }), row({ workoutLogId: "w9", date: "2026-10-01T00:00:00.000Z", weight: "300" })],
    });
    expect(summary.elapsedSeconds).toBe(3600);
    expect(summary.exercises[0].previous?.stats.maxWeight).toBe(100);
    expect(summary.exercises[0].isPr).toBe(true); // later w9 is ignored
    expect(summary.prCount).toBe(1);
    expect(summary.targetCompletion).toBe(0.5);
  });
});

describe("buildPlanReview", () => {
  it("computes adherence, weekly totals and first-vs-last progress", () => {
    const plan = { id: "p", title: "Block", status: "active" } as PlanRow;
    const days = [
      { id: "d1", weekNumber: 1, dayType: "gym" as const, title: "Legs", scheduledDate: "2026-09-01" },
      { id: "d2", weekNumber: 1, dayType: "rest" as const, title: "Rest", scheduledDate: "2026-09-02" },
      { id: "d3", weekNumber: 2, dayType: "gym" as const, title: "Legs", scheduledDate: "2026-09-08" },
      { id: "d4", weekNumber: 2, dayType: "cardio" as const, title: "Run", scheduledDate: "2026-09-09" },
    ];
    const review = buildPlanReview({
      plan,
      days,
      logs: [
        { log: log("w1", "2026-09-01T00:00:00.000Z", { planDayId: "d1" }), dayTitle: "Legs", dayType: "gym" },
        { log: log("w2", "2026-09-08T00:00:00.000Z", { planDayId: "d3" }), dayTitle: "Legs", dayType: "gym" },
      ],
      setRows: [row({}), row({ workoutLogId: "w2", date: "2026-09-08T00:00:00.000Z", weight: "120" })],
      today: "2026-09-20",
    });
    expect(review.scheduled).toBe(3);
    expect(review.completed).toBe(2);
    expect(review.skipped).toBe(1);
    expect(review.weeks.map((w) => w.volume)).toEqual([500, 600]);
    expect(review.exercises[0]).toMatchObject({ sessions: 2 });
    expect(review.exercises[0].last.maxWeight).toBe(120);
    expect(review.byDayType).toEqual([
      { dayType: "gym", scheduled: 2, completed: 2 },
      { dayType: "cardio", scheduled: 1, completed: 0 },
    ]);
  });
});

describe("buildHistory", () => {
  it("rolls up workouts and exercises", () => {
    const history = buildHistory({
      logs: [{ log: log("w1", "2026-09-01T00:00:00.000Z"), planTitle: "Block", dayTitle: "Legs", dayType: "gym" }],
      setRows: [row({}), row({ reps: 3 })],
    });
    expect(history.workouts[0].stats.reps).toBe(8);
    expect(history.workouts[0].exerciseNames).toEqual(["Barbell Squat"]);
    expect(history.exercises[0]).toMatchObject({ sessions: 1, name: "Barbell Squat" });
  });
});
