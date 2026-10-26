import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { allFolders, createFolder, toDriveItem } from "@/lib/files/queries";
import { createFolderSchema } from "@/lib/validation/files";

/** Every folder (for the "Move to" picker). */
export const GET = withApiErrors(async () => {
  const userId = await requireUserId();
  return NextResponse.json({ folders: await allFolders(userId) });
});

export const POST = withApiErrors(async (req: Request) => {
  const userId = await requireUserId();
  const body = createFolderSchema.parse(await req.json());
  return NextResponse.json({ item: toDriveItem(await createFolder(userId, body.parentId, body.name)) });
});
