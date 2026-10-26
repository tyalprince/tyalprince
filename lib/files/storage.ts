import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListPartsCommand,
  PutObjectCommand,
  UploadPartCommand,
  type Part,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "@/lib/music/storage";
import { partPlan } from "./names";

export { isMusicStorageConfigured as isFileStorageConfigured } from "@/lib/music/storage";

// File bytes go straight between the browser and the bucket with presigned
// URLs. Big files are sent in parts (multipart upload): each part retries on
// its own, and the part list is read back on the server, so the bucket's CORS
// rule doesn't need to expose ETag.

/** Keys come from the user and the item id — never from the file name or client input. */
export function fileObjectKey(userId: string, itemId: string): string {
  return `files/${userId}/${itemId}`;
}

export function thumbnailObjectKey(userId: string, itemId: string): string {
  return `files/${userId}/${itemId}.thumb.jpg`;
}

const UPLOAD_TTL = 60 * 60 * 6;

export async function presignPut(key: string, contentType: string): Promise<string> {
  const { client, bucket } = config();
  return getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }), {
    expiresIn: UPLOAD_TTL,
  });
}

export async function startMultipart(key: string, contentType: string): Promise<string> {
  const { client, bucket } = config();
  const res = await client.send(new CreateMultipartUploadCommand({ Bucket: bucket, Key: key, ContentType: contentType }));
  if (!res.UploadId) throw new Error("Storage didn't start the upload");
  return res.UploadId;
}

export async function presignParts(key: string, uploadId: string, partNumbers: number[]): Promise<Record<number, string>> {
  const { client, bucket } = config();
  const urls = await Promise.all(
    partNumbers.map((n) =>
      getSignedUrl(client, new UploadPartCommand({ Bucket: bucket, Key: key, UploadId: uploadId, PartNumber: n }), {
        expiresIn: UPLOAD_TTL,
      }),
    ),
  );
  return Object.fromEntries(partNumbers.map((n, i) => [n, urls[i]]));
}

/** Part numbers already in the bucket (so an interrupted upload can skip them). */
export async function listUploadedParts(key: string, uploadId: string): Promise<Part[]> {
  const { client, bucket } = config();
  const parts: Part[] = [];
  let marker: string | undefined;
  do {
    const res = await client.send(new ListPartsCommand({ Bucket: bucket, Key: key, UploadId: uploadId, PartNumberMarker: marker }));
    parts.push(...(res.Parts ?? []));
    marker = res.IsTruncated ? res.NextPartNumberMarker : undefined;
  } while (marker);
  return parts;
}

/** Finishes a multipart upload once every part is in. Returns false if parts are missing. */
export async function finishMultipart(key: string, uploadId: string, size: number): Promise<boolean> {
  const { client, bucket } = config();
  const parts = await listUploadedParts(key, uploadId);
  if (parts.length !== partPlan(size).count) return false;
  await client.send(
    new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts.sort((a, b) => (a.PartNumber ?? 0) - (b.PartNumber ?? 0)).map((p) => ({ PartNumber: p.PartNumber, ETag: p.ETag })),
      },
    }),
  );
  return true;
}

export async function abortMultipart(key: string, uploadId: string): Promise<void> {
  const { client, bucket } = config();
  await client.send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: uploadId }));
}

/** Size of a stored object, or null if it isn't there. */
export async function objectSize(key: string): Promise<number | null> {
  const { client, bucket } = config();
  try {
    const res = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return res.ContentLength ?? 0;
  } catch {
    return null;
  }
}

/** A short-lived link to the file; `download` makes the browser save it under its name. */
export async function presignGet(key: string, opts: { name?: string; download?: boolean; contentType?: string | null; expiresIn?: number } = {}) {
  const { client, bucket } = config();
  const disposition = opts.name
    ? `${opts.download ? "attachment" : "inline"}; filename="${opts.name.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "'")}"; filename*=UTF-8''${encodeURIComponent(opts.name)}`
    : undefined;
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: disposition,
      ResponseContentType: opts.contentType ?? undefined,
    }),
    { expiresIn: opts.expiresIn ?? 60 * 60 },
  );
}

export async function deleteObjects(keys: string[]): Promise<void> {
  const { client, bucket } = config();
  for (let i = 0; i < keys.length; i += 1000) {
    const batch = keys.slice(i, i + 1000);
    if (!batch.length) continue;
    await client.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true } }));
  }
}
