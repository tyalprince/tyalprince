import { describe, expect, it } from "vitest";
import {
  checkEndurancePr,
  checkStrengthPr,
  computePace,
  computePersonalRecords,
  estimateOneRepMax,
} from "@/lib/fitness/pr";

describe("estimateOneRepMax", () => {
  it("returns the weight directly for a single rep", () => {
    expect(estimateOneRepMax(225, 1)).toBe(225);
  });

  it("estimates a higher 1RM for more reps at the same weight", () => {
    const e1rmFor5 = estimateOneRepMax(200, 5);
    const e1rmFor10 = estimateOneRepMax(200, 10);
    expect(e1rmFor10).toBeGreaterThan(e1rmFor5);
    expect(e1rmFor5).toBeGreaterThan(200);
  });

  it("returns 0 for invalid input", () => {
    expect(estimateOneRepMax(0, 5)).toBe(0);
    expect(estimateOneRepMax(100, 0)).toBe(0);
  });
});

describe("checkStrengthPr", () => {
  it("flags a PR when there is no prior history", () => {
    const result = checkStrengthPr({ weight: 135, reps: 5, date: "2024-01-01" }, []);
    expect(result.isPr).toBe(true);
    expect(result.previousBest).toBeNull();
  });

  it("flags a PR when the new set beats the best prior estimated 1RM", () => {
    const history = [
      { weight: 135, reps: 5, date: "2024-01-01" },
      { weight: 155, reps: 3, date: "2024-02-01" },
    ];
    const result = checkStrengthPr({ weight: 185, reps: 5, date: "2024-03-01" }, history);
    expect(result.isPr).toBe(true);
  });

  it("does not flag a PR when the new set is weaker than history", () => {
    const history = [{ weight: 225, reps: 5, date: "2024-01-01" }];
    const result = checkStrengthPr({ weight: 135, reps: 5, date: "2024-02-01" }, history);
    expect(result.isPr).toBe(false);
    expect(result.previousBest).toBeCloseTo(estimateOneRepMax(225, 5));
  });

  it("does not flag a PR for an equal estimated 1RM", () => {
    const history = [{ weight: 200, reps: 5, date: "2024-01-01" }];
    const result = checkStrengthPr({ weight: 200, reps: 5, date: "2024-02-01" }, history);
    expect(result.isPr).toBe(false);
  });

  it("returns not-a-PR when weight or reps are missing", () => {
    const result = checkStrengthPr({ weight: null, reps: 5, date: "2024-01-01" }, []);
    expect(result.isPr).toBe(false);
    expect(result.metric).toBeNull();
  });

  it("ignores incomplete prior sets when computing the previous best", () => {
    const history = [
      { weight: null, reps: 10, date: "2024-01-01" },
      { weight: 135, reps: 5, date: "2024-01-15" },
    ];
    const result = checkStrengthPr({ weight: 145, reps: 5, date: "2024-02-01" }, history);
    expect(result.isPr).toBe(true);
  });
});

describe("computePace", () => {
  it("computes seconds per unit distance", () => {
    expect(computePace(5, 1500)).toBe(300); // 5 miles in 1500s = 300s/mile
  });

  it("returns null for zero or negative inputs", () => {
    expect(computePace(0, 100)).toBeNull();
    expect(computePace(5, 0)).toBeNull();
  });
});

describe("checkEndurancePr", () => {
  it("flags a PR when there is no prior history", () => {
    const result = checkEndurancePr(
      { distance: 5, durationSeconds: 1500, date: "2024-01-01" },
      [],
    );
    expect(result.isPr).toBe(true);
  });

  it("flags a PR when the new pace is faster (lower seconds/unit) than history", () => {
    const history = [{ distance: 5, durationSeconds: 1600, date: "2024-01-01" }]; // 320 s/mi
    const result = checkEndurancePr(
      { distance: 5, durationSeconds: 1500, date: "2024-02-01" }, // 300 s/mi — faster
      history,
    );
    expect(result.isPr).toBe(true);
  });

  it("does not flag a PR when the new pace is slower than history", () => {
    const history = [{ distance: 5, durationSeconds: 1400, date: "2024-01-01" }]; // 280 s/mi
    const result = checkEndurancePr(
      { distance: 5, durationSeconds: 1600, date: "2024-02-01" }, // 320 s/mi — slower
      history,
    );
    expect(result.isPr).toBe(false);
  });

  it("returns not-a-PR when distance or duration are missing", () => {
    const result = checkEndurancePr(
      { distance: null, durationSeconds: 1500, date: "2024-01-01" },
      [],
    );
    expect(result.isPr).toBe(false);
  });
});

describe("computePersonalRecords", () => {
  it("picks the max estimated-1RM set as the strength record", () => {
    const records = computePersonalRecords([
      { exerciseId: "e1", exerciseName: "Barbell Squat", category: "strength", reps: 5, weight: 185, durationSeconds: null, distance: null, distanceUnit: null, date: "2024-01-01" },
      { exerciseId: "e1", exerciseName: "Barbell Squat", category: "strength", reps: 5, weight: 225, durationSeconds: null, distance: null, distanceUnit: null, date: "2024-02-01" },
      { exerciseId: "e1", exerciseName: "Barbell Squat", category: "strength", reps: 5, weight: 200, durationSeconds: null, distance: null, distanceUnit: null, date: "2024-03-01" },
    ]);
    expect(records).toHaveLength(1);
    expect(records[0].metric).toBe("estimated1RM");
    expect(records[0].achievedAt).toBe("2024-02-01");
  });

  it("picks the fastest pace set as the endurance record", () => {
    const records = computePersonalRecords([
      { exerciseId: "e2", exerciseName: "Long Run", category: "running", reps: null, weight: null, durationSeconds: 1800, distance: 5, distanceUnit: "mi", date: "2024-01-01" },
      { exerciseId: "e2", exerciseName: "Long Run", category: "running", reps: null, weight: null, durationSeconds: 1500, distance: 5, distanceUnit: "mi", date: "2024-02-01" },
    ]);
    expect(records).toHaveLength(1);
    expect(records[0].metric).toBe("pace");
    expect(records[0].achievedAt).toBe("2024-02-01");
  });

  it("tracks records for multiple exercises independently", () => {
    const records = computePersonalRecords([
      { exerciseId: "e1", exerciseName: "Barbell Squat", category: "strength", reps: 5, weight: 185, durationSeconds: null, distance: null, distanceUnit: null, date: "2024-01-01" },
      { exerciseId: "e2", exerciseName: "Long Run", category: "running", reps: null, weight: null, durationSeconds: 1500, distance: 5, distanceUnit: "mi", date: "2024-01-01" },
    ]);
    expect(records.map((r) => r.exerciseId).sort()).toEqual(["e1", "e2"]);
  });

  it("ignores sets missing the fields needed for their metric", () => {
    const records = computePersonalRecords([
      { exerciseId: "e1", exerciseName: "Barbell Squat", category: "strength", reps: null, weight: 185, durationSeconds: null, distance: null, distanceUnit: null, date: "2024-01-01" },
    ]);
    expect(records).toHaveLength(0);
  });
});
