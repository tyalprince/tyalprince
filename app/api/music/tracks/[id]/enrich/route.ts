import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { enrichTrack } from "@/lib/music/enrich";
import { trackColumns } from "@/lib/music/queries";

type Params = { params: Promise<{ id: string }> };

// MusicBrainz lookups are rate-limited to ~1/s, so a full lookup takes a few seconds.
export const maxDuration = 30;

const bodySchema = z
  .object({ credits: z.boolean().optional(), force: z.boolean().optional(), artworkOnly: z.boolean().optional() })
  .default({});

/** Looks up album art, release date and credits for a track and returns the updated track. */
export const POST = withApiErrors(async (req: Request, { params }: Params) => {
  const userId = await requireUserId();
  const { id } = await params;
  const opts = bodySchema.parse(await req.json().catch(() => ({})));
  const result = await enrichTrack(userId, id, opts);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { row, retryLater } = result;
  const track = Object.fromEntries(Object.keys(trackColumns).map((k) => [k, row[k as keyof typeof row]]));
  return NextResponse.json({ track, retryLater });
});
