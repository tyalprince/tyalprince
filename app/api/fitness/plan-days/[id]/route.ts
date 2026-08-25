import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { planDays } from "@/lib/db/schema";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { assertUserOwnsPlanDay } from "@/lib/fitness/queries";
import { createPlanDaySchema } from "@/lib/validation/fitness";

type Params = { params: Promise<{ id: string }> };

export const PATCH = withApiErrors(async (req: Request, { params }: Params) => {
  const userId = await requireUserId();
  const { id } = await params;
  const body = createPlanDaySchema.partial().parse(await req.json());

  if (!(await assertUserOwnsPlanDay(userId, id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [day] = await db.update(planDays).set(body).where(eq(planDays.id, id)).returning();
  return NextResponse.json({ day });
});

export const DELETE = withApiErrors(async (_req: Request, { params }: Params) => {
  const userId = await requireUserId();
  const { id } = await params;

  if (!(await assertUserOwnsPlanDay(userId, id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.delete(planDays).where(eq(planDays.id, id));
  return NextResponse.json({ ok: true });
});
