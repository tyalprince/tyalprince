"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StrengthMeter } from "@/components/password-generator/strength-meter";
import { apiFetch } from "@/lib/api-client";
import {
  DEFAULT_KDF_ITERATIONS,
  createVerifier,
  deriveVaultKey,
  generateSaltBase64,
} from "@/lib/crypto/vault-crypto";
import type { VaultSettingsRow } from "@/lib/vault/types";

export function VaultSetup({
  onReady,
}: {
  onReady: (settings: VaultSettingsRow, key: CryptoKey) => void;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 10) {
      setError("Master password must be at least 10 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setBusy(true);
    try {
      const kdfSalt = generateSaltBase64();
      const kdfIterations = DEFAULT_KDF_ITERATIONS;
      const key = await deriveVaultKey(password, kdfSalt, kdfIterations);
      const verifier = await createVerifier(key);

      const { settings } = await apiFetch<{ settings: VaultSettingsRow }>(
        "/api/vault/settings",
        {
          method: "POST",
          body: JSON.stringify({
            kdfSalt,
            kdfIterations,
            verifierBlob: verifier.ciphertext,
            verifierIv: verifier.iv,
          }),
        },
      );

      onReady(settings, key);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set up vault.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-6 flex flex-col items-center text-center">
        <ShieldCheck className="mb-2 h-8 w-8 text-neutral-400" />
        <h1 className="text-lg font-semibold">Set your Master Password</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          This is separate from your login password. It never leaves your
          device — everything in your vault is encrypted and decrypted right
          here in the browser. If you forget it, your vault data{" "}
          <strong>cannot</strong> be recovered.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-lg border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
      >
        <div className="space-y-1">
          <label htmlFor="master-password" className="text-sm font-medium">
            Master password
          </label>
          <Input
            id="master-password"
            type="password"
            required
            minLength={10}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          {password && <StrengthMeter password={password} />}
        </div>
        <div className="space-y-1">
          <label htmlFor="master-password-confirm" className="text-sm font-medium">
            Confirm master password
          </label>
          <Input
            id="master-password-confirm"
            type="password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Setting up..." : "Create vault"}
        </Button>
      </form>
    </div>
  );
}
