import { randomUUID } from "node:crypto";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getBucketName, getS3Client } from "./client";

export async function getReceiptObjectBuffer(
  key: string,
): Promise<{ buffer: Buffer; contentType: string }> {
  const client = getS3Client();
  const res = await client.send(
    new GetObjectCommand({ Bucket: getBucketName(), Key: key }),
  );
  const bytes = await res.Body?.transformToByteArray();
  if (!bytes) throw new Error(`Receipt object not found: ${key}`);
  return {
    buffer: Buffer.from(bytes),
    contentType: res.ContentType ?? "application/octet-stream",
  };
}

const UPLOAD_URL_TTL_SECONDS = 60 * 5; // 5 minutes to complete the PUT
const DOWNLOAD_URL_TTL_SECONDS = 60 * 15; // 15 minutes to view/download

/** Builds a per-user, collision-safe object key. Never accept a client-
 *  supplied key — the userId prefix keeps one user's receipts from ever
 *  colliding with (or being guessable from) another's. */
export function buildReceiptObjectKey(userId: string, fileName: string): string {
  const ext = fileName.includes(".") ? fileName.split(".").pop() : undefined;
  const safeExt = ext && /^[a-zA-Z0-9]{1,10}$/.test(ext) ? `.${ext.toLowerCase()}` : "";
  return `receipts/${userId}/${randomUUID()}${safeExt}`;
}

export async function createReceiptUploadUrl(params: {
  key: string;
  contentType: string;
}): Promise<{ uploadUrl: string; key: string }> {
  const client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: getBucketName(),
    Key: params.key,
    ContentType: params.contentType,
  });
  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: UPLOAD_URL_TTL_SECONDS,
  });
  return { uploadUrl, key: params.key };
}

export async function createReceiptDownloadUrl(key: string): Promise<string> {
  const client = getS3Client();
  const command = new GetObjectCommand({ Bucket: getBucketName(), Key: key });
  return getSignedUrl(client, command, { expiresIn: DOWNLOAD_URL_TTL_SECONDS });
}
