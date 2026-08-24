import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { getMonthlySummary } from "@/lib/receipts/queries";

export const GET = withApiErrors(async (req: Request) => {
  const userId = await requireUserId();
  const yearParam = new URL(req.url).searchParams.get("year");
  const year = yearParam ? Number(yearParam) : new Date().getFullYear();

  const rows = await getMonthlySummary(userId, year);
  return NextResponse.json({ year, rows });
});
