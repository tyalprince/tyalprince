import { z } from "zod";

export const createGoalSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  goalType: z.enum(["strength", "endurance", "weight", "skill", "sport"]),
  targetMetric: z.string().max(200).optional().nullable(),
  targetValue: z.number().optional().nullable(),
  targetDate: z.iso.date().optional().nullable(),
});

export const updateGoalSchema = createGoalSchema.partial().extend({
  status: z.enum(["active", "completed", "abandoned"]).optional(),
});

export const createPlanSchema = z.object({
  goalId: z.uuid().optional().nullable(),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  sportFocus: z.enum(["basketball", "lifting", "running", "biking", "mixed"]),
  startDate: z.iso.date().optional().nullable(),
  endDate: z.iso.date().optional().nullable(),
});

export const updatePlanSchema = createPlanSchema.partial().extend({
  status: z.enum(["draft", "active", "completed", "archived"]).optional(),
});

export const createPlanDaySchema = z.object({
  sequenceNumber: z.number().int().min(0),
  title: z.string().trim().min(1).max(200),
});

export const createPlanDayExerciseSchema = z.object({
  exerciseId: z.uuid(),
  orderIndex: z.number().int().min(0).default(0),
  targetSets: z.number().int().min(1).optional().nullable(),
  targetReps: z.number().int().min(1).optional().nullable(),
  targetWeight: z.number().min(0).optional().nullable(),
  targetDurationSeconds: z.number().int().min(1).optional().nullable(),
  targetDistance: z.number().min(0).optional().nullable(),
});

export const createWorkoutLogSchema = z.object({
  planId: z.uuid().optional().nullable(),
  planDayId: z.uuid().optional().nullable(),
  date: z.iso.date(),
  notes: z.string().max(2000).optional().nullable(),
  overallRpe: z.number().int().min(1).max(10).optional().nullable(),
  status: z.enum(["planned", "completed", "skipped"]).default("completed"),
  activityType: z.string().max(100).optional().nullable(),
  // Pre-populate the workout with the plan day's exercises.
  fromPlanDay: z.boolean().optional(),
});

export const updateWorkoutLogSchema = createWorkoutLogSchema.omit({ fromPlanDay: true }).partial().extend({
  endTime: z.iso.datetime().optional().nullable(),
});

export const createLoggedExerciseSchema = z.object({
  exerciseId: z.uuid(),
  orderIndex: z.number().int().min(0).default(0),
  notes: z.string().max(1000).optional().nullable(),
});

export const createLoggedSetSchema = z.object({
  setNumber: z.number().int().min(1),
  reps: z.number().int().min(0).optional().nullable(),
  weight: z.number().min(0).optional().nullable(),
  weightUnit: z.enum(["lb", "kg"]).optional(),
  durationSeconds: z.number().int().min(0).optional().nullable(),
  distance: z.number().min(0).optional().nullable(),
  distanceUnit: z.enum(["mi", "km", "m"]).optional().nullable(),
  restSeconds: z.number().int().min(0).optional().nullable(),
  rpe: z.number().int().min(1).max(10).optional().nullable(),
});

export const updateLoggedSetSchema = createLoggedSetSchema.partial();

export const createCustomExerciseSchema = z.object({
  name: z.string().trim().min(1).max(200),
  category: z.enum(["strength", "cardio", "basketball", "cycling", "running", "mobility"]),
  muscleGroups: z.array(z.string().max(50)).default([]),
  equipment: z.string().max(100).optional().nullable(),
  instructions: z.string().max(2000).optional().nullable(),
});

// ---------------------------------------------------------------------------
// Generated plans (wizard → reviewed draft → saved schedule)
// ---------------------------------------------------------------------------

const score = z.number().int().min(1).max(10);
const dayCount = z.number().int().min(0).max(7);

export const focusSchema = z.object({
  strength: score,
  hypertrophy: score,
  endurance: score,
  flexibility: score,
  stability: score,
  athleticism: score,
});

export const weeklyMixSchema = z
  .object({ gym: dayCount, home: dayCount, cardio: dayCount, recovery: dayCount })
  .refine((m) => m.gym + m.home + m.cardio + m.recovery <= 7, {
    message: "At most 7 training days per week",
  });

export const draftExerciseSchema = z.object({
  exerciseId: z.uuid(),
  targetSets: z.number().int().min(1).max(20).nullable(),
  targetReps: z.number().int().min(1).max(200).nullable(),
  targetWeight: z.number().min(0).nullable(),
  targetDurationSeconds: z.number().int().min(1).max(24 * 3600).nullable(),
  targetRestSeconds: z.number().int().min(0).max(3600).nullable(),
  notes: z.string().max(500).nullable(),
});

export const draftDaySchema = z.object({
  id: z.uuid().optional(),
  weekNumber: z.number().int().min(1).max(52),
  dayOfWeek: z.number().int().min(0).max(6),
  scheduledDate: z.iso.date(),
  dayType: z.enum(["gym", "home", "cardio", "recovery", "rest"]),
  title: z.string().trim().min(1).max(200),
  notes: z.string().max(1000).nullable(),
  exercises: z.array(draftExerciseSchema).max(30),
});

export const buildPlanSchema = z.object({
  title: z.string().trim().min(1).max(200),
  focus: focusSchema,
  weeklyMix: weeklyMixSchema,
  splitType: z.enum(["weekly", "biweekly", "randomized"]),
  progressive: z.boolean(),
  startDate: z.iso.date(),
  weeks: z.number().int().min(1).max(12),
  days: z.array(draftDaySchema).min(1).max(12 * 7),
});

export const updateScheduleSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  days: z.array(draftDaySchema).min(1).max(12 * 7),
});
