import { and, asc, desc, eq, gte, ilike, isNull, lte, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  exercises,
  fitnessGoals,
  fitnessPlans,
  loggedExercises,
  loggedSets,
  planDayExercises,
  planDays,
  workoutLogs,
} from "@/lib/db/schema";

// Every helper below is scoped by userId — never build a fitness query
// without it (see Section 1a). The one exception is the global exercise
// library, which is intentionally shared (userId IS NULL) alongside a
// user's own custom exercises.

export type ExerciseFilters = {
  category?: string;
  muscleGroup?: string;
  equipment?: string;
  search?: string;
};

export async function searchExercises(userId: string, filters: ExerciseFilters = {}) {
  const conditions = [or(isNull(exercises.userId), eq(exercises.userId, userId))!];
  if (filters.category) conditions.push(eq(exercises.category, filters.category as never));
  if (filters.equipment) conditions.push(ilike(exercises.equipment, `%${filters.equipment}%`));
  if (filters.search) conditions.push(ilike(exercises.name, `%${filters.search}%`));

  const rows = await db
    .select()
    .from(exercises)
    .where(and(...conditions))
    .orderBy(asc(exercises.name));

  if (!filters.muscleGroup) return rows;
  const mg = filters.muscleGroup.toLowerCase();
  return rows.filter((r) => r.muscleGroups.some((m) => m.toLowerCase().includes(mg)));
}

export async function getExerciseById(userId: string, id: string) {
  const [row] = await db
    .select()
    .from(exercises)
    .where(and(eq(exercises.id, id), or(isNull(exercises.userId), eq(exercises.userId, userId))))
    .limit(1);
  return row ?? null;
}

export async function getUserGoals(userId: string) {
  return db
    .select()
    .from(fitnessGoals)
    .where(eq(fitnessGoals.userId, userId))
    .orderBy(desc(fitnessGoals.createdAt));
}

export async function getUserPlans(userId: string) {
  return db
    .select()
    .from(fitnessPlans)
    .where(eq(fitnessPlans.userId, userId))
    .orderBy(desc(fitnessPlans.createdAt));
}

export async function getUserPlan(userId: string, planId: string) {
  const [plan] = await db
    .select()
    .from(fitnessPlans)
    .where(and(eq(fitnessPlans.id, planId), eq(fitnessPlans.userId, userId)))
    .limit(1);
  if (!plan) return null;

  const days = await db
    .select()
    .from(planDays)
    .where(eq(planDays.planId, planId))
    .orderBy(asc(planDays.sequenceNumber));

  const dayIds = days.map((d) => d.id);
  const dayExercises = dayIds.length
    ? await db
        .select()
        .from(planDayExercises)
        .where(or(...dayIds.map((id) => eq(planDayExercises.planDayId, id))))
        .orderBy(asc(planDayExercises.orderIndex))
    : [];

  return {
    plan,
    days: days.map((day) => ({
      ...day,
      exercises: dayExercises.filter((e) => e.planDayId === day.id),
    })),
  };
}

/** Verifies a plan_day belongs to one of the user's plans before mutating it. */
export async function assertUserOwnsPlanDay(userId: string, planDayId: string) {
  const [row] = await db
    .select({ id: planDays.id })
    .from(planDays)
    .innerJoin(fitnessPlans, eq(fitnessPlans.id, planDays.planId))
    .where(and(eq(planDays.id, planDayId), eq(fitnessPlans.userId, userId)))
    .limit(1);
  return Boolean(row);
}

export type WorkoutFilters = { from?: string; to?: string };

export async function getUserWorkoutLogs(userId: string, filters: WorkoutFilters = {}) {
  const conditions = [eq(workoutLogs.userId, userId)];
  if (filters.from) conditions.push(gte(workoutLogs.date, new Date(filters.from)));
  if (filters.to) conditions.push(lte(workoutLogs.date, new Date(filters.to)));
  return db
    .select()
    .from(workoutLogs)
    .where(and(...conditions))
    .orderBy(desc(workoutLogs.date));
}

