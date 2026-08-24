"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { checkVerifier, deriveVaultKey } from "@/lib/crypto/vault-crypto";
import type { VaultSettingsRow } from "@/lib/vault/types";

export function VaultUnlock({
  settings,
  onUnlocked,
}: {
  settings: VaultSettingsRow;
  onUnlocked: (key: CryptoKey) => void;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForgot, setShowForgot] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const key = await deriveVaultKey(
        password,
        settings.kdfSalt,
        settings.kdfIterations,
      );
      const valid = await checkVerifier(
        key,
        settings.verifierBlob,
        settings.verifierIv,
      );
      if (!valid) {
        setError("Incorrect master password.");
        return;
      }
      onUnlocked(key);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm">
      <div className="mb-6 flex flex-col items-center text-center">
        <Lock className="mb-2 h-8 w-8 text-neutral-400" />
        <h1 className="text-lg font-semibold">Unlock your vault</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Enter your master password to decrypt your vault in this browser.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-lg border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
      >
        <Input
          type="password"
          required
          autoFocus
          placeholder="Master password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Unlocking..." : "Unlock"}
        </Button>
      </form>

      <button
        onClick={() => setShowForgot((v) => !v)}
        className="mt-4 w-full text-center text-xs text-neutral-400 underline underline-offset-2 hover:text-neutral-600 dark:hover:text-neutral-300"
      >
        Forgot your master password?
      </button>
      {showForgot && (
        <p className="mt-2 rounded-md bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Your vault is end-to-end encrypted — we never store your master
          password or the key derived from it, so there is no way for us (or
          anyone) to recover it for you. If you&apos;ve truly lost it, the
          only option is to delete your vault and start over, which
          permanently erases every saved entry. This is the tradeoff of
          zero-knowledge encryption: total privacy, no backdoor.
        </p>
      )}
    </div>
  );
}
