import { describe, expect, it } from "vitest";
import library from "@/data/exercises.json";
import {
  addDays,
  generatePlan,
  layoutWeek,
  progressExercise,
  weekdayIndex,
  type LibraryExercise,
} from "@/lib/fitness/generator";
import type { DraftExercise, FocusScores } from "@/lib/fitness/types";

const LIB: LibraryExercise[] = (library as Omit<LibraryExercise, "id">[]).map((e, i) => ({
  ...e,
  id: `ex-${i}`,
}));

const BALANCED: FocusScores = {
  strength: 7,
  hypertrophy: 6,
  endurance: 4,
  flexibility: 4,
  stability: 4,
  athleticism: 4,
};

const base = {
  title: "Test block",
  focus: BALANCED,
  weeklyMix: { gym: 3, home: 1, cardio: 1, recovery: 1 },
  splitType: "weekly" as const,
  progressive: false,
  startDate: "2026-09-28", // a Monday
};

describe("date helpers", () => {
  it("adds days across month boundaries", () => {
    expect(addDays("2026-09-28", 7)).toBe("2026-10-05");
  });
  it("uses Monday = 0", () => {
    expect(weekdayIndex("2026-09-28")).toBe(0);
    expect(weekdayIndex("2026-10-04")).toBe(6);
  });
});

describe("layoutWeek", () => {
  it("places exactly the requested day types and fills the rest with rest days", () => {
    const week = layoutWeek({ gym: 3, home: 0, cardio: 1, recovery: 1 });
    expect(week).toHaveLength(7);
    expect(week.filter((t) => t === "gym")).toHaveLength(3);
    expect(week.filter((t) => t === "cardio")).toHaveLength(1);
    expect(week.filter((t) => t === "recovery")).toHaveLength(1);
    expect(week.filter((t) => t === "rest")).toHaveLength(2);
  });

  it("avoids back-to-back strength days when lighter days are available", () => {
    const week = layoutWeek({ gym: 3, home: 0, cardio: 2, recovery: 1 });
    const training = week.filter((t) => t !== "rest");
    for (let i = 1; i < training.length; i++) {
      expect(training[i] === "gym" && training[i - 1] === "gym").toBe(false);
    }
  });

  it("is all rest for an empty mix", () => {
    expect(layoutWeek({ gym: 0, home: 0, cardio: 0, recovery: 0 })).toEqual(Array(7).fill("rest"));
  });
});

describe("generatePlan", () => {
  it("builds a 4-week, 28-day calendar starting on the chosen date", () => {
    const plan = generatePlan(base, LIB);
    expect(plan.days).toHaveLength(28);
    expect(plan.days[0].scheduledDate).toBe("2026-09-28");
    expect(plan.days[27].scheduledDate).toBe("2026-10-25");
    expect(new Set(plan.days.map((d) => d.weekNumber))).toEqual(new Set([1, 2, 3, 4]));
  });

  it("fills every training day with exercises and leaves rest days empty", () => {
    const plan = generatePlan(base, LIB);
    for (const day of plan.days) {
      if (day.dayType === "rest") expect(day.exercises).toHaveLength(0);
      else expect(day.exercises.length).toBeGreaterThan(0);
    }
  });

  it("only uses home-friendly equipment on home days", () => {
    const plan = generatePlan(base, LIB);
    const byId = new Map(LIB.map((e) => [e.id, e]));
    const gymOnly = new Set(["Barbell", "Machine", "Cable", "Smith Machine", "Sled", "Trap Bar", "T-Bar"]);
    for (const day of plan.days.filter((d) => d.dayType === "home")) {
      for (const ex of day.exercises) {
        expect(gymOnly.has(byId.get(ex.exerciseId)!.equipment ?? "")).toBe(false);
      }
    }
  });

  it("never repeats an exercise within a day", () => {
    const plan = generatePlan({ ...base, focus: { ...BALANCED, stability: 9, flexibility: 9, athleticism: 9 } }, LIB);
    for (const day of plan.days) {
      const ids = day.exercises.map((e) => e.exerciseId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("repeats week 1 for a weekly split and alternates for biweekly", () => {
    const ids = (p: ReturnType<typeof generatePlan>, w: number) =>
      p.days.filter((d) => d.weekNumber === w).flatMap((d) => d.exercises.map((e) => e.exerciseId));

    const weekly = generatePlan(base, LIB);
    expect(ids(weekly, 2)).toEqual(ids(weekly, 1));
    expect(ids(weekly, 4)).toEqual(ids(weekly, 1));

    const biweekly = generatePlan({ ...base, splitType: "biweekly" }, LIB);
    expect(ids(biweekly, 3)).toEqual(ids(biweekly, 1));
    expect(ids(biweekly, 4)).toEqual(ids(biweekly, 2));
    expect(ids(biweekly, 2)).not.toEqual(ids(biweekly, 1));
  });

  it("is deterministic for a seed and changes with a new seed", () => {
    const a = generatePlan({ ...base, seed: 7 }, LIB);
    const b = generatePlan({ ...base, seed: 7 }, LIB);
    const c = generatePlan({ ...base, seed: 8 }, LIB);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it("uses heavier, lower-rep main lifts when strength dominates", () => {
    const heavy = generatePlan({ ...base, focus: { ...BALANCED, strength: 10, hypertrophy: 2, endurance: 1 } }, LIB);
    const firstGym = heavy.days.find((d) => d.dayType === "gym")!;
    expect(firstGym.exercises[0].targetReps).toBeLessThanOrEqual(6);
  });

  it("marks week 4 as a deload when progressive", () => {
    const plan = generatePlan({ ...base, progressive: true }, LIB);
    const w4 = plan.days.find((d) => d.weekNumber === 4 && d.dayType === "gym")!;
    expect(w4.notes).toMatch(/deload/i);
  });
});

describe("progressExercise", () => {
  const ex: DraftExercise = {
    exerciseId: "x",
    name: "Squat",
    category: "strength",
    targetSets: 4,
    targetReps: 8,
    targetWeight: null,
    targetDurationSeconds: null,
    targetRestSeconds: 90,
    notes: null,
  };
  it("adds reps, then a set, then deloads", () => {
    expect(progressExercise(ex, 0)).toEqual(ex);
    expect(progressExercise(ex, 1).targetReps).toBe(9);
    expect(progressExercise(ex, 2)).toMatchObject({ targetReps: 10, targetSets: 5 });
    expect(progressExercise(ex, 3)).toMatchObject({ targetReps: 8, targetSets: 3 });
  });
});
