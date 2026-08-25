export type StrengthSetInput = {
  weight: number | null;
  reps: number | null;
  date: string; // ISO date of the workout, for ordering
};

export type EnduranceSetInput = {
  distance: number | null;
  durationSeconds: number | null;
  date: string;
};

/** Epley formula estimated 1-rep max. */
export function estimateOneRepMax(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

export type PrCheckResult = {
  isPr: boolean;
  metric: "estimated1RM" | "pace" | null;
  previousBest: number | null;
  newBest: number | null;
};

/**
 * Checks whether the most recent set in a chronologically-sorted history is
 * a new personal record by estimated 1RM. `history` should be every prior
 * set for this exercise (not including the candidate), sorted oldest-first;
 * pass the candidate set separately so callers can check a set before it's
 * persisted.
 */
export function checkStrengthPr(
  candidate: StrengthSetInput,
  history: StrengthSetInput[],
): PrCheckResult {
  if (!candidate.weight || !candidate.reps) {
    return { isPr: false, metric: null, previousBest: null, newBest: null };
  }
  const candidateE1rm = estimateOneRepMax(candidate.weight, candidate.reps);

  const priorBest = history.reduce((max, set) => {
    if (!set.weight || !set.reps) return max;
    return Math.max(max, estimateOneRepMax(set.weight, set.reps));
  }, 0);

  return {
    isPr: candidateE1rm > priorBest,
    metric: "estimated1RM",
    previousBest: priorBest || null,
    newBest: candidateE1rm,
  };
}

/** Pace in seconds-per-unit-distance — lower is better. */
export function computePace(distance: number, durationSeconds: number): number | null {
  if (distance <= 0 || durationSeconds <= 0) return null;
  return durationSeconds / distance;
}

/**
 * Checks whether the candidate endurance set (run/ride) beats the user's
 * best (fastest) pace on record for this exercise.
 */
export function checkEndurancePr(
  candidate: EnduranceSetInput,
  history: EnduranceSetInput[],
): PrCheckResult {
  if (!candidate.distance || !candidate.durationSeconds) {
    return { isPr: false, metric: null, previousBest: null, newBest: null };
  }
  const candidatePace = computePace(candidate.distance, candidate.durationSeconds);
  if (candidatePace === null) {
    return { isPr: false, metric: null, previousBest: null, newBest: null };
  }

  const priorPaces = history
    .map((s) =>
      s.distance && s.durationSeconds ? computePace(s.distance, s.durationSeconds) : null,
    )
    .filter((p): p is number => p !== null);

  const priorBestPace = priorPaces.length > 0 ? Math.min(...priorPaces) : null;

  return {
    isPr: priorBestPace === null || candidatePace < priorBestPace,
    metric: "pace",
    previousBest: priorBestPace,
    newBest: candidatePace,
  };
}

const ENDURANCE_CATEGORIES = new Set(["cardio", "running", "cycling"]);

export type SetWithExercise = {
  exerciseId: string;
  exerciseName: string;
  category: string;
  reps: number | null;
  weight: number | null;
  durationSeconds: number | null;
  distance: number | null;
  distanceUnit: string | null;
  date: string;
};

export type PersonalRecord = {
  exerciseId: string;
  exerciseName: string;
  metric: "estimated1RM" | "pace";
  value: number;
  achievedAt: string;
  unit: string | null;
};

/** Reduces a user's full set history down to one current best per exercise
 *  — strength exercises by estimated 1RM, endurance exercises by pace. */
export function computePersonalRecords(sets: SetWithExercise[]): PersonalRecord[] {
  const bestByExercise = new Map<string, PersonalRecord>();

  for (const s of sets) {
    if (ENDURANCE_CATEGORIES.has(s.category)) {
      if (!s.distance || !s.durationSeconds) continue;
      const pace = computePace(s.distance, s.durationSeconds);
      if (pace === null) continue;
      const current = bestByExercise.get(s.exerciseId);
      if (!current || pace < current.value) {
        bestByExercise.set(s.exerciseId, {
          exerciseId: s.exerciseId,
          exerciseName: s.exerciseName,
          metric: "pace",
          value: pace,
          achievedAt: s.date,
          unit: s.distanceUnit,
        });
      }
    } else {
      if (!s.weight || !s.reps) continue;
      const e1rm = estimateOneRepMax(s.weight, s.reps);
      const current = bestByExercise.get(s.exerciseId);
      if (!current || e1rm > current.value) {
        bestByExercise.set(s.exerciseId, {
          exerciseId: s.exerciseId,
          exerciseName: s.exerciseName,
          metric: "estimated1RM",
          value: e1rm,
          achievedAt: s.date,
          unit: "lb",
        });
      }
    }
  }

  return Array.from(bestByExercise.values()).sort((a, b) =>
    a.exerciseName.localeCompare(b.exerciseName),
  );
}
