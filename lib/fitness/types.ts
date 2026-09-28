export type ExerciseCategory =
  | "strength"
  | "cardio"
  | "basketball"
  | "cycling"
  | "running"
  | "mobility";

export type ExerciseRow = {
  id: string;
  name: string;
  category: ExerciseCategory;
  muscleGroups: string[];
  equipment: string | null;
  instructions: string | null;
  isCustom: boolean;
  userId: string | null;
};

export type GoalRow = {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  goalType: "strength" | "endurance" | "weight" | "skill" | "sport";
  targetMetric: string | null;
  targetValue: string | null;
  targetDate: string | null;
  status: "active" | "completed" | "abandoned";
  createdAt: string;
};

export type PlanRow = {
  id: string;
  userId: string;
  goalId: string | null;
  title: string;
  description: string | null;
  sportFocus: "basketball" | "lifting" | "running" | "biking" | "mixed";
  startDate: string | null;
  endDate: string | null;
  status: "draft" | "active" | "completed" | "archived";
  focus: FocusScores | null;
  weeklyMix: WeeklyMix | null;
  splitType: SplitType | null;
  progressive: boolean;
  durationWeeks: number | null;
  completedAt: string | null;
  createdAt: string;
};

export type PlanDayExerciseRow = {
  id: string;
  planDayId: string;
  exerciseId: string;
  orderIndex: number;
  targetSets: number | null;
  targetReps: number | null;
  targetWeight: string | null;
  targetDurationSeconds: number | null;
  targetDistance: string | null;
  targetRestSeconds: number | null;
  notes: string | null;
  exerciseName: string;
  exerciseCategory: ExerciseCategory;
};

export type PlanDayRow = {
  id: string;
  planId: string;
  sequenceNumber: number;
  title: string;
  weekNumber: number | null;
  dayOfWeek: number | null;
  scheduledDate: string | null;
  dayType: DayType | null;
  notes: string | null;
  exercises: PlanDayExerciseRow[];
};

export type PlanDetail = { plan: PlanRow; days: PlanDayRow[] };

export type WorkoutLogRow = {
  id: string;
  userId: string;
  planId: string | null;
  planDayId: string | null;
  date: string;
  startTime: string | null;
  endTime: string | null;
  notes: string | null;
  overallRpe: number | null;
  status: "planned" | "completed" | "skipped";
  activityType: string | null;
  createdAt: string;
};

export type LoggedSetRow = {
  id: string;
  loggedExerciseId: string;
  setNumber: number;
  reps: number | null;
  weight: string | null;
  weightUnit: "lb" | "kg" | null;
  durationSeconds: number | null;
  distance: string | null;
  distanceUnit: "mi" | "km" | "m" | null;
  restSeconds: number | null;
  rpe: number | null;
  completedAt: string | null;
};

export type LoggedExerciseRow = {
  id: string;
  workoutLogId: string;
  exerciseId: string;
  orderIndex: number;
  notes: string | null;
  sets: LoggedSetRow[];
  exerciseName: string;
  exerciseCategory: ExerciseCategory;
};

export type WorkoutLogDetail = { log: WorkoutLogRow; exercises: LoggedExerciseRow[] };

export type PrCheckResult = {
  isPr: boolean;
  metric: "estimated1RM" | "pace" | null;
  previousBest: number | null;
  newBest: number | null;
};

// ---------------------------------------------------------------------------
// Plan wizard / generated plans
// ---------------------------------------------------------------------------

export const FOCUS_KEYS = [
  "strength",
  "hypertrophy",
  "endurance",
  "flexibility",
  "stability",
  "athleticism",
] as const;
export type FocusKey = (typeof FOCUS_KEYS)[number];
export type FocusScores = Record<FocusKey, number>;

export type DayType = "gym" | "home" | "cardio" | "recovery" | "rest";
export type WeeklyMix = { gym: number; home: number; cardio: number; recovery: number };
export type SplitType = "weekly" | "biweekly" | "randomized";

export type DraftExercise = {
  exerciseId: string;
  name: string;
  category: ExerciseCategory;
  targetSets: number | null;
  targetReps: number | null;
  targetWeight: number | null;
  targetDurationSeconds: number | null;
  targetRestSeconds: number | null;
  notes: string | null;
};

export type DraftDay = {
  id?: string; // set when editing an already-saved plan day
  weekNumber: number; // 1-based
  dayOfWeek: number; // 0 = Monday … 6 = Sunday
  scheduledDate: string; // YYYY-MM-DD
  dayType: DayType;
  title: string;
  notes: string | null;
  exercises: DraftExercise[];
};

export type PlanDraft = {
  title: string;
  focus: FocusScores;
  weeklyMix: WeeklyMix;
  splitType: SplitType;
  progressive: boolean;
  startDate: string; // YYYY-MM-DD
  weeks: number;
  days: DraftDay[];
};

/** Aggregate numbers for any group of sets (one exercise, one workout, one week…). */
export type SetStats = {
  sets: number;
  reps: number;
  volume: number; // Σ weight × reps
  durationSeconds: number;
  distance: number;
  maxWeight: number;
  bestE1rm: number;
  maxReps: number;
  maxDurationSeconds: number;
};

export type WorkoutSummary = {
  log: WorkoutLogRow;
  planTitle: string | null;
  dayTitle: string | null;
  dayType: DayType | null;
  elapsedSeconds: number | null;
  totals: SetStats;
  exercises: {
    loggedExerciseId: string;
    exerciseId: string;
    name: string;
    category: ExerciseCategory;
    sets: LoggedSetRow[];
    stats: SetStats;
    target: {
      sets: number | null;
      reps: number | null;
      weight: string | null;
      durationSeconds: number | null;
    } | null;
    previous: { date: string; stats: SetStats } | null;
    isPr: boolean;
  }[];
  prCount: number;
  targetCompletion: number | null; // 0..1 share of planned sets logged
};

export type PlanReview = {
  plan: PlanRow;
  scheduled: number; // non-rest days
  completed: number;
  skipped: number;
  totals: SetStats;
  weeks: {
    weekNumber: number;
    scheduled: number;
    completed: number;
    volume: number;
    reps: number;
    durationSeconds: number;
  }[];
  byDayType: { dayType: DayType; scheduled: number; completed: number }[];
  exercises: {
    exerciseId: string;
    name: string;
    category: ExerciseCategory;
    sessions: number;
    first: SetStats;
    last: SetStats;
    best: SetStats;
  }[];
  workouts: {
    id: string;
    date: string;
    title: string;
    dayType: DayType | null;
    status: WorkoutLogRow["status"];
    stats: SetStats;
  }[];
};

export type HistoryWorkout = {
  id: string;
  date: string;
  status: WorkoutLogRow["status"];
  startTime: string | null;
  endTime: string | null;
  planId: string | null;
  planTitle: string | null;
  dayTitle: string | null;
  dayType: DayType | null;
  exerciseNames: string[];
  stats: SetStats;
};

export type HistoryExercise = {
  exerciseId: string;
  name: string;
  category: ExerciseCategory;
  sessions: number;
  lastDate: string;
  best: SetStats;
};
