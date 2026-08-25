import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { fitnessPlans, planDays } from "@/lib/db/schema";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { createPlanDaySchema } from "@/lib/validation/fitness";

type Params = { params: Promise<{ id: string }> };

export const POST = withApiErrors(async (req: Request, { params }: Params) => {
  const userId = await requireUserId();
  const { id: planId } = await params;
  const body = createPlanDaySchema.parse(await req.json());

  const [plan] = await db
    .select({ id: fitnessPlans.id })
    .from(fitnessPlans)
    .where(and(eq(fitnessPlans.id, planId), eq(fitnessPlans.userId, userId)))
    .limit(1);
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [day] = await db.insert(planDays).values({ planId, ...body }).returning();
  return NextResponse.json({ day }, { status: 201 });
});
