import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { getUserSetHistoryForExercise } from "@/lib/fitness/queries";

type Params = { params: Promise<{ id: string }> };

export const GET = withApiErrors(async (_req: Request, { params }: Params) => {
  const userId = await requireUserId();
  const { id } = await params;

  const history = await getUserSetHistoryForExercise(userId, id);
  return NextResponse.json({ history });
});
