import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { workoutLogs } from "@/lib/db/schema";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { getUserWorkoutLog } from "@/lib/fitness/queries";
import { updateWorkoutLogSchema } from "@/lib/validation/fitness";

type Params = { params: Promise<{ id: string }> };

export const GET = withApiErrors(async (_req: Request, { params }: Params) => {
  const userId = await requireUserId();
  const { id } = await params;

  const detail = await getUserWorkoutLog(userId, id);
  if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(detail);
});

export const PATCH = withApiErrors(async (req: Request, { params }: Params) => {
  const userId = await requireUserId();
  const { id } = await params;
  const body = updateWorkoutLogSchema.parse(await req.json());

  const [log] = await db
    .update(workoutLogs)
    .set({
      ...(body.planId !== undefined ? { planId: body.planId } : {}),
      ...(body.planDayId !== undefined ? { planDayId: body.planDayId } : {}),
      ...(body.date !== undefined ? { date: new Date(body.date) } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      ...(body.overallRpe !== undefined ? { overallRpe: body.overallRpe } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.activityType !== undefined ? { activityType: body.activityType } : {}),
      ...(body.endTime !== undefined
        ? { endTime: body.endTime ? new Date(body.endTime) : null }
        : {}),
    })
    .where(and(eq(workoutLogs.id, id), eq(workoutLogs.userId, userId)))
    .returning();

  if (!log) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ log });
});

export const DELETE = withApiErrors(async (_req: Request, { params }: Params) => {
  const userId = await requireUserId();
  const { id } = await params;

  const [log] = await db
    .delete(workoutLogs)
    .where(and(eq(workoutLogs.id, id), eq(workoutLogs.userId, userId)))
    .returning({ id: workoutLogs.id });

  if (!log) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
});
