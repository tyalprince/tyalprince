import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { fitnessPlans, planDays } from "@/lib/db/schema";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { getPlanDayTargets, getUserSetRows, getUserWorkoutLog } from "@/lib/fitness/queries";
import { buildWorkoutSummary } from "@/lib/fitness/reports";

type Params = { params: Promise<{ id: string }> };

/** Post-workout review: totals, per-exercise results vs. target and last session, PRs. */
export const GET = withApiErrors(async (_req: Request, { params }: Params) => {
  const userId = await requireUserId();
  const { id } = await params;

  const detail = await getUserWorkoutLog(userId, id);
  if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [plan] = detail.log.planId
    ? await db
        .select({ title: fitnessPlans.title })
        .from(fitnessPlans)
        .where(eq(fitnessPlans.id, detail.log.planId))
        .limit(1)
    : [];
  const [day] = detail.log.planDayId
    ? await db
        .select({ title: planDays.title, dayType: planDays.dayType })
        .from(planDays)
        .where(eq(planDays.id, detail.log.planDayId))
        .limit(1)
    : [];
  const targets = detail.log.planDayId ? await getPlanDayTargets(detail.log.planDayId) : [];

  const exerciseIds = new Set(detail.exercises.map((e) => e.exerciseId));
  const historyRows = (await getUserSetRows(userId)).filter((r) => exerciseIds.has(r.exerciseId));

  const summary = buildWorkoutSummary({
    log: detail.log,
    exercises: detail.exercises,
    planTitle: plan?.title ?? null,
    dayTitle: day?.title ?? null,
    dayType: day?.dayType ?? null,
    targets,
    historyRows,
  });
  return NextResponse.json({ summary });
});
