import { and, eq, ilike, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { vaultSettings, vaultEntries, vaultCategories } from "@/lib/db/schema";

// Every helper here takes userId explicitly and scopes its query with it —
// never construct a vault query without this filter (see Section 1a).

export async function getVaultSettings(userId: string) {
  const [row] = await db
    .select()
    .from(vaultSettings)
    .where(eq(vaultSettings.userId, userId))
    .limit(1);
  return row ?? null;
}

export async function getUserVaultEntries(userId: string, search?: string) {
  const conditions = [eq(vaultEntries.userId, userId)];
  if (search) {
    conditions.push(
      or(
        ilike(vaultEntries.siteName, `%${search}%`),
        ilike(vaultEntries.category, `%${search}%`),
      )!,
    );
  }
  return db
    .select()
    .from(vaultEntries)
    .where(and(...conditions))
    .orderBy(vaultEntries.siteName);
}

export async function getUserVaultEntry(userId: string, entryId: string) {
  const [row] = await db
    .select()
    .from(vaultEntries)
    .where(and(eq(vaultEntries.id, entryId), eq(vaultEntries.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function getUserVaultCategories(userId: string) {
  return db
    .select()
    .from(vaultCategories)
    .where(eq(vaultCategories.userId, userId))
    .orderBy(vaultCategories.name);
}
