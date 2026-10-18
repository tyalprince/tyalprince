import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getEnv } from "@/lib/env";
import { HttpError } from "@/lib/api-utils";

export { audioExtension } from "@/lib/music/formats";

// Object storage for the music library. Audio never passes through the app
// server: the browser uploads straight to the bucket with a presigned PUT,
// and playback streams from a short-lived presigned GET (the bucket handles
// Range requests, so seeking works).

export class MusicStorageNotConfiguredError extends HttpError {
  constructor() {
    super(
      503,
      "Music storage is not configured. Set MUSIC_STORAGE_ENDPOINT, MUSIC_STORAGE_BUCKET, MUSIC_STORAGE_ACCESS_KEY_ID and MUSIC_STORAGE_SECRET_ACCESS_KEY.",
    );
  }
}

type Config = { client: S3Client; bucket: string };
let cached: Config | null = null;

function config(): Config {
  if (cached) return cached;
  const env = getEnv();
  const bucket = env.MUSIC_STORAGE_BUCKET ?? env.S3_BUCKET_NAME;
  const accessKeyId = env.MUSIC_STORAGE_ACCESS_KEY_ID ?? env.S3_ACCESS_KEY_ID;
  const secretAccessKey = env.MUSIC_STORAGE_SECRET_ACCESS_KEY ?? env.S3_SECRET_ACCESS_KEY;
  if (!bucket || !accessKeyId || !secretAccessKey) throw new MusicStorageNotConfiguredError();
  const client = new S3Client({
    region: env.MUSIC_STORAGE_REGION ?? (env.MUSIC_STORAGE_ENDPOINT ? "auto" : env.S3_REGION),
    endpoint: env.MUSIC_STORAGE_ENDPOINT,
    credentials: { accessKeyId, secretAccessKey },
    // Presigned browser uploads can't send the SDK's default CRC32 checksum header.
    requestChecksumCalculation: "WHEN_REQUIRED",
  });
  cached = { client, bucket };
  return cached;
}

export function isMusicStorageConfigured(): boolean {
  try {
    config();
    return true;
  } catch {
    return false;
  }
}

/** Keys are derived from the user and the file's content hash — never from client input. */
export function audioObjectKey(userId: string, contentHash: string, ext: string): string {
  return `music/${userId}/audio/${contentHash}.${ext}`;
}

export function artworkObjectKey(userId: string, artworkHash: string, ext: "jpg" | "png" | "webp"): string {
  return `music/${userId}/art/${artworkHash}.${ext}`;
}

export function keyBelongsToUser(userId: string, key: string): boolean {
  return key.startsWith(`music/${userId}/`) && !key.includes("..");
}

export async function presignUpload(key: string, contentType: string): Promise<string> {
  const { client, bucket } = config();
  return getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }), {
    expiresIn: 60 * 30,
  });
}

export async function presignDownload(key: string, expiresIn = 60 * 60 * 6): Promise<string> {
  const { client, bucket } = config();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn });
}

export async function putObject(key: string, body: Uint8Array, contentType: string): Promise<void> {
  const { client, bucket } = config();
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
}

export async function deleteObject(key: string): Promise<void> {
  const { client, bucket } = config();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
