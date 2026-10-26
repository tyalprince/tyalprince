import { and, desc, eq, ilike, inArray, isNotNull, isNull, lt, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { driveItems } from "@/lib/db/schema";
import { HttpError } from "@/lib/api-utils";
import { cleanName, fileCategory, uniqueName } from "./names";
import { abortMultipart, deleteObjects } from "./storage";
import type { DriveItem, DriveView, Usage } from "./types";

type Row = typeof driveItems.$inferSelect;
type Folder = { id: string; parentId: string | null; name: string };

const TRASH_DAYS = 30;

const childCount = sql<number>`(select count(*)::int from drive_items c where c.parent_id = ${driveItems.id} and c.trashed_at is null and (c.kind = 'folder' or c.uploaded_at is not null))`;

export function toDriveItem(r: Row & { childCount?: number }, path?: string): DriveItem {
  return {
    id: r.id,
    parentId: r.parentId,
    kind: r.kind,
    name: r.name,
    size: r.size,
    contentType: r.contentType,
    hasThumbnail: Boolean(r.thumbnailKey),
    starred: r.starred,
    trashedAt: r.trashedAt?.toISOString() ?? null,
    shareToken: r.shareToken,
    shareExpiresAt: r.shareExpiresAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    ...(r.kind === "folder" ? { childCount: r.childCount ?? 0 } : {}),
    ...(path !== undefined ? { path } : {}),
  };
}

/** Folders and finished files (uploads still in flight are hidden). */
const visible = or(eq(driveItems.kind, "folder"), isNotNull(driveItems.uploadedAt));

export async function getItem(userId: string, id: string): Promise<Row | null> {
  const [row] = await db
    .select()
    .from(driveItems)
    .where(and(eq(driveItems.id, id), eq(driveItems.userId, userId)));
  return row ?? null;
}

/** The folder to put things in: null (top level) or a folder of the user's that isn't in the bin. */
export async function requireFolder(userId: string, parentId: string | null): Promise<void> {
  if (!parentId) return;
  const folder = await getItem(userId, parentId);
  if (!folder || folder.kind !== "folder" || folder.trashedAt) throw new HttpError(404, "That folder doesn't exist.");
}

export async function siblingNames(userId: string, parentId: string | null, exceptId?: string): Promise<string[]> {
  const rows = await db
    .select({ name: driveItems.name })
    .from(driveItems)
    .where(
      and(
        eq(driveItems.userId, userId),
        parentId ? eq(driveItems.parentId, parentId) : isNull(driveItems.parentId),
        isNull(driveItems.trashedAt),
        exceptId ? ne(driveItems.id, exceptId) : undefined,
      ),
    );
  return rows.map((r) => r.name);
}

export async function createFolder(userId: string, parentId: string | null, rawName: string): Promise<Row> {
  await requireFolder(userId, parentId);
  const name = uniqueName(cleanName(rawName), await siblingNames(userId, parentId));
  const [row] = await db.insert(driveItems).values({ userId, parentId, kind: "folder", name }).returning();
  return row;
}

export async function allFolders(userId: string): Promise<Folder[]> {
  return db
    .select({ id: driveItems.id, parentId: driveItems.parentId, name: driveItems.name })
    .from(driveItems)
    .where(and(eq(driveItems.userId, userId), eq(driveItems.kind, "folder"), isNull(driveItems.trashedAt)));
}

/** Top-down chain of folders from the top level to `folderId`. */
export function breadcrumbs(folders: Folder[], folderId: string | null): Folder[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const chain: Folder[] = [];
  let at = folderId ? byId.get(folderId) : undefined;
  while (at && chain.length < 100) {
    chain.unshift(at);
    at = at.parentId ? byId.get(at.parentId) : undefined;
  }
  return chain;
}

const pathOf = (folders: Folder[], parentId: string | null) =>
  ["My files", ...breadcrumbs(folders, parentId).map((f) => f.name)].join(" / ");

export async function listFolder(userId: string, folderId: string | null) {
  const folders = await allFolders(userId);
  if (folderId && !folders.some((f) => f.id === folderId)) throw new HttpError(404, "That folder doesn't exist.");
  const rows = await db
    .select({ ...allColumns, childCount })
    .from(driveItems)
    .where(
      and(
        eq(driveItems.userId, userId),
        folderId ? eq(driveItems.parentId, folderId) : isNull(driveItems.parentId),
        isNull(driveItems.trashedAt),
        visible,
      ),
    );
  return { items: rows.map((r) => toDriveItem(r)), breadcrumbs: breadcrumbs(folders, folderId) };
}

const allColumns = {
  id: driveItems.id,
  userId: driveItems.userId,
  parentId: driveItems.parentId,
  kind: driveItems.kind,
  name: driveItems.name,
  objectKey: driveItems.objectKey,
  size: driveItems.size,
  contentType: driveItems.contentType,
  thumbnailKey: driveItems.thumbnailKey,
  uploadId: driveItems.uploadId,
  uploadedAt: driveItems.uploadedAt,
  starred: driveItems.starred,
  trashedAt: driveItems.trashedAt,
  shareToken: driveItems.shareToken,
  shareExpiresAt: driveItems.shareExpiresAt,
  createdAt: driveItems.createdAt,
  updatedAt: driveItems.updatedAt,
};

const escapeLike = (q: string) => q.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Recent, starred, shared, photos, the bin, or a search across everything. */
export async function listView(userId: string, view: Exclude<DriveView, "files"> | "search", q = "") {
  if (view === "trash") await purgeExpired(userId);
  const mine = eq(driveItems.userId, userId);
  const live = and(isNull(driveItems.trashedAt), visible);
  const [where, order, limit]: [SQL | undefined, SQL, number] = (() => {
    switch (view) {
      case "recent":
        return [and(mine, live, eq(driveItems.kind, "file")), desc(driveItems.updatedAt), 100];
      case "starred":
        return [and(mine, live, eq(driveItems.starred, true)), desc(driveItems.updatedAt), 500];
      case "shared":
        return [and(mine, live, isNotNull(driveItems.shareToken)), desc(driveItems.updatedAt), 500];
      case "photos":
        return [
          and(mine, live, eq(driveItems.kind, "file"), or(ilike(driveItems.contentType, "image/%"), ilike(driveItems.contentType, "video/%"))),
          desc(driveItems.createdAt),
          1000,
        ];
      case "trash":
        // Only what was put in the bin directly — not the contents of a binned folder.
        return [
          and(
            mine,
            isNotNull(driveItems.trashedAt),
            visible,
            sql`not exists (select 1 from drive_items p where p.id = ${driveItems.parentId} and p.trashed_at = ${driveItems.trashedAt})`,
          ),
          desc(driveItems.trashedAt),
          1000,
        ];
      case "search":
        return [and(mine, live, ilike(driveItems.name, `%${escapeLike(q.trim())}%`)), desc(driveItems.updatedAt), 200];
    }
  })();
  const [rows, folders] = await Promise.all([
    db.select({ ...allColumns, childCount }).from(driveItems).where(where).orderBy(order).limit(limit),
    allFolders(userId),
  ]);
  return rows.map((r) => toDriveItem(r, pathOf(folders, r.parentId)));
}

/** The items plus everything inside them (any depth), scoped to the user. */
async function withDescendants(userId: string, ids: string[]): Promise<Row[]> {
  if (!ids.length) return [];
  const res = await db.execute(sql`
    with recursive tree as (
      select * from drive_items where user_id = ${userId} and ${inArray(driveItems.id, ids)}
      union all
      select d.* from drive_items d join tree t on d.parent_id = t.id
    )
    select id, parent_id, kind, object_key, thumbnail_key, upload_id, trashed_at from tree`);
  return (res.rows as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    parentId: r.parent_id as string | null,
    kind: r.kind as Row["kind"],
    objectKey: r.object_key as string | null,
    thumbnailKey: r.thumbnail_key as string | null,
    uploadId: r.upload_id as string | null,
    trashedAt: r.trashed_at ? new Date(r.trashed_at as string) : null,
  })) as Row[];
}

