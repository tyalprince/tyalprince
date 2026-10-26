import { and, asc, eq, isNull, or, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { driveItems } from "@/lib/db/schema";
import { getItem, isInside } from "./queries";

type Row = typeof driveItems.$inferSelect;

// View-only share links: /s/<token>. The token is the only credential, so
// every lookup checks it hasn't expired or been binned, and that anything
// asked for inside a shared folder really is inside it.

export async function resolveShare(token: string): Promise<Row | null> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const [root] = await db.select().from(driveItems).where(eq(driveItems.shareToken, token));
  if (!root || root.trashedAt) return null;
  if (root.shareExpiresAt && root.shareExpiresAt < new Date()) return null;
  if (root.kind === "file" && !root.uploadedAt) return null;
  return root;
}

/** An item within a shared folder (or the shared item itself), or null. */
export async function sharedItem(root: Row, itemId: string | null): Promise<Row | null> {
  if (!itemId || itemId === root.id) return root;
  if (!/^[0-9a-f-]{36}$/i.test(itemId)) return null;
  const item = await getItem(root.userId, itemId);
  if (!item || item.trashedAt) return null;
  return (await isInside(root.userId, root.id, item.id)) ? item : null;
}

export async function sharedChildren(root: Row, folder: Row) {
  return db
    .select()
    .from(driveItems)
    .where(
      and(
        eq(driveItems.userId, root.userId),
        eq(driveItems.parentId, folder.id),
        isNull(driveItems.trashedAt),
        or(eq(driveItems.kind, "folder"), isNotNull(driveItems.uploadedAt)),
      ),
    )
    .orderBy(asc(driveItems.kind), asc(driveItems.name));
}

/** Folder chain from the shared folder down to `folder`. */
export async function sharedTrail(root: Row, folder: Row): Promise<{ id: string; name: string }[]> {
  const trail: { id: string; name: string }[] = [];
  let at: Row | null = folder;
  while (at && trail.length < 100) {
    trail.unshift({ id: at.id, name: at.name });
    if (at.id === root.id || !at.parentId) break;
    at = await getItem(root.userId, at.parentId);
  }
  return trail;
}
