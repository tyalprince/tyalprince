import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { receipts, vaultEntries, workoutLogs } from "@/lib/db/schema";

export type DashboardSummary = {
  passwordCount: number;
  receiptsThisMonthCount: number;
  receiptsThisMonthTotal: number;
  workoutsThisWeekCount: number;
};

/** Scoped to the given user — see Section 1a. Only reads non-sensitive
 *  metadata (row counts, totals); the vault's encrypted contents are never
 *  touched here. */
export async function getDashboardSummary(userId: string): Promise<DashboardSummary> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);

  const [[passwordRow], [receiptRow], [workoutRow]] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(vaultEntries)
      .where(eq(vaultEntries.userId, userId)),
    db
      .select({
        count: sql<number>`count(*)::int`,
        total: sql<string>`coalesce(sum(${receipts.totalAmount}), 0)`,
      })
      .from(receipts)
      .where(and(eq(receipts.userId, userId), gte(receipts.receiptDate, monthStart))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(workoutLogs)
      .where(and(eq(workoutLogs.userId, userId), gte(workoutLogs.date, weekStart))),
  ]);

  return {
    passwordCount: passwordRow?.count ?? 0,
    receiptsThisMonthCount: receiptRow?.count ?? 0,
    receiptsThisMonthTotal: Number(receiptRow?.total ?? 0),
    workoutsThisWeekCount: workoutRow?.count ?? 0,
  };
}
