import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { loggedExercises, loggedSets } from "@/lib/db/schema";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { assertUserOwnsLoggedExercise, getUserSetHistoryForExercise } from "@/lib/fitness/queries";
import { createLoggedSetSchema } from "@/lib/validation/fitness";
import { checkEndurancePr, checkStrengthPr } from "@/lib/fitness/pr";

type Params = { params: Promise<{ id: string }> };

export const POST = withApiErrors(async (req: Request, { params }: Params) => {
  const userId = await requireUserId();
  const { id: loggedExerciseId } = await params;
  const body = createLoggedSetSchema.parse(await req.json());

  if (!(await assertUserOwnsLoggedExercise(userId, loggedExerciseId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [loggedExercise] = await db
    .select({ exerciseId: loggedExercises.exerciseId })
    .from(loggedExercises)
    .where(eq(loggedExercises.id, loggedExerciseId))
    .limit(1);

  // Check for a PR against prior history before inserting the new set.
  const history = await getUserSetHistoryForExercise(userId, loggedExercise.exerciseId);
  const strengthHistory = history.map((h) => ({
    weight: h.weight ? Number(h.weight) : null,
    reps: h.reps,
    date: h.date?.toISOString() ?? "",
  }));
  const enduranceHistory = history.map((h) => ({
    distance: h.distance ? Number(h.distance) : null,
    durationSeconds: h.durationSeconds,
    date: h.date?.toISOString() ?? "",
  }));

  const strengthPr = checkStrengthPr(
    { weight: body.weight ?? null, reps: body.reps ?? null, date: new Date().toISOString() },
    strengthHistory,
  );
  const endurancePr = checkEndurancePr(
    {
      distance: body.distance ?? null,
      durationSeconds: body.durationSeconds ?? null,
      date: new Date().toISOString(),
    },
    enduranceHistory,
  );

  const [set] = await db
    .insert(loggedSets)
    .values({
      loggedExerciseId,
      setNumber: body.setNumber,
      reps: body.reps,
      weight: body.weight?.toString(),
      weightUnit: body.weightUnit,
      durationSeconds: body.durationSeconds,
      distance: body.distance?.toString(),
      distanceUnit: body.distanceUnit,
      restSeconds: body.restSeconds,
      rpe: body.rpe,
      completedAt: new Date(),
    })
    .returning();

  const pr = strengthPr.isPr ? strengthPr : endurancePr.isPr ? endurancePr : null;

  return NextResponse.json({ set, pr }, { status: 201 });
});
