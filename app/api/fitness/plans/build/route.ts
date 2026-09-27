import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { buildPlanSchema } from "@/lib/validation/fitness";
import { createPlanFromDraft, PlanSaveError } from "@/lib/fitness/plan-save";

/** Saves a reviewed plan draft (from the plan wizard) as an active plan. */
export const POST = withApiErrors(async (req: Request) => {
  const userId = await requireUserId();
  const body = buildPlanSchema.parse(await req.json());

  try {
    const plan = await createPlanFromDraft(userId, body);
    return NextResponse.json({ plan }, { status: 201 });
  } catch (err) {
    if (err instanceof PlanSaveError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
});
