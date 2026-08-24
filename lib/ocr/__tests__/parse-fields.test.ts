import { describe, expect, it } from "vitest";
import { parseReceiptText } from "@/lib/ocr/parse-fields";

describe("parseReceiptText", () => {
  it("extracts vendor, date, total, and tax from a typical receipt", () => {
    const text = [
      "HOME DEPOT #4521",
      "1234 Main St, Anytown USA",
      "03/15/2024",
      "Hammer               19.99",
      "Nails 5lb box        12.50",
      "Subtotal             32.49",
      "Tax                   2.68",
      "Total                35.17",
      "VISA ************1234",
    ].join("\n");

    const result = parseReceiptText(text);

    expect(result.vendorName).toBe("HOME DEPOT #4521");
    expect(result.date).toBe("2024-03-15");
    expect(result.totalAmount).toBe(35.17);
    expect(result.taxAmount).toBe(2.68);
  });

  it("parses an ISO-formatted date", () => {
    const result = parseReceiptText("Some Vendor\n2023-11-05\nTotal $10.00");
    expect(result.date).toBe("2023-11-05");
  });

  it("parses a month-name date", () => {
    const result = parseReceiptText("Some Vendor\nMarch 5, 2023\nTotal $10.00");
    expect(result.date).toBe("2023-03-05");
  });

  it("does not confuse subtotal with total", () => {
    const result = parseReceiptText(
      "Vendor\n01/01/2024\nSubtotal 50.00\nTax 4.00\nTotal 54.00",
    );
    expect(result.totalAmount).toBe(54.0);
  });

  it("falls back to the largest amount when no explicit total line exists", () => {
    const result = parseReceiptText("Vendor\n01/01/2024\nItem A 5.00\nItem B 42.75");
    expect(result.totalAmount).toBe(42.75);
  });

  it("extracts line items while excluding total/tax/payment lines", () => {
    const result = parseReceiptText(
      [
        "Cafe Vendor",
        "01/01/2024",
        "Latte 4.50",
        "Muffin 3.25",
        "Subtotal 7.75",
        "Tax 0.62",
        "Total 8.37",
        "VISA card ending 1234",
      ].join("\n"),
    );

    const descriptions = result.lineItems.map((li) => li.description);
    expect(descriptions).toContain("Latte");
    expect(descriptions).toContain("Muffin");
    expect(descriptions).not.toContain("Subtotal");
    expect(descriptions).not.toContain("Total");
  });

  it("returns nulls gracefully for empty/unparseable text", () => {
    const result = parseReceiptText("");
    expect(result.vendorName).toBeNull();
    expect(result.date).toBeNull();
    expect(result.totalAmount).toBeNull();
    expect(result.taxAmount).toBeNull();
    expect(result.lineItems).toEqual([]);
  });
});
