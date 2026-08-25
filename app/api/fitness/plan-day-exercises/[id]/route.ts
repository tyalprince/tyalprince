import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { planDayExercises } from "@/lib/db/schema";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { assertUserOwnsPlanDayExercise } from "@/lib/fitness/queries";
import { createPlanDayExerciseSchema } from "@/lib/validation/fitness";

type Params = { params: Promise<{ id: string }> };

export const PATCH = withApiErrors(async (req: Request, { params }: Params) => {
  const userId = await requireUserId();
  const { id } = await params;
  const body = createPlanDayExerciseSchema.partial().parse(await req.json());

  if (!(await assertUserOwnsPlanDayExercise(userId, id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [planDayExercise] = await db
    .update(planDayExercises)
    .set({
      ...(body.exerciseId !== undefined ? { exerciseId: body.exerciseId } : {}),
      ...(body.orderIndex !== undefined ? { orderIndex: body.orderIndex } : {}),
      ...(body.targetSets !== undefined ? { targetSets: body.targetSets } : {}),
      ...(body.targetReps !== undefined ? { targetReps: body.targetReps } : {}),
      ...(body.targetWeight !== undefined
        ? { targetWeight: body.targetWeight?.toString() ?? null }
        : {}),
      ...(body.targetDurationSeconds !== undefined
        ? { targetDurationSeconds: body.targetDurationSeconds }
        : {}),
      ...(body.targetDistance !== undefined
        ? { targetDistance: body.targetDistance?.toString() ?? null }
        : {}),
    })
    .where(eq(planDayExercises.id, id))
    .returning();

  return NextResponse.json({ planDayExercise });
});

export const DELETE = withApiErrors(async (_req: Request, { params }: Params) => {
  const userId = await requireUserId();
  const { id } = await params;

  if (!(await assertUserOwnsPlanDayExercise(userId, id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.delete(planDayExercises).where(eq(planDayExercises.id, id));
  return NextResponse.json({ ok: true });
});
