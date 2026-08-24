import { describe, expect, it } from "vitest";
import { computeEntryFlags } from "@/lib/vault/analysis";
import type { DecryptedVaultEntry } from "@/lib/vault/types";

function makeEntry(overrides: Partial<DecryptedVaultEntry>): DecryptedVaultEntry {
  const now = new Date().toISOString();
  return {
    id: "id",
    userId: "user",
    siteName: "example.com",
    siteUrl: null,
    category: null,
    encryptedBlob: "x",
    iv: "y",
    createdAt: now,
    updatedAt: now,
    lastUsedAt: null,
    secret: { username: "user", password: "correcthorsebatterystaple99!", notes: "" },
    ...overrides,
  };
}

describe("computeEntryFlags", () => {
  it("flags a short/simple password as weak", () => {
    const entries = [makeEntry({ id: "a", secret: { username: "u", password: "abc123", notes: "" } })];
    const flags = computeEntryFlags(entries);
    expect(flags.get("a")?.weak).toBe(true);
  });

  it("does not flag a strong password as weak", () => {
    const entries = [
      makeEntry({ id: "a", secret: { username: "u", password: "xQ9$vL2#pR7&mZ4!", notes: "" } }),
    ];
    const flags = computeEntryFlags(entries);
    expect(flags.get("a")?.weak).toBe(false);
  });

  it("flags reused passwords shared across entries", () => {
    const entries = [
      makeEntry({ id: "a", secret: { username: "u1", password: "sharedPassword1!", notes: "" } }),
      makeEntry({ id: "b", secret: { username: "u2", password: "sharedPassword1!", notes: "" } }),
      makeEntry({ id: "c", secret: { username: "u3", password: "uniquePassword2!", notes: "" } }),
    ];
    const flags = computeEntryFlags(entries);
    expect(flags.get("a")?.reused).toBe(true);
    expect(flags.get("b")?.reused).toBe(true);
    expect(flags.get("c")?.reused).toBe(false);
  });

  it("flags entries not updated in over a year as old", () => {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const entries = [
      makeEntry({ id: "a", updatedAt: twoYearsAgo.toISOString() }),
      makeEntry({ id: "b", updatedAt: new Date().toISOString() }),
    ];
    const flags = computeEntryFlags(entries);
    expect(flags.get("a")?.old).toBe(true);
    expect(flags.get("b")?.old).toBe(false);
  });
});
