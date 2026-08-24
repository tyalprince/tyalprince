import { S3Client } from "@aws-sdk/client-s3";
import { getEnv } from "@/lib/env";

let cached: S3Client | null = null;

export function getS3Client(): S3Client {
  if (cached) return cached;
  const env = getEnv();
  if (!env.S3_REGION || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
    throw new Error(
      "S3 is not configured. Set S3_BUCKET_NAME, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY.",
    );
  }
  cached = new S3Client({
    region: env.S3_REGION,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
  });
  return cached;
}

export function getBucketName(): string {
  const env = getEnv();
  if (!env.S3_BUCKET_NAME) {
    throw new Error("S3_BUCKET_NAME is not set.");
  }
  return env.S3_BUCKET_NAME;
}
