import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { driveItems } from "@/lib/db/schema";
import { requireUserId } from "@/lib/session";
import { HttpError, withApiErrors } from "@/lib/api-utils";
import { getItem, toDriveItem } from "@/lib/files/queries";
import { shareSchema } from "@/lib/validation/files";

type Params = { params: Promise<{ id: string }> };

/** Makes (or re-makes) a view-only link anyone can open; the old link stops working. */
export const POST = withApiErrors(async (req: Request, { params }: Params) => {
  const userId = await requireUserId();
  const { id } = await params;
  const body = shareSchema.parse(await req.json());
  const item = await getItem(userId, id);
  if (!item || item.trashedAt || (item.kind === "file" && !item.uploadedAt)) throw new HttpError(404, "Not found");
  const token = randomBytes(18).toString("base64url");
  const [row] = await db
    .update(driveItems)
    .set({
      shareToken: token,
      shareExpiresAt: body.expiresInDays ? new Date(Date.now() + body.expiresInDays * 86_400_000) : null,
    })
    .where(and(eq(driveItems.id, id), eq(driveItems.userId, userId)))
    .returning();
  return NextResponse.json({ item: toDriveItem(row), token });
});

/** Stops sharing. */
export const DELETE = withApiErrors(async (_req: Request, { params }: Params) => {
  const userId = await requireUserId();
  const { id } = await params;
  const [row] = await db
    .update(driveItems)
    .set({ shareToken: null, shareExpiresAt: null })
    .where(and(eq(driveItems.id, id), eq(driveItems.userId, userId)))
    .returning();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ item: toDriveItem(row) });
});