export async function getUserWorkoutLog(userId: string, workoutLogId: string) {
  const [log] = await db
    .select()
    .from(workoutLogs)
    .where(and(eq(workoutLogs.id, workoutLogId), eq(workoutLogs.userId, userId)))
    .limit(1);
  if (!log) return null;

  const loggedEx = await db
    .select()
    .from(loggedExercises)
    .where(eq(loggedExercises.workoutLogId, workoutLogId))
    .orderBy(asc(loggedExercises.orderIndex));

  const exIds = loggedEx.map((e) => e.id);
  const sets = exIds.length
    ? await db
        .select()
        .from(loggedSets)
        .where(or(...exIds.map((id) => eq(loggedSets.loggedExerciseId, id))))
        .orderBy(asc(loggedSets.setNumber))
    : [];

  return {
    log,
    exercises: loggedEx.map((e) => ({
      ...e,
      sets: sets.filter((s) => s.loggedExerciseId === e.id),
    })),
  };
}

/** Verifies a plan_day_exercise belongs to one of the user's plans. */
export async function assertUserOwnsPlanDayExercise(userId: string, planDayExerciseId: string) {
  const [row] = await db
    .select({ id: planDayExercises.id })
    .from(planDayExercises)
    .innerJoin(planDays, eq(planDays.id, planDayExercises.planDayId))
    .innerJoin(fitnessPlans, eq(fitnessPlans.id, planDays.planId))
    .where(and(eq(planDayExercises.id, planDayExerciseId), eq(fitnessPlans.userId, userId)))
    .limit(1);
  return Boolean(row);
}

/** Verifies a logged_exercise belongs to one of the user's workout logs. */
export async function assertUserOwnsLoggedExercise(userId: string, loggedExerciseId: string) {
  const [row] = await db
    .select({ id: loggedExercises.id })
    .from(loggedExercises)
    .innerJoin(workoutLogs, eq(workoutLogs.id, loggedExercises.workoutLogId))
    .where(and(eq(loggedExercises.id, loggedExerciseId), eq(workoutLogs.userId, userId)))
    .limit(1);
  return Boolean(row);
}

/** Verifies a logged_set belongs to one of the user's workout logs. */
export async function assertUserOwnsLoggedSet(userId: string, loggedSetId: string) {
  const [row] = await db
    .select({ id: loggedSets.id })
    .from(loggedSets)
    .innerJoin(loggedExercises, eq(loggedExercises.id, loggedSets.loggedExerciseId))
    .innerJoin(workoutLogs, eq(workoutLogs.id, loggedExercises.workoutLogId))
    .where(and(eq(loggedSets.id, loggedSetId), eq(workoutLogs.userId, userId)))
    .limit(1);
  return Boolean(row);
}

/** All completed sets with weight+reps for an exercise, across the user's
 *  workout history — used for PR detection and strength progression charts. */
export async function getUserSetHistoryForExercise(userId: string, exerciseId: string) {
  const rows = await db
    .select({
      setId: loggedSets.id,
      reps: loggedSets.reps,
      weight: loggedSets.weight,
      weightUnit: loggedSets.weightUnit,
      durationSeconds: loggedSets.durationSeconds,
      distance: loggedSets.distance,
      distanceUnit: loggedSets.distanceUnit,
      completedAt: loggedSets.completedAt,
      date: workoutLogs.date,
    })
    .from(loggedSets)
    .innerJoin(loggedExercises, eq(loggedExercises.id, loggedSets.loggedExerciseId))
    .innerJoin(workoutLogs, eq(workoutLogs.id, loggedExercises.workoutLogId))
    .where(and(eq(loggedExercises.exerciseId, exerciseId), eq(workoutLogs.userId, userId)))
    .orderBy(asc(workoutLogs.date));
  return rows;
}

/** Every logged set for the user, joined with its exercise — the raw
 *  material for computing personal records across the whole library. */
export async function getAllUserSetsWithExercise(userId: string) {
  return db
    .select({
      exerciseId: exercises.id,
      exerciseName: exercises.name,
      category: exercises.category,
      reps: loggedSets.reps,
      weight: loggedSets.weight,
      durationSeconds: loggedSets.durationSeconds,
      distance: loggedSets.distance,
      distanceUnit: loggedSets.distanceUnit,
      date: workoutLogs.date,
    })
    .from(loggedSets)
    .innerJoin(loggedExercises, eq(loggedExercises.id, loggedSets.loggedExerciseId))
    .innerJoin(workoutLogs, eq(workoutLogs.id, loggedExercises.workoutLogId))
    .innerJoin(exercises, eq(exercises.id, loggedExercises.exerciseId))
    .where(eq(workoutLogs.userId, userId))
    .orderBy(asc(workoutLogs.date));
}
