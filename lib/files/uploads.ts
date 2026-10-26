import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { driveItems } from "@/lib/db/schema";
import { cleanName, fileCategory, folderPath, partPlan, uniqueName } from "./names";
import { fileObjectKey, listUploadedParts, presignPut, startMultipart, thumbnailObjectKey } from "./storage";
import { requireFolder } from "./queries";

export type UploadRequest = { name: string; size: number; contentType?: string; relativePath?: string };

export type UploadTicket =
  | { status: "skipped"; name: string; id: string }
  | {
      status: "upload";
      id: string;
      name: string;
      /** One PUT for small files… */
      url?: string;
      /** …or parts for big ones (ask /parts for their URLs). */
      multipart?: { partSize: number; count: number; done: number[] };
      thumbnailUrl?: string;
    };

type Child = { id: string; name: string; kind: "folder" | "file"; size: number; uploadedAt: Date | null; uploadId: string | null };

/**
 * Registers a batch of files to upload into `parentId`, creating the folders
 * in their relative paths. A file already there with the same name and size
 * is skipped, and one whose upload was interrupted picks up where it left
 * off, so uploading the same folder again is safe. Other name clashes get
 * "name (1).ext".
 */
export async function registerUploads(userId: string, parentId: string | null, files: UploadRequest[]): Promise<UploadTicket[]> {
  await requireFolder(userId, parentId);
  const children = new Map<string, Child[]>();
  const listChildren = async (folderId: string | null) => {
    const key = folderId ?? "";
    let list = children.get(key);
    if (!list) {
      list = await db
        .select({
          id: driveItems.id,
          name: driveItems.name,
          kind: driveItems.kind,
          size: driveItems.size,
          uploadedAt: driveItems.uploadedAt,
          uploadId: driveItems.uploadId,
        })
        .from(driveItems)
        .where(
          and(
            eq(driveItems.userId, userId),
            folderId ? eq(driveItems.parentId, folderId) : isNull(driveItems.parentId),
            isNull(driveItems.trashedAt),
          ),
        );
      children.set(key, list);
    }
    return list;
  };

  const folderFor = async (path: string[]): Promise<string | null> => {
    let at = parentId;
    for (const segment of path) {
      const list = await listChildren(at);
      const existing = list.find((c) => c.kind === "folder" && c.name.toLowerCase() === segment.toLowerCase());
      if (existing) {
        at = existing.id;
        continue;
      }
      const name = uniqueName(segment, list.map((c) => c.name));
      const [row] = await db.insert(driveItems).values({ userId, parentId: at, kind: "folder", name }).returning({ id: driveItems.id });
      list.push({ id: row.id, name, kind: "folder", size: 0, uploadedAt: null, uploadId: null });
      children.set(row.id, []);
      at = row.id;
    }
    return at;
  };

  const tickets: UploadTicket[] = [];
  for (const file of files) {
    const folderId = await folderFor(folderPath(file.relativePath));
    const list = await listChildren(folderId);
    const wanted = cleanName(file.name);
    const contentType = file.contentType || "application/octet-stream";
    const plan = partPlan(file.size);
    const sameName = list.find((c) => c.kind === "file" && c.name.toLowerCase() === wanted.toLowerCase() && c.size === file.size);

    if (sameName?.uploadedAt) {
      tickets.push({ status: "skipped", id: sameName.id, name: sameName.name });
      continue;
    }

    let id: string;
    let name: string;
    let done: number[] = [];
    let uploadId: string | null = null;
    if (sameName) {
      // An earlier upload of this file didn't finish: carry on with it.
      ({ id, name } = sameName);
      uploadId = sameName.uploadId;
      if (uploadId) {
        done = await listUploadedParts(fileObjectKey(userId, id), uploadId)
          .then((parts) => parts.map((p) => p.PartNumber ?? 0).filter(Boolean))
          .catch(() => {
            uploadId = null;
            return [];
          });
      }
    } else {
      name = uniqueName(wanted, list.map((c) => c.name));
      const [row] = await db
        .insert(driveItems)
        .values({ userId, parentId: folderId, kind: "file", name, size: file.size, contentType })
        .returning({ id: driveItems.id });
      id = row.id;
      list.push({ id, name, kind: "file", size: file.size, uploadedAt: null, uploadId: null });
    }

    const key = fileObjectKey(userId, id);
    await db.update(driveItems).set({ objectKey: key, contentType }).where(eq(driveItems.id, id));
    const ticket: UploadTicket & { status: "upload" } = { status: "upload", id, name };
    if (plan.multipart) {
      if (!uploadId) {
        uploadId = await startMultipart(key, contentType);
        await db.update(driveItems).set({ uploadId }).where(eq(driveItems.id, id));
      }
      ticket.multipart = { partSize: plan.partSize, count: plan.count, done };
    } else {
      ticket.url = await presignPut(key, contentType);
    }
    if (fileCategory(name, contentType) === "image" && file.size < 80 * 1024 * 1024) {
      ticket.thumbnailUrl = await presignPut(thumbnailObjectKey(userId, id), "image/jpeg");
    }
    tickets.push(ticket);
  }
  return tickets;
}
