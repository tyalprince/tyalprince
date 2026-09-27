import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { getUserPlan } from "@/lib/fitness/queries";
import { updateScheduleSchema } from "@/lib/validation/fitness";
import { PlanSaveError, replacePlanSchedule } from "@/lib/fitness/plan-save";

type Params = { params: Promise<{ id: string }> };

/** Replaces a plan's day-by-day schedule with an edited draft. */
export const PUT = withApiErrors(async (req: Request, { params }: Params) => {
  const userId = await requireUserId();
  const { id } = await params;
  const body = updateScheduleSchema.parse(await req.json());

  try {
    const saved = await replacePlanSchedule(userId, id, body);
    if (!saved) return NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (err) {
    if (err instanceof PlanSaveError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
  return NextResponse.json(await getUserPlan(userId, id));
});
