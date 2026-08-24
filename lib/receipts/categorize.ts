import type { DefaultExpenseCategory } from "./categories";

export type BusinessOrPersonal = "business" | "personal";

export type CategorySuggestion = {
  category: string;
  businessOrPersonal: BusinessOrPersonal;
  source: "vendor-rule" | "keyword" | "default";
};

export type VendorRule = {
  vendorPattern: string;
  defaultCategory: string;
  defaultBusinessFlag: BusinessOrPersonal;
};

// Built-in keyword fallback — used when the user has no vendor rule yet.
// Corrections made on the review screen should be persisted as a
// receipt_vendor_rules row so future receipts from the same vendor
// auto-categorize correctly (see POST /api/receipts/vendor-rules).
const KEYWORD_RULES: { keywords: string[]; category: DefaultExpenseCategory; business: BusinessOrPersonal }[] = [
  { keywords: ["shell", "chevron", "exxon", "mobil", "bp gas", "arco", "76 ", "valero", "gas station"], category: "Vehicle/Mileage", business: "business" },
  { keywords: ["uber", "lyft", "taxi", "delta", "united air", "american air", "southwest", "hotel", "marriott", "hilton", "airbnb", "expedia", "airline"], category: "Travel", business: "business" },
  { keywords: ["staples", "office depot", "office max", "best buy", "home depot", "lowes"], category: "Equipment/Supplies", business: "business" },
  { keywords: ["aws", "amazon web services", "google cloud", "microsoft", "adobe", "github", "slack", "zoom", "notion", "figma", "openai", "anthropic"], category: "Software/Subscriptions", business: "business" },
  { keywords: ["adp", "gusto", "paychex", "quickbooks payroll"], category: "Payroll", business: "business" },
  { keywords: ["electric", "gas company", "water utility", "internet", "comcast", "at&t", "verizon utility"], category: "Utilities", business: "business" },
  { keywords: ["law office", "law firm", "cpa", "accounting", "consulting", "notary"], category: "Professional Services", business: "business" },
  { keywords: ["restaurant", "cafe", "coffee", "starbucks", "diner", "grill", "bistro", "pizza", "bar & grill"], category: "Meals & Entertainment", business: "personal" },
];

/**
 * Rule-based, then keyword-based first pass at categorizing a receipt.
 * Always presented on an editable confirmation screen — never trusted as
 * final without user review.
 */
export function suggestCategory(
  vendorName: string | null,
  userRules: VendorRule[],
): CategorySuggestion {
  const name = (vendorName ?? "").toLowerCase().trim();

  if (name) {
    const rule = userRules.find((r) => name.includes(r.vendorPattern.toLowerCase()));
    if (rule) {
      return {
        category: rule.defaultCategory,
        businessOrPersonal: rule.defaultBusinessFlag,
        source: "vendor-rule",
      };
    }

    for (const kw of KEYWORD_RULES) {
      if (kw.keywords.some((k) => name.includes(k))) {
        return { category: kw.category, businessOrPersonal: kw.business, source: "keyword" };
      }
    }
  }

  return { category: "Other", businessOrPersonal: "personal", source: "default" };
}
