export type ReceiptRow = {
  id: string;
  userId: string;
  s3Key: string;
  vendorName: string | null;
  receiptDate: string | null;
  totalAmount: string | null;
  taxAmount: string | null;
  currency: string;
  businessOrPersonal: "business" | "personal" | null;
  category: string | null;
  subcategory: string | null;
  notes: string | null;
  ocrRawText: string | null;
  ocrConfidence: string | null;
  lineItems: { description: string; amount: number }[] | null;
  createdAt: string;
  updatedAt: string;
};

export type ReceiptCategoryRow = {
  id: string;
  userId: string;
  name: string;
  businessOrPersonal: "business" | "personal";
  isDefault: boolean;
};
