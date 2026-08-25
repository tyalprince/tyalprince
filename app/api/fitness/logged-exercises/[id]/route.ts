import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { loggedExercises } from "@/lib/db/schema";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { assertUserOwnsLoggedExercise } from "@/lib/fitness/queries";

type Params = { params: Promise<{ id: string }> };

export const DELETE = withApiErrors(async (_req: Request, { params }: Params) => {
  const userId = await requireUserId();
  const { id } = await params;

  if (!(await assertUserOwnsLoggedExercise(userId, id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.delete(loggedExercises).where(eq(loggedExercises.id, id));
  return NextResponse.json({ ok: true });
});
