import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { deleteForever, moveItems, restoreItems, setStarred, trashItems } from "@/lib/files/queries";
import { batchSchema } from "@/lib/validation/files";

/** Acts on several items at once: trash, restore, delete for good, move, star. */
export const POST = withApiErrors(async (req: Request) => {
  const userId = await requireUserId();
  const body = batchSchema.parse(await req.json());
  const ids = [...new Set(body.ids)];
  const count = await (() => {
    switch (body.action) {
      case "trash":
        return trashItems(userId, ids);
      case "restore":
        return restoreItems(userId, ids);
      case "delete":
        return deleteForever(userId, ids);
      case "star":
      case "unstar":
        return setStarred(userId, ids, body.action === "star");
      case "move":
        return moveItems(userId, ids, body.parentId);
    }
  })();
  return NextResponse.json({ count });
});
