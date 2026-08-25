import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workoutLogs } from "@/lib/db/schema";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { getUserWorkoutLogs } from "@/lib/fitness/queries";
import { createWorkoutLogSchema } from "@/lib/validation/fitness";

export const GET = withApiErrors(async (req: Request) => {
  const userId = await requireUserId();
  const params = new URL(req.url).searchParams;

  const logs = await getUserWorkoutLogs(userId, {
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
  });
  return NextResponse.json({ logs });
});

export const POST = withApiErrors(async (req: Request) => {
  const userId = await requireUserId();
  const body = createWorkoutLogSchema.parse(await req.json());

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

  return NextResponse.json({ log }, { status: 201 });
});