export async function trashItems(userId: string, ids: string[]): Promise<number> {
  const all = await withDescendants(userId, ids);
  if (!all.length) return 0;
  const now = new Date();
  await db
    .update(driveItems)
    .set({ trashedAt: now })
    .where(and(eq(driveItems.userId, userId), inArray(driveItems.id, all.map((r) => r.id)), isNull(driveItems.trashedAt)));
  return ids.length;
}

/** Puts items back where they were (or at the top level if that folder is gone), with what was binned along with them. */
export async function restoreItems(userId: string, ids: string[]): Promise<number> {
  let restored = 0;
  for (const id of ids) {
    const item = await getItem(userId, id);
    if (!item?.trashedAt) continue;
    const parent = item.parentId ? await getItem(userId, item.parentId) : null;
    const parentId = parent && !parent.trashedAt ? parent.id : null;
    const name = uniqueName(item.name, await siblingNames(userId, parentId, item.id));
    const inside = (await withDescendants(userId, [id])).filter((r) => r.trashedAt?.getTime() === item.trashedAt!.getTime());
    await db.batch([
      db
        .update(driveItems)
        .set({ trashedAt: null })
        .where(and(eq(driveItems.userId, userId), inArray(driveItems.id, inside.map((r) => r.id)))),
      db.update(driveItems).set({ parentId, name, updatedAt: new Date() }).where(and(eq(driveItems.id, id), eq(driveItems.userId, userId))),
    ]);
    restored += 1;
  }
  return restored;
}

