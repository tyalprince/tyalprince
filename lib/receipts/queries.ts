import { and, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { receipts, receiptCategories, receiptVendorRules } from "@/lib/db/schema";

export type ReceiptFilters = {
  from?: string;
  to?: string;
  category?: string;
  businessOrPersonal?: "business" | "personal";
  vendor?: string;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
};

// Every helper below is scoped by userId — never build a receipts query
// without it (see Section 1a).

export async function getUserReceipts(userId: string, filters: ReceiptFilters = {}) {
  const conditions = [eq(receipts.userId, userId)];
  if (filters.from) conditions.push(gte(receipts.receiptDate, new Date(filters.from)));
  if (filters.to) conditions.push(lte(receipts.receiptDate, new Date(filters.to)));
  if (filters.category) conditions.push(eq(receipts.category, filters.category));
  if (filters.businessOrPersonal)
    conditions.push(eq(receipts.businessOrPersonal, filters.businessOrPersonal));
  if (filters.vendor) conditions.push(ilike(receipts.vendorName, `%${filters.vendor}%`));
  if (filters.minAmount !== undefined)
    conditions.push(gte(receipts.totalAmount, String(filters.minAmount)));
  if (filters.maxAmount !== undefined)
    conditions.push(lte(receipts.totalAmount, String(filters.maxAmount)));
  if (filters.search) {
    conditions.push(
      or(
        ilike(receipts.vendorName, `%${filters.search}%`),
        ilike(receipts.ocrRawText, `%${filters.search}%`),
        ilike(receipts.notes, `%${filters.search}%`),
      )!,
    );
  }

  return db
    .select()
    .from(receipts)
    .where(and(...conditions))
    .orderBy(desc(receipts.receiptDate));
}

export async function getUserReceipt(userId: string, receiptId: string) {
  const [row] = await db
    .select()
    .from(receipts)
    .where(and(eq(receipts.id, receiptId), eq(receipts.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function getUserReceiptCategories(userId: string) {
  return db
    .select()
    .from(receiptCategories)
    .where(eq(receiptCategories.userId, userId))
    .orderBy(receiptCategories.name);
}

export async function getUserVendorRules(userId: string) {
  return db
    .select()
    .from(receiptVendorRules)
    .where(eq(receiptVendorRules.userId, userId));
}

export type MonthlySummaryRow = {
  month: string; // YYYY-MM
  category: string | null;
  businessOrPersonal: string | null;
  total: string;
  count: number;
};

export async function getMonthlySummary(
  userId: string,
  year: number,
): Promise<MonthlySummaryRow[]> {
  const rows = await db
    .select({
      month: sql<string>`to_char(${receipts.receiptDate}, 'YYYY-MM')`,
      category: receipts.category,
      businessOrPersonal: receipts.businessOrPersonal,
      total: sql<string>`coalesce(sum(${receipts.totalAmount}), 0)`,
      count: sql<number>`count(*)::int`,
    })
    .from(receipts)
    .where(
      and(
        eq(receipts.userId, userId),
        sql`extract(year from ${receipts.receiptDate}) = ${year}`,
      ),
    )
    .groupBy(
      sql`to_char(${receipts.receiptDate}, 'YYYY-MM')`,
      receipts.category,
      receipts.businessOrPersonal,
    )
    .orderBy(sql`to_char(${receipts.receiptDate}, 'YYYY-MM')`);

  return rows;
}

/** Receipts missing a total or category — flagged for audit-readiness. */
export async function getIncompleteReceipts(userId: string) {
  return db
    .select()
    .from(receipts)
    .where(
      and(
        eq(receipts.userId, userId),
        or(sql`${receipts.totalAmount} is null`, sql`${receipts.category} is null`),
      ),
    )
    .orderBy(desc(receipts.createdAt));
}
