import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { getUserPlan, getUserSetRows, getUserWorkoutLogsWithPlan } from "@/lib/fitness/queries";
import { buildPlanReview } from "@/lib/fitness/reports";

type Params = { params: Promise<{ id: string }> };

/** Plan-level progress dashboard: adherence, weekly volume, per-exercise gains. */
export const GET = withApiErrors(async (req: Request, { params }: Params) => {
  const userId = await requireUserId();
  const { id } = await params;
  const today = new URL(req.url).searchParams.get("today") ?? new Date().toISOString().slice(0, 10);

  const detail = await getUserPlan(userId, id);
  if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [logs, setRows] = await Promise.all([
    getUserWorkoutLogsWithPlan(userId, { planId: id }),
    getUserSetRows(userId, { planId: id }),
  ]);

  const review = buildPlanReview({
    plan: detail.plan,
    days: detail.days,
    logs,
    setRows,
    today,
  });
  return NextResponse.json({ review });
});