/** Deletes for good: rows, stored bytes, thumbnails and unfinished uploads. */
export async function deleteForever(userId: string, ids: string[]): Promise<number> {
  const all = await withDescendants(userId, ids);
  if (!all.length) return 0;
  const keys = all.flatMap((r) => [r.objectKey, r.thumbnailKey].filter((k): k is string => Boolean(k)));
  await Promise.all(
    all.filter((r) => r.uploadId && r.objectKey).map((r) => abortMultipart(r.objectKey!, r.uploadId!).catch(() => {})),
  );
  await deleteObjects(keys).catch((err) => console.error("Files: couldn't delete objects", err));
  // Children go with their folder (on delete cascade).
  await db.delete(driveItems).where(and(eq(driveItems.userId, userId), inArray(driveItems.id, ids)));
  return ids.length;
}

/** Empties bin items older than 30 days, and drops uploads abandoned for 2 days. */
export async function purgeExpired(userId: string): Promise<void> {
  const binCutoff = new Date(Date.now() - TRASH_DAYS * 86_400_000);
  const uploadCutoff = new Date(Date.now() - 2 * 86_400_000);
  const stale = await db
    .select({ id: driveItems.id })
    .from(driveItems)
    .where(
      and(
        eq(driveItems.userId, userId),
        or(
          lt(driveItems.trashedAt, binCutoff),
          and(eq(driveItems.kind, "file"), isNull(driveItems.uploadedAt), lt(driveItems.createdAt, uploadCutoff)),
        ),
      ),
    )
    .limit(1000);
  if (stale.length) await deleteForever(userId, stale.map((r) => r.id));
}

export async function moveItems(userId: string, ids: string[], parentId: string | null): Promise<number> {
  await requireFolder(userId, parentId);
  if (parentId) {
    // A folder can't go inside itself or its own subfolders.
    const ancestors = breadcrumbs(await allFolders(userId), parentId).map((f) => f.id);
    if (ids.some((id) => ancestors.includes(id))) throw new HttpError(400, "A folder can't be moved into itself.");
  }
  const taken = await siblingNames(userId, parentId);
  let moved = 0;
  for (const id of ids) {
    const item = await getItem(userId, id);
    if (!item || item.trashedAt || item.parentId === parentId) continue;
    const name = uniqueName(item.name, taken);
    taken.push(name);
    await db
      .update(driveItems)
      .set({ parentId, name, updatedAt: new Date() })
      .where(and(eq(driveItems.id, id), eq(driveItems.userId, userId)));
    moved += 1;
  }
  return moved;
}

export async function setStarred(userId: string, ids: string[], starred: boolean): Promise<number> {
  const rows = await db
    .update(driveItems)
    .set({ starred })
    .where(and(eq(driveItems.userId, userId), inArray(driveItems.id, ids)))
    .returning({ id: driveItems.id });
  return rows.length;
}

export async function renameItem(userId: string, id: string, rawName: string): Promise<Row> {
  const item = await getItem(userId, id);
  if (!item || item.trashedAt) throw new HttpError(404, "Not found");
  const name = uniqueName(cleanName(rawName), await siblingNames(userId, item.parentId, id));
  const [row] = await db
    .update(driveItems)
    .set({ name, updatedAt: new Date() })
    .where(and(eq(driveItems.id, id), eq(driveItems.userId, userId)))
    .returning();
  return row;
}

export async function getUsage(userId: string): Promise<Usage> {
  const rows = await db
    .select({ kind: driveItems.kind, name: driveItems.name, contentType: driveItems.contentType, size: driveItems.size, trashedAt: driveItems.trashedAt })
    .from(driveItems)
    .where(and(eq(driveItems.userId, userId), visible));
  const usage: Usage = { totalBytes: 0, fileCount: 0, folderCount: 0, trashBytes: 0, byCategory: [] };
  const byCategory = new Map<string, { bytes: number; count: number }>();
  for (const r of rows) {
    if (r.kind === "folder") {
      if (!r.trashedAt) usage.folderCount += 1;
      continue;
    }
    usage.totalBytes += r.size;
    if (r.trashedAt) {
      usage.trashBytes += r.size;
      continue;
    }
    usage.fileCount += 1;
    const c = fileCategory(r.name, r.contentType);
    const group = ["document", "spreadsheet", "presentation", "pdf", "text"].includes(c) ? "documents" : c === "image" ? "photos" : c === "video" ? "videos" : c === "audio" ? "audio" : "other";
    const entry = byCategory.get(group) ?? { bytes: 0, count: 0 };
    entry.bytes += r.size;
    entry.count += 1;
    byCategory.set(group, entry);
  }
  usage.byCategory = [...byCategory.entries()].map(([category, v]) => ({ category, ...v })).sort((a, b) => b.bytes - a.bytes);
  return usage;
}

/** Is `itemId` the shared item itself or somewhere inside it? */
export async function isInside(userId: string, rootId: string, itemId: string): Promise<boolean> {
  if (rootId === itemId) return true;
  const res = await db.execute(sql`
    with recursive up as (
      select id, parent_id, 0 as depth from drive_items where id = ${itemId} and user_id = ${userId}
      union all
      select d.id, d.parent_id, up.depth + 1 from drive_items d join up on d.id = up.parent_id where up.depth < 100
    )
    select 1 from up where id = ${rootId} limit 1`);
  return res.rows.length > 0;
}
