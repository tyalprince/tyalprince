import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fitnessPlans } from "@/lib/db/schema";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { getUserPlans } from "@/lib/fitness/queries";
import { createPlanSchema } from "@/lib/validation/fitness";

export const GET = withApiErrors(async () => {
  const userId = await requireUserId();
  const plans = await getUserPlans(userId);
  return NextResponse.json({ plans });
});

export const POST = withApiErrors(async (req: Request) => {
  const userId = await requireUserId();
  const body = createPlanSchema.parse(await req.json());

  const [plan] = await db
    .insert(fitnessPlans)
    .values({
      userId,
      goalId: body.goalId,
      title: body.title,
      description: body.description,
      sportFocus: body.sportFocus,
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
    })
    .returning();

  return NextResponse.json({ plan }, { status: 201 });
});
