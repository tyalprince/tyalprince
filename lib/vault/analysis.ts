import { evaluateStrength } from "@/lib/crypto/strength";
import type { DecryptedVaultEntry } from "./types";

export type EntryFlags = {
  weak: boolean;
  reused: boolean;
  old: boolean;
};

const OLD_THRESHOLD_MS = 365 * 24 * 60 * 60 * 1000; // 1 year

/** All comparisons happen on already-decrypted, in-memory data — nothing
 *  here touches the network or persists plaintext. */
export function computeEntryFlags(
  entries: DecryptedVaultEntry[],
): Map<string, EntryFlags> {
  const passwordCounts = new Map<string, number>();
  for (const e of entries) {
    if (!e.secret.password) continue;
    passwordCounts.set(
      e.secret.password,
      (passwordCounts.get(e.secret.password) ?? 0) + 1,
    );
  }

  const now = Date.now();
  const flags = new Map<string, EntryFlags>();
  for (const e of entries) {
    const strength = evaluateStrength(e.secret.password);
    const lastTouched = new Date(e.updatedAt).getTime();
    flags.set(e.id, {
      weak: strength.score <= 1,
      reused: (passwordCounts.get(e.secret.password) ?? 0) > 1,
      old: now - lastTouched > OLD_THRESHOLD_MS,
    });
  }
  return flags;
}
