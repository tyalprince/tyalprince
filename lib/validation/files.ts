import { z } from "zod";
import { MAX_FILE_SIZE } from "@/lib/files/names";

const id = z.string().uuid();

export const uploadRequestSchema = z.object({
  parentId: id.nullable(),
  files: z
    .array(
      z.object({
        name: z.string().min(1).max(1000),
        size: z.number().int().min(0).max(MAX_FILE_SIZE),
        contentType: z.string().max(200).optional(),
        // From a folder upload: "Trip/Day 1/IMG_1.jpg".
        relativePath: z.string().max(4000).optional(),
      }),
    )
    .min(1)
    .max(200),
});

export const partsRequestSchema = z.object({
  partNumbers: z.array(z.number().int().min(1).max(10_000)).min(1).max(100),
});

export const completeRequestSchema = z.object({
  thumbnail: z.boolean().optional(),
});

export const createFolderSchema = z.object({
  parentId: id.nullable(),
  name: z.string().min(1).max(255),
});

export const renameSchema = z.object({
  name: z.string().min(1).max(255),
});

export const batchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.enum(["trash", "restore", "delete", "star", "unstar"]), ids: z.array(id).min(1).max(1000) }),
  z.object({ action: z.literal("move"), ids: z.array(id).min(1).max(1000), parentId: id.nullable() }),
]);

export const shareSchema = z.object({
  // null = the link never expires.
  expiresInDays: z.union([z.literal(1), z.literal(7), z.literal(30), z.null()]),
});
