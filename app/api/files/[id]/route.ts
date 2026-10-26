import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { deleteForever, getItem, renameItem, toDriveItem } from "@/lib/files/queries";
import { renameSchema } from "@/lib/validation/files";

type Params = { params: Promise<{ id: string }> };

export const PATCH = withApiErrors(async (req: Request, { params }: Params) => {
  const userId = await requireUserId();
  const { id } = await params;
  const body = renameSchema.parse(await req.json());
  return NextResponse.json({ item: toDriveItem(await renameItem(userId, id, body.name)) });
});

/** Deletes for good (also how a cancelled upload is cleaned up). */
export const DELETE = withApiErrors(async (_req: Request, { params }: Params) => {
  const userId = await requireUserId();
  const { id } = await params;
  if (!(await getItem(userId, id))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await deleteForever(userId, [id]);
  return NextResponse.json({ ok: true });
});
