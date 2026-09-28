import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { getUserPlans, getUserSetRows, getUserWorkoutLogsWithPlan } from "@/lib/fitness/queries";
import { buildHistory } from "@/lib/fitness/reports";

/** Everything the History tab needs: plans, every workout, every exercise logged. */
export const GET = withApiErrors(async () => {
  const userId = await requireUserId();
  const [plans, logs, setRows] = await Promise.all([
    getUserPlans(userId),
    getUserWorkoutLogsWithPlan(userId),
    getUserSetRows(userId),
  ]);
  return NextResponse.json({ plans, ...buildHistory({ logs, setRows }) });
});
