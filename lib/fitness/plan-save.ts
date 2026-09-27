import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { fitnessPlans, planDayExercises, planDays } from "@/lib/db/schema";
import { getVisibleExerciseIds } from "@/lib/fitness/queries";
import type { z } from "zod";
import type { buildPlanSchema, draftDaySchema } from "@/lib/validation/fitness";

type DraftDayInput = z.infer<typeof draftDaySchema>;

export class PlanSaveError extends Error {}

async function assertExercisesVisible(userId: string, days: DraftDayInput[]) {
  const ids = [...new Set(days.flatMap((d) => d.exercises.map((e) => e.exerciseId)))];
  const visible = await getVisibleExerciseIds(userId, ids);
  if (ids.some((id) => !visible.has(id))) throw new PlanSaveError("Unknown exercise in plan");
}

function sortDays(days: DraftDayInput[]) {
  return [...days].sort((a, b) =>
    a.scheduledDate === b.scheduledDate ? 0 : a.scheduledDate < b.scheduledDate ? -1 : 1,
  );
}

function dayValues(planId: string, day: DraftDayInput, sequenceNumber: number) {
  return {
    planId,
    sequenceNumber,
    title: day.title,
    weekNumber: day.weekNumber,
    dayOfWeek: day.dayOfWeek,
    scheduledDate: new Date(day.scheduledDate),
    dayType: day.dayType,
    notes: day.notes,
  };
}

function exerciseValues(planDayId: string, day: DraftDayInput) {
  return day.exercises.map((ex, i) => ({
    planDayId,
    exerciseId: ex.exerciseId,
    orderIndex: i,
    targetSets: ex.targetSets,
    targetReps: ex.targetReps,
    targetWeight: ex.targetWeight?.toString() ?? null,
    targetDurationSeconds: ex.targetDurationSeconds,
    targetRestSeconds: ex.targetRestSeconds,
    notes: ex.notes,
  }));
}

/** Creates a plan with its full day-by-day schedule in one atomic batch. */
export async function createPlanFromDraft(userId: string, draft: z.infer<typeof buildPlanSchema>) {
  await assertExercisesVisible(userId, draft.days);
  const planId = crypto.randomUUID();
  const days = sortDays(draft.days).map((d) => ({ ...d, id: crypto.randomUUID() }));
  const exerciseRows = days.flatMap((d) => exerciseValues(d.id, d));
  const endDate = days[days.length - 1].scheduledDate;

  const [inserted] = await db.batch([
    db
      .insert(fitnessPlans)
      .values({
        id: planId,
        userId,
        title: draft.title,
        sportFocus: "mixed",
        startDate: new Date(draft.startDate),
        endDate: new Date(endDate),
        status: "active",
        focus: draft.focus,
        weeklyMix: draft.weeklyMix,
        splitType: draft.splitType,
        progressive: draft.progressive,
        durationWeeks: draft.weeks,
      })
      .returning(),
    db.insert(planDays).values(days.map((d, i) => ({ id: d.id, ...dayValues(planId, d, i) }))),
    ...(exerciseRows.length ? [db.insert(planDayExercises).values(exerciseRows)] : []),
  ]);
  return inserted[0];
}

/**
 * Replaces a plan's schedule with an edited draft. Days that keep their id
 * are updated in place (so logged workouts stay linked to them); days missing
 * from the draft are deleted and new ones inserted. Each day's exercise list
 * is rewritten wholesale — logged sets reference exercises, not plan rows.
 */
export async function replacePlanSchedule(
  userId: string,
  planId: string,
  input: { title?: string; days: DraftDayInput[] },
) {
  const [plan] = await db
    .select({ id: fitnessPlans.id })
    .from(fitnessPlans)
    .where(and(eq(fitnessPlans.id, planId), eq(fitnessPlans.userId, userId)))
    .limit(1);
  if (!plan) return null;

  await assertExercisesVisible(userId, input.days);
  const existing = await db
    .select({ id: planDays.id })
    .from(planDays)
    .where(eq(planDays.planId, planId));
  const existingIds = new Set(existing.map((d) => d.id));
  if (input.days.some((d) => d.id && !existingIds.has(d.id))) {
    throw new PlanSaveError("Day does not belong to this plan");
  }

  const days = sortDays(input.days).map((d) => ({ ...d, isNew: !d.id, id: d.id ?? crypto.randomUUID() }));
  const keptIds = days.filter((d) => !d.isNew).map((d) => d.id);
  const removedIds = [...existingIds].filter((id) => !keptIds.includes(id));
  const exerciseRows = days.flatMap((d) => exerciseValues(d.id, d));
  const newDays = days.filter((d) => d.isNew);

  await db.batch([
    db
      .update(fitnessPlans)
      .set({
        ...(input.title ? { title: input.title } : {}),
        startDate: new Date(days[0].scheduledDate),
        endDate: new Date(days[days.length - 1].scheduledDate),
      })
      .where(eq(fitnessPlans.id, planId)),
    ...(removedIds.length ? [db.delete(planDays).where(inArray(planDays.id, removedIds))] : []),
    ...(keptIds.length
      ? [db.delete(planDayExercises).where(inArray(planDayExercises.planDayId, keptIds))]
      : []),
    ...days
      .map((d, i) => ({ d, i }))
      .filter(({ d }) => !d.isNew)
      .map(({ d, i }) =>
        db.update(planDays).set(dayValues(planId, d, i)).where(eq(planDays.id, d.id)),
      ),
    ...(newDays.length
      ? [
          db
            .insert(planDays)
            .values(newDays.map((d) => ({ id: d.id, ...dayValues(planId, d, days.indexOf(d)) }))),
        ]
      : []),
    ...(exerciseRows.length ? [db.insert(planDayExercises).values(exerciseRows)] : []),
  ] as unknown as Parameters<typeof db.batch>[0]);
  return planId;
}
