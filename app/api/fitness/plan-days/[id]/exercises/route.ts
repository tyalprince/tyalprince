import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { planDayExercises } from "@/lib/db/schema";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { assertUserOwnsPlanDay } from "@/lib/fitness/queries";
import { createPlanDayExerciseSchema } from "@/lib/validation/fitness";

type Params = { params: Promise<{ id: string }> };

export const POST = withApiErrors(async (req: Request, { params }: Params) => {
  const userId = await requireUserId();
  const { id: planDayId } = await params;
  const body = createPlanDayExerciseSchema.parse(await req.json());

  if (!(await assertUserOwnsPlanDay(userId, planDayId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [planDayExercise] = await db
    .insert(planDayExercises)
    .values({
      planDayId,
      exerciseId: body.exerciseId,
      orderIndex: body.orderIndex,
      targetSets: body.targetSets,
      targetReps: body.targetReps,
      targetWeight: body.targetWeight?.toString(),
      targetDurationSeconds: body.targetDurationSeconds,
      targetDistance: body.targetDistance?.toString(),
    })
    .returning();

  return NextResponse.json({ planDayExercise }, { status: 201 });
});
