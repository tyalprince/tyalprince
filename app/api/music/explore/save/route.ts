import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/session";
import { HttpError, withApiErrors } from "@/lib/api-utils";
import { saveJamendoTrack } from "@/lib/music/jamendo-server";
import { isMusicStorageConfigured } from "@/lib/music/storage";

// Downloads the song from Jamendo and copies it into storage.
export const maxDuration = 60;

const bodySchema = z.object({ jamendoId: z.string().regex(/^\d{1,12}$/) });

/** Saves a Jamendo song into the user's library. */
export const POST = withApiErrors(async (req: Request) => {
  const userId = await requireUserId();
  if (!isMusicStorageConfigured()) throw new HttpError(503, "Music storage isn't set up");
  const { jamendoId } = bodySchema.parse(await req.json());
  try {
    return NextResponse.json({ track: await saveJamendoTrack(userId, jamendoId) });
  } catch (err) {
    throw new HttpError(422, err instanceof Error ? err.message : "Couldn't save that song");
  }
});
