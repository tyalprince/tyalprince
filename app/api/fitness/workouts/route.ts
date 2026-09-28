import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { loggedExercises, workoutLogs } from "@/lib/db/schema";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import {
  assertUserOwnsPlanDay,
  getPlanDayTargets,
  getUserWorkoutLogs,
} from "@/lib/fitness/queries";
import { createWorkoutLogSchema } from "@/lib/validation/fitness";

export const GET = withApiErrors(async (req: Request) => {
  const userId = await requireUserId();
  const params = new URL(req.url).searchParams;

  const logs = await getUserWorkoutLogs(userId, {
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
    planId: params.get("planId") ?? undefined,
  });
  return NextResponse.json({ logs });
});

export const POST = withApiErrors(async (req: Request) => {
  const userId = await requireUserId();
  const body = createWorkoutLogSchema.parse(await req.json());

  if (body.planDayId && !(await assertUserOwnsPlanDay(userId, body.planDayId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [log] = await db
    .insert(workoutLogs)
    .values({
      userId,
      planId: body.planId,
      planDayId: body.planDayId,
      date: new Date(body.date),
      notes: body.notes,
      overallRpe: body.overallRpe,
      status: body.status,
      activityType: body.activityType,
      startTime: new Date(),
    })
    .returning();

  if (body.fromPlanDay && body.planDayId) {
    const targets = await getPlanDayTargets(body.planDayId);
    if (targets.length) {
      await db.insert(loggedExercises).values(
        targets.map((t, i) => ({ workoutLogId: log.id, exerciseId: t.exerciseId, orderIndex: i })),
      );
    }
  }

  return NextResponse.json({ log }, { status: 201 });
});
