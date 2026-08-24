import { z } from "zod";

export const createVaultSettingsSchema = z.object({
  kdfSalt: z.string().min(1),
  kdfIterations: z.number().int().min(100_000).max(5_000_000),
  verifierBlob: z.string().min(1),
  verifierIv: z.string().min(1),
});

export const createVaultEntrySchema = z.object({
  siteName: z.string().trim().min(1).max(200),
  siteUrl: z.string().trim().max(500).optional().nullable(),
  category: z.string().trim().max(100).optional().nullable(),
  encryptedBlob: z.string().min(1),
  iv: z.string().min(1),
});

export const updateVaultEntrySchema = createVaultEntrySchema.partial().extend({
  lastUsedAt: z.iso.datetime().optional(),
});

export const createVaultCategorySchema = z.object({
  name: z.string().trim().min(1).max(100),
});

export type CreateVaultEntryInput = z.infer<typeof createVaultEntrySchema>;
export type UpdateVaultEntryInput = z.infer<typeof updateVaultEntrySchema>;
