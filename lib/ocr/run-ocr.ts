import { getEnv } from "@/lib/env";
import { parseReceiptText, type ParsedReceiptFields } from "./parse-fields";

export type OcrResult = {
  rawText: string;
  parsedFields: ParsedReceiptFields;
  confidence: number | null;
};

/**
 * Runs OCR on a receipt image/PDF and returns both the raw extracted text
 * and a best-effort structured parse.
 *
 * PROVIDER INTEGRATION POINT: this posts the file as multipart/form-data to
 * `OCR_API_URL` with `Authorization: Bearer OCR_API_KEY` and expects a JSON
 * response shaped like `{ text: string, confidence?: number }`. Swap the
 * fetch call below (request shape + response mapping) if your OCR provider
 * uses a different contract — everything downstream (`parseReceiptText`,
 * the review UI) only depends on the `OcrResult` shape returned here, not
 * on any provider-specific details.
 */
export async function runOcr(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string,
): Promise<OcrResult> {
  const env = getEnv();
  if (!env.OCR_API_URL || !env.OCR_API_KEY) {
    throw new Error(
      "OCR is not configured. Set OCR_API_URL and OCR_API_KEY (see .env.example).",
    );
  }

  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(fileBuffer)], { type: contentType }),
    fileName,
  );

  const res = await fetch(env.OCR_API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.OCR_API_KEY}` },
    body: form,
  });

  if (!res.ok) {
    throw new Error(`OCR request failed (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as { text?: string; confidence?: number };
  const rawText = data.text ?? "";

  return {
    rawText,
    parsedFields: parseReceiptText(rawText),
    confidence: typeof data.confidence === "number" ? data.confidence : null,
  };
}
