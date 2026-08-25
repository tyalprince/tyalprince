import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { loggedExercises, workoutLogs } from "@/lib/db/schema";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { createLoggedExerciseSchema } from "@/lib/validation/fitness";

type Params = { params: Promise<{ id: string }> };

export const POST = withApiErrors(async (req: Request, { params }: Params) => {
  const userId = await requireUserId();
  const { id: workoutLogId } = await params;
  const body = createLoggedExerciseSchema.parse(await req.json());

  const [log] = await db
    .select({ id: workoutLogs.id })
    .from(workoutLogs)
    .where(and(eq(workoutLogs.id, workoutLogId), eq(workoutLogs.userId, userId)))
    .limit(1);
  if (!log) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [loggedExercise] = await db
    .insert(loggedExercises)
    .values({ workoutLogId, ...body })
    .returning();

  return NextResponse.json({ loggedExercise }, { status: 201 });
});
