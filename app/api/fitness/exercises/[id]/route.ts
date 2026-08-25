import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { getExerciseById } from "@/lib/fitness/queries";

type Params = { params: Promise<{ id: string }> };

export const GET = withApiErrors(async (_req: Request, { params }: Params) => {
  const userId = await requireUserId();
  const { id } = await params;

  const exercise = await getExerciseById(userId, id);
  if (!exercise) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ exercise });
});
