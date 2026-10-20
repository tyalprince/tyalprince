import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/session";
import { HttpError, withApiErrors } from "@/lib/api-utils";
import { exploreTracks, jamendoClientId } from "@/lib/music/jamendo-server";

const querySchema = z.object({
  view: z.enum(["trending", "new", "genre", "search"]).default("trending"),
  q: z.string().max(100).optional(),
  genre: z.string().max(40).optional(),
  offset: z.coerce.number().int().min(0).max(5000).default(0),
});

/** Browse / search free Creative Commons music on Jamendo. */
export const GET = withApiErrors(async (req: Request) => {
  await requireUserId();
  if (!jamendoClientId()) return NextResponse.json({ configured: false, tracks: [], hasMore: false });
  const { view, q, genre, offset } = querySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  if (view === "search" && !q?.trim()) return NextResponse.json({ configured: true, tracks: [], hasMore: false });
  try {
    return NextResponse.json({ configured: true, ...(await exploreTracks(view, { q, genre, offset })) });
  } catch (err) {
    throw new HttpError(502, err instanceof Error ? err.message : "Jamendo is unavailable");
  }
});
