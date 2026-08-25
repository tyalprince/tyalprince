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
};

export type PlanDayRow = {
  id: string;
  planId: string;
  sequenceNumber: number;
  title: string;
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
};

export type WorkoutLogDetail = { log: WorkoutLogRow; exercises: LoggedExerciseRow[] };

export type PrCheckResult = {
  isPr: boolean;
  metric: "estimated1RM" | "pace" | null;
  previousBest: number | null;
  newBest: number | null;
};
