import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { loggedExercises, loggedSets } from "@/lib/db/schema";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { assertUserOwnsLoggedExercise, getVisibleExerciseIds } from "@/lib/fitness/queries";

type Params = { params: Promise<{ id: string }> };

const swapSchema = z.object({ exerciseId: z.uuid() });

/** Swaps the exercise in place (same slot in the workout) — only before any set is logged. */
export const PATCH = withApiErrors(async (req: Request, { params }: Params) => {
  const userId = await requireUserId();
  const { id } = await params;
  const body = swapSchema.parse(await req.json());

  if (!(await assertUserOwnsLoggedExercise(userId, id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!(await getVisibleExerciseIds(userId, [body.exerciseId])).has(body.exerciseId)) {
    return NextResponse.json({ error: "Unknown exercise" }, { status: 400 });
  }
  const [anySet] = await db
    .select({ id: loggedSets.id })
    .from(loggedSets)
    .where(eq(loggedSets.loggedExerciseId, id))
    .limit(1);
  if (anySet) {
    return NextResponse.json({ error: "Sets already logged — add a new exercise instead" }, { status: 409 });
  }

  const [loggedExercise] = await db
    .update(loggedExercises)
    .set({ exerciseId: body.exerciseId })
    .where(eq(loggedExercises.id, id))
    .returning();
  return NextResponse.json({ loggedExercise });
});

export const DELETE = withApiErrors(async (_req: Request, { params }: Params) => {
  const userId = await requireUserId();
  const { id } = await params;

  if (!(await assertUserOwnsLoggedExercise(userId, id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.delete(loggedExercises).where(eq(loggedExercises.id, id));
  return NextResponse.json({ ok: true });
});
