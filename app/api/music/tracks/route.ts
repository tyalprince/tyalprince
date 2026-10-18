import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { musicTracks } from "@/lib/db/schema";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { getUserTracks, trackColumns } from "@/lib/music/queries";
import { audioExtension, audioObjectKey, keyBelongsToUser } from "@/lib/music/storage";
import { createTrackSchema } from "@/lib/validation/music";
import { AUDIO_MIME } from "@/lib/music/formats";

export const GET = withApiErrors(async () => {
  const userId = await requireUserId();
  return NextResponse.json({ tracks: await getUserTracks(userId) });
});

/** Step 2 of an import: record a track after its audio was uploaded. */
export const POST = withApiErrors(async (req: Request) => {
  const userId = await requireUserId();
  const body = createTrackSchema.parse(await req.json());
  const ext = audioExtension(body.fileName);
  if (!ext) return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  if (body.artworkKey && !keyBelongsToUser(userId, body.artworkKey)) {
    return NextResponse.json({ error: "Invalid artwork" }, { status: 400 });
  }

  const [track] = await db
    .insert(musicTracks)
    .values({
      userId,
      objectKey: audioObjectKey(userId, body.contentHash, ext),
      contentHash: body.contentHash,
      fileName: body.fileName,
      fileSize: body.fileSize,
      mimeType: AUDIO_MIME[ext],
      title: body.title,
      artist: body.artist ?? null,
      albumArtist: body.albumArtist ?? null,
      album: body.album ?? null,
      genre: body.genre ?? null,
      year: body.year ?? null,
      trackNumber: body.trackNumber ?? null,
      discNumber: body.discNumber ?? null,
      durationSeconds: body.durationSeconds?.toString() ?? null,
      bitrate: body.bitrate ?? null,
      artworkKey: body.artworkKey ?? null,
      features: body.features ?? null,
      featureVector: body.featureVector ?? null,
    })
    .onConflictDoNothing({ target: [musicTracks.userId, musicTracks.contentHash] })
    .returning(trackColumns);

  return NextResponse.json({ track: track ?? null, duplicate: !track }, { status: track ? 201 : 200 });
});
