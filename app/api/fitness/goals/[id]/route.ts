import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { fitnessGoals } from "@/lib/db/schema";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { updateGoalSchema } from "@/lib/validation/fitness";

type Params = { params: Promise<{ id: string }> };

export const PATCH = withApiErrors(async (req: Request, { params }: Params) => {
  const userId = await requireUserId();
  const { id } = await params;
  const body = updateGoalSchema.parse(await req.json());

  const [goal] = await db
    .update(fitnessGoals)
    .set({
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.goalType !== undefined ? { goalType: body.goalType } : {}),
      ...(body.targetMetric !== undefined ? { targetMetric: body.targetMetric } : {}),
      ...(body.targetValue !== undefined
        ? { targetValue: body.targetValue?.toString() ?? null }
        : {}),
      ...(body.targetDate !== undefined
        ? { targetDate: body.targetDate ? new Date(body.targetDate) : null }
        : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
    })
    .where(and(eq(fitnessGoals.id, id), eq(fitnessGoals.userId, userId)))
    .returning();

  if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ goal });
});

export const DELETE = withApiErrors(async (_req: Request, { params }: Params) => {
  const userId = await requireUserId();
  const { id } = await params;

  const [goal] = await db
    .delete(fitnessGoals)
    .where(and(eq(fitnessGoals.id, id), eq(fitnessGoals.userId, userId)))
    .returning({ id: fitnessGoals.id });

  if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
});
