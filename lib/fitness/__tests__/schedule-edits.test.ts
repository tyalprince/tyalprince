import { describe, expect, it } from "vitest";
import library from "@/data/exercises.json";
import { generatePlan, type LibraryExercise } from "@/lib/fitness/generator";
import { applyDayEdit, applyTargetEdit, matchingDayIndexes, progressFor } from "@/lib/fitness/schedule-edits";
import type { FocusScores } from "@/lib/fitness/types";

const LIB: LibraryExercise[] = (library as Omit<LibraryExercise, "id">[]).map((e, i) => ({ ...e, id: `ex-${i}` }));
const FOCUS: FocusScores = { strength: 8, hypertrophy: 5, endurance: 4, flexibility: 4, stability: 4, athleticism: 4 };

function biweekly(progressive: boolean) {
  return generatePlan(
    {
      title: "t",
      focus: FOCUS,
      weeklyMix: { gym: 3, home: 1, cardio: 1, recovery: 1 },
      splitType: "biweekly",
      progressive,
      startDate: "2026-09-28",
    },
    LIB,
  ).days;
}

const firstGym = (days: ReturnType<typeof biweekly>) => days.findIndex((d) => d.dayType === "gym");
const sameWeekday = (days: ReturnType<typeof biweekly>, idx: number, week: number) =>
  days.findIndex((d) => d.weekNumber === week && d.dayOfWeek === days[idx].dayOfWeek);

describe("matchingDayIndexes", () => {
  it("links week 1 with week 3 (not 2/4) in a bi-weekly split", () => {
    const days = biweekly(false);
    const idx = firstGym(days);
    const matched = matchingDayIndexes(days, idx, true).map((i) => days[i].weekNumber);
    expect(matched).toEqual([1, 3]);
  });

  it("touches only the edited day when syncing is off", () => {
    const days = biweekly(false);
    expect(matchingDayIndexes(days, firstGym(days), false)).toEqual([firstGym(days)]);
  });
});

describe("applyTargetEdit", () => {
  it("makes week 3 match week 1 exactly when there's no progression", () => {
    const days = biweekly(false);
    const idx = firstGym(days);
    let next = applyTargetEdit(days, idx, 0, "targetSets", 3, true);
    next = applyTargetEdit(next, idx, 0, "targetReps", 6, true);
    const w3 = sameWeekday(next, idx, 3);
    expect(next[w3].exercises[0]).toMatchObject({ targetSets: 3, targetReps: 6 });
    // Week 2 is the other half of the A/B split — untouched.
    const w2 = sameWeekday(next, idx, 2);
    expect(next[w2]).toEqual(days[w2]);
  });

  it("keeps week 3's progression on top of week 1's edited numbers", () => {
    const days = biweekly(true);
    const idx = firstGym(days);
    const w3 = sameWeekday(days, idx, 3);
    const gap = days[w3].exercises[0].targetReps! - days[idx].exercises[0].targetReps!;
    const next = applyTargetEdit(days, idx, 0, "targetReps", 12, true);
    expect(next[idx].exercises[0].targetReps).toBe(12);
    expect(next[w3].exercises[0].targetReps).toBe(12 + gap);
  });

  it("copies weight as-is and never drops a count below 1", () => {
    const days = biweekly(true);
    const idx = firstGym(days);
    const w3 = sameWeekday(days, idx, 3);
    let next = applyTargetEdit(days, idx, 0, "targetWeight", 135, true);
    next = applyTargetEdit(next, idx, 0, "targetSets", 1, true);
    expect(next[w3].exercises[0].targetWeight).toBe(135);
    expect(next[w3].exercises[0].targetSets).toBeGreaterThanOrEqual(1);
  });
});

describe("applyDayEdit + progressFor", () => {
  it("gives each matched week its own progression when a day is rebuilt", () => {
    const days = biweekly(true);
    const idx = firstGym(days);
    const fresh = days[idx].exercises.map((e) => ({ ...e, targetSets: 4, targetReps: 8 }));
    const next = applyDayEdit(days, idx, (d) => ({ ...d, exercises: progressFor(fresh, d.weekNumber, true) }), true);
    const w3 = sameWeekday(next, idx, 3);
    expect(next[idx].exercises[0]).toMatchObject({ targetSets: 4, targetReps: 8 });
    expect(next[w3].exercises[0]).toMatchObject({ targetSets: 5, targetReps: 10 });
  });
});
