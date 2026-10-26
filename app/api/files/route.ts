import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { HttpError, withApiErrors } from "@/lib/api-utils";
import { listFolder, listView } from "@/lib/files/queries";
import { isFileStorageConfigured } from "@/lib/files/storage";

const VIEWS = ["recent", "starred", "shared", "photos", "trash"] as const;

/** ?folder=<id> (default: top level), ?view=recent|starred|shared|photos|trash, or ?q=search. */
export const GET = withApiErrors(async (req: Request) => {
  const userId = await requireUserId();
  const params = new URL(req.url).searchParams;
  const configured = isFileStorageConfigured();
  const q = params.get("q")?.trim();
  if (q) return NextResponse.json({ items: await listView(userId, "search", q.slice(0, 200)), configured });
  const view = params.get("view");
  if (view) {
    if (!VIEWS.includes(view as (typeof VIEWS)[number])) throw new HttpError(400, "Unknown view");
    return NextResponse.json({ items: await listView(userId, view as (typeof VIEWS)[number]), configured });
  }
  const folder = params.get("folder");
  if (folder && !/^[0-9a-f-]{36}$/i.test(folder)) throw new HttpError(404, "That folder doesn't exist.");
  return NextResponse.json({ ...(await listFolder(userId, folder || null)), configured });
});
