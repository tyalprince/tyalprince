import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fitnessGoals } from "@/lib/db/schema";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { getUserGoals } from "@/lib/fitness/queries";
import { createGoalSchema } from "@/lib/validation/fitness";

export const GET = withApiErrors(async () => {
  const userId = await requireUserId();
  const goals = await getUserGoals(userId);
  return NextResponse.json({ goals });
});

export const POST = withApiErrors(async (req: Request) => {
  const userId = await requireUserId();
  const body = createGoalSchema.parse(await req.json());

  const [goal] = await db
    .insert(fitnessGoals)
    .values({
      userId,
      title: body.title,
      description: body.description,
      goalType: body.goalType,
      targetMetric: body.targetMetric,
      targetValue: body.targetValue?.toString(),
      targetDate: body.targetDate ? new Date(body.targetDate) : null,
    })
    .returning();

  return NextResponse.json({ goal }, { status: 201 });
});
