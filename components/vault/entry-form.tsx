"use client";

import { useState } from "react";
import { Eye, EyeOff, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { StrengthMeter } from "@/components/password-generator/strength-meter";
import { GeneratorPanel } from "@/components/password-generator/generator-panel";
import { apiFetch } from "@/lib/api-client";
import { encryptJSON } from "@/lib/crypto/vault-crypto";
import type { DecryptedVaultEntry, VaultCategoryRow, VaultEntryRow } from "@/lib/vault/types";

export function EntryForm({
  vaultKey,
  categories,
  initial,
  prefillPassword,
  onSaved,
  onClose,
}: {
  vaultKey: CryptoKey;
  categories: VaultCategoryRow[];
  initial: DecryptedVaultEntry | null;
  prefillPassword?: string | null;
  onSaved: (entry: DecryptedVaultEntry) => void;
  onClose: () => void;
}) {
  const [siteName, setSiteName] = useState(initial?.siteName ?? "");
  const [siteUrl, setSiteUrl] = useState(initial?.siteUrl ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [username, setUsername] = useState(initial?.secret.username ?? "");
  const [password, setPassword] = useState(
    initial?.secret.password ?? prefillPassword ?? "",
  );
  const [notes, setNotes] = useState(initial?.secret.notes ?? "");
  const [reveal, setReveal] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!siteName.trim()) {
      setError("Site name is required.");
      return;
    }
    setBusy(true);
    try {
      const { ciphertext, iv } = await encryptJSON(vaultKey, {
        username,
        password,
        notes,
      });

      const payload = {
        siteName: siteName.trim(),
        siteUrl: siteUrl.trim() || null,
        category: category.trim() || null,
        encryptedBlob: ciphertext,
        iv,
      };

      const { entry } = initial
        ? await apiFetch<{ entry: VaultEntryRow }>(
            `/api/vault/entries/${initial.id}`,
            { method: "PATCH", body: JSON.stringify(payload) },
          )
        : await apiFetch<{ entry: VaultEntryRow }>("/api/vault/entries", {
            method: "POST",
            body: JSON.stringify(payload),
          });

      onSaved({ ...entry, secret: { username, password, notes } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save entry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={initial ? "Edit entry" : "New vault entry"}
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1">
          <label className="text-sm font-medium">Site name</label>
          <Input
            value={siteName}
            onChange={(e) => setSiteName(e.target.value)}
            required
            autoFocus
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Site URL</label>
          <Input
            value={siteUrl}
            onChange={(e) => setSiteUrl(e.target.value)}
            placeholder="https://example.com"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Category</label>
          <Input
            list="vault-categories"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Personal, Business, Banking..."
          />
          <datalist id="vault-categories">
            {categories.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Username / email</label>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Password</label>
          <div className="flex items-center gap-2">
            <Input
              type={reveal ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="font-mono"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => setReveal((v) => !v)}
              aria-label={reveal ? "Hide password" : "Reveal password"}
            >
              {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowGenerator(true)}
              aria-label="Generate password"
            >
              <Wand2 className="h-4 w-4" />
            </Button>
          </div>
          {password && <StrengthMeter password={password} />}
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving..." : "Save"}
          </Button>
        </div>
      </form>

      <Dialog
        open={showGenerator}
        onClose={() => setShowGenerator(false)}
        title="Generate password"
      >
        <GeneratorPanel
          showSaveToVault={false}
          onUse={(pw) => {
            setPassword(pw);
            setShowGenerator(false);
          }}
        />
      </Dialog>
    </Dialog>
  );
}
