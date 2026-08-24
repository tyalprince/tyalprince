import { describe, expect, it } from "vitest";
import {
  DEFAULT_PASSWORD_OPTIONS,
  generatePassphrase,
  generatePassword,
  poolSizeForOptions,
} from "@/lib/crypto/generator";

describe("generatePassword", () => {
  it("generates a password of the requested length", () => {
    const pw = generatePassword({ ...DEFAULT_PASSWORD_OPTIONS, length: 32 });
    expect(pw).toHaveLength(32);
  });

  it("only uses lowercase letters when other pools are disabled", () => {
    const pw = generatePassword({
      length: 40,
      uppercase: false,
      lowercase: true,
      numbers: false,
      symbols: false,
      excludeAmbiguous: false,
    });
    expect(pw).toMatch(/^[a-z]+$/);
  });

  it("excludes ambiguous characters when requested", () => {
    for (let i = 0; i < 20; i++) {
      const pw = generatePassword({
        length: 50,
        uppercase: true,
        lowercase: true,
        numbers: true,
        symbols: false,
        excludeAmbiguous: true,
      });
      expect(pw).not.toMatch(/[0OlI1]/);
    }
  });

  it("produces different passwords on repeated calls", () => {
    const a = generatePassword(DEFAULT_PASSWORD_OPTIONS);
    const b = generatePassword(DEFAULT_PASSWORD_OPTIONS);
    expect(a).not.toBe(b);
  });

  it("computes a larger pool size with more character types enabled", () => {
    const smaller = poolSizeForOptions({
      length: 20,
      uppercase: false,
      lowercase: true,
      numbers: false,
      symbols: false,
      excludeAmbiguous: false,
    });
    const larger = poolSizeForOptions({
      length: 20,
      uppercase: true,
      lowercase: true,
      numbers: true,
      symbols: true,
      excludeAmbiguous: false,
    });
    expect(larger).toBeGreaterThan(smaller);
  });
});

describe("generatePassphrase", () => {
  it("produces the requested number of words joined by the separator", () => {
    const phrase = generatePassphrase({
      wordCount: 5,
      separator: "-",
      capitalize: false,
      includeNumber: false,
    });
    expect(phrase.split("-")).toHaveLength(5);
  });

  it("capitalizes each word when requested", () => {
    const phrase = generatePassphrase({
      wordCount: 4,
      separator: "-",
      capitalize: true,
      includeNumber: false,
    });
    for (const word of phrase.split("-")) {
      expect(word[0]).toBe(word[0].toUpperCase());
    }
  });
});
