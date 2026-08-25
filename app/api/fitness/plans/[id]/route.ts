import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { fitnessPlans } from "@/lib/db/schema";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { getUserPlan } from "@/lib/fitness/queries";
import { updatePlanSchema } from "@/lib/validation/fitness";

type Params = { params: Promise<{ id: string }> };

export const GET = withApiErrors(async (_req: Request, { params }: Params) => {
  const userId = await requireUserId();
  const { id } = await params;

  const detail = await getUserPlan(userId, id);
  if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(detail);
});

export const PATCH = withApiErrors(async (req: Request, { params }: Params) => {
  const userId = await requireUserId();
  const { id } = await params;
  const body = updatePlanSchema.parse(await req.json());

  const [plan] = await db
    .update(fitnessPlans)
    .set({
      ...(body.goalId !== undefined ? { goalId: body.goalId } : {}),
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.sportFocus !== undefined ? { sportFocus: body.sportFocus } : {}),
      ...(body.startDate !== undefined
        ? { startDate: body.startDate ? new Date(body.startDate) : null }
        : {}),
      ...(body.endDate !== undefined
        ? { endDate: body.endDate ? new Date(body.endDate) : null }
        : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
    })
    .where(and(eq(fitnessPlans.id, id), eq(fitnessPlans.userId, userId)))
    .returning();

  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ plan });
});

export const DELETE = withApiErrors(async (_req: Request, { params }: Params) => {
  const userId = await requireUserId();
  const { id } = await params;

  const [plan] = await db
    .delete(fitnessPlans)
    .where(and(eq(fitnessPlans.id, id), eq(fitnessPlans.userId, userId)))
    .returning({ id: fitnessPlans.id });

  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
});
