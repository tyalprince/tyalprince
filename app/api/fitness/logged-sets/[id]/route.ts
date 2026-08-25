import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { loggedSets } from "@/lib/db/schema";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { assertUserOwnsLoggedSet } from "@/lib/fitness/queries";
import { updateLoggedSetSchema } from "@/lib/validation/fitness";

type Params = { params: Promise<{ id: string }> };

export const PATCH = withApiErrors(async (req: Request, { params }: Params) => {
  const userId = await requireUserId();
  const { id } = await params;
  const body = updateLoggedSetSchema.parse(await req.json());

  if (!(await assertUserOwnsLoggedSet(userId, id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [set] = await db
    .update(loggedSets)
    .set({
      ...(body.setNumber !== undefined ? { setNumber: body.setNumber } : {}),
      ...(body.reps !== undefined ? { reps: body.reps } : {}),
      ...(body.weight !== undefined ? { weight: body.weight?.toString() ?? null } : {}),
      ...(body.weightUnit !== undefined ? { weightUnit: body.weightUnit } : {}),
      ...(body.durationSeconds !== undefined
        ? { durationSeconds: body.durationSeconds }
        : {}),
      ...(body.distance !== undefined
        ? { distance: body.distance?.toString() ?? null }
        : {}),
      ...(body.distanceUnit !== undefined ? { distanceUnit: body.distanceUnit } : {}),
      ...(body.restSeconds !== undefined ? { restSeconds: body.restSeconds } : {}),
      ...(body.rpe !== undefined ? { rpe: body.rpe } : {}),
    })
    .where(eq(loggedSets.id, id))
    .returning();

  return NextResponse.json({ set });
});

export const DELETE = withApiErrors(async (_req: Request, { params }: Params) => {
  const userId = await requireUserId();
  const { id } = await params;

  if (!(await assertUserOwnsLoggedSet(userId, id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.delete(loggedSets).where(eq(loggedSets.id, id));
  return NextResponse.json({ ok: true });
});
