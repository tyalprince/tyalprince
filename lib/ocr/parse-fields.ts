export type ParsedReceiptFields = {
  vendorName: string | null;
  date: string | null; // ISO yyyy-mm-dd
  totalAmount: number | null;
  taxAmount: number | null;
  lineItems: { description: string; amount: number }[];
};

const CURRENCY_RE = /\$?\s?(\d{1,3}(?:[,.]\d{3})*(?:\.\d{2})|\d+\.\d{2})/;
const DATE_PATTERNS: { re: RegExp; toIso: (m: RegExpMatchArray) => string | null }[] = [
  {
    // 2024-03-15 or 2024/03/15
    re: /\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/,
    toIso: (m) => isoOrNull(Number(m[1]), Number(m[2]), Number(m[3])),
  },
  {
    // 03/15/2024 or 3-15-24
    re: /\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/,
    toIso: (m) => {
      const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
      return isoOrNull(year, Number(m[1]), Number(m[2]));
    },
  },
  {
    // March 15, 2024 / Mar 15 2024
    re: /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(\d{1,2}),?\s+(\d{4})\b/i,
    toIso: (m) => {
      const month = MONTHS.findIndex((mo) => m[1].toLowerCase().startsWith(mo));
      if (month === -1) return null;
      return isoOrNull(Number(m[3]), month + 1, Number(m[2]));
    },
  },
];
const MONTHS = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
];

function isoOrNull(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (year < 1970 || year > 2100) return null;
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function parseAmount(text: string): number | null {
  const match = text.match(CURRENCY_RE);
  if (!match) return null;
  const cleaned = match[1].replace(/,/g, "");
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}

const SKIP_LINE_ITEM_KEYWORDS =
  /\b(total|subtotal|sub-total|tax|change|cash|credit|debit|balance|tender|visa|mastercard|amex|approval|auth|card)\b/i;

/** Best-effort heuristic parser for OCR'd receipt text. OCR is never 100%
 *  accurate, so callers must present these as editable defaults, not
 *  ground truth — see the receipts review screen. */
export function parseReceiptText(rawText: string): ParsedReceiptFields {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const vendorName = lines[0] ?? null;

  let date: string | null = null;
  for (const line of lines) {
    for (const { re, toIso } of DATE_PATTERNS) {
      const m = line.match(re);
      if (m) {
        const iso = toIso(m);
        if (iso) {
          date = iso;
          break;
        }
      }
    }
    if (date) break;
  }

  let totalAmount: number | null = null;
  for (const line of lines) {
    if (/\btotal\b/i.test(line) && !/\bsub\s*-?\s*total\b/i.test(line)) {
      const amount = parseAmount(line);
      if (amount !== null) {
        totalAmount = amount;
        break;
      }
    }
  }
  if (totalAmount === null) {
    // Fall back to the largest currency-looking number anywhere on the
    // receipt — usually the grand total on a simple layout.
    const amounts = lines
      .map(parseAmount)
      .filter((a): a is number => a !== null);
    if (amounts.length > 0) totalAmount = Math.max(...amounts);
  }

  let taxAmount: number | null = null;
  for (const line of lines) {
    if (/\btax\b/i.test(line)) {
      const amount = parseAmount(line);
      if (amount !== null) {
        taxAmount = amount;
        break;
      }
    }
  }

  const lineItems: { description: string; amount: number }[] = [];
  for (const line of lines) {
    if (SKIP_LINE_ITEM_KEYWORDS.test(line)) continue;
    const amount = parseAmount(line);
    if (amount === null) continue;
    const description = line.replace(CURRENCY_RE, "").trim().replace(/[-–—:]+$/, "").trim();
    if (description) lineItems.push({ description, amount });
  }

  return { vendorName, date, totalAmount, taxAmount, lineItems };
}
