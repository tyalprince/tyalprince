import { describe, expect, it } from "vitest";
import { suggestCategory } from "@/lib/receipts/categorize";

describe("suggestCategory", () => {
  it("prefers a user vendor rule over the keyword fallback", () => {
    const suggestion = suggestCategory("Shell Gas Station #12", [
      { vendorPattern: "shell", defaultCategory: "Custom Fuel", defaultBusinessFlag: "personal" },
    ]);
    expect(suggestion).toEqual({
      category: "Custom Fuel",
      businessOrPersonal: "personal",
      source: "vendor-rule",
    });
  });

  it("falls back to keyword matching when no vendor rule exists", () => {
    const suggestion = suggestCategory("Shell Gas Station #12", []);
    expect(suggestion.category).toBe("Vehicle/Mileage");
    expect(suggestion.source).toBe("keyword");
  });

  it("matches software vendors to Software/Subscriptions", () => {
    const suggestion = suggestCategory("Amazon Web Services", []);
    expect(suggestion.category).toBe("Software/Subscriptions");
  });

  it("defaults to Other/personal when nothing matches", () => {
    const suggestion = suggestCategory("Some Unknown Shop", []);
    expect(suggestion).toEqual({
      category: "Other",
      businessOrPersonal: "personal",
      source: "default",
    });
  });

  it("defaults gracefully when vendor name is null", () => {
    const suggestion = suggestCategory(null, []);
    expect(suggestion.source).toBe("default");
  });
});
