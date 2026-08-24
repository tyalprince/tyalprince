import { z } from "zod";

export const presignUploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.enum([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "application/pdf",
  ]),
});

export const lineItemSchema = z.object({
  description: z.string().max(300),
  amount: z.number(),
});

export const createReceiptSchema = z.object({
  s3Key: z.string().min(1),
  vendorName: z.string().max(200).optional().nullable(),
  receiptDate: z.iso.date().optional().nullable(),
  totalAmount: z.number().nonnegative().optional().nullable(),
  taxAmount: z.number().nonnegative().optional().nullable(),
  currency: z.string().length(3).default("USD"),
  businessOrPersonal: z.enum(["business", "personal"]).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  subcategory: z.string().max(100).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  ocrRawText: z.string().optional().nullable(),
  ocrConfidence: z.number().min(0).max(1).optional().nullable(),
  lineItems: z.array(lineItemSchema).optional(),
});

export const updateReceiptSchema = createReceiptSchema.partial().omit({
  s3Key: true,
});

export const createReceiptCategorySchema = z.object({
  name: z.string().trim().min(1).max(100),
  businessOrPersonal: z.enum(["business", "personal"]),
  isDefault: z.boolean().optional(),
});

export const createVendorRuleSchema = z.object({
  vendorPattern: z.string().trim().min(1).max(200),
  defaultCategory: z.string().trim().min(1).max(100),
  defaultBusinessFlag: z.enum(["business", "personal"]),
});

export type CreateReceiptInput = z.infer<typeof createReceiptSchema>;
export type UpdateReceiptInput = z.infer<typeof updateReceiptSchema>;
