import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { getAllUserSetsWithExercise } from "@/lib/fitness/queries";
import { computePersonalRecords } from "@/lib/fitness/pr";

export const GET = withApiErrors(async () => {
  const userId = await requireUserId();
  const sets = await getAllUserSetsWithExercise(userId);

  const records = computePersonalRecords(
    sets.map((s) => ({
      exerciseId: s.exerciseId,
      exerciseName: s.exerciseName,
      category: s.category,
      reps: s.reps,
      weight: s.weight ? Number(s.weight) : null,
      durationSeconds: s.durationSeconds,
      distance: s.distance ? Number(s.distance) : null,
      distanceUnit: s.distanceUnit,
      date: s.date?.toISOString() ?? "",
    })),
  );

  return NextResponse.json({ records });
});
