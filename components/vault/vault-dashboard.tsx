"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api-client";
import { decryptJSON } from "@/lib/crypto/vault-crypto";
import { computeEntryFlags } from "@/lib/vault/analysis";
import { useGeneratedPasswordStash } from "@/lib/context/generated-password-context";
import type {
  DecryptedVaultEntry,
  VaultCategoryRow,
  VaultEntryRow,
  VaultEntrySecret,
} from "@/lib/vault/types";
import { EntryRow } from "./entry-row";
import { EntryForm } from "./entry-form";
import { ImportExport } from "./import-export";

export function VaultDashboard({
  vaultKey,
  onLock,
}: {
  vaultKey: CryptoKey;
  onLock: () => void;
}) {
  const [entries, setEntries] = useState<DecryptedVaultEntry[] | null>(null);
  const [categories, setCategories] = useState<VaultCategoryRow[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<DecryptedVaultEntry | null | "new">(null);
  const [prefillPassword, setPrefillPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const stash = useGeneratedPasswordStash();

  const loadEntries = useCallback(async () => {
    const { entries: rows } = await apiFetch<{ entries: VaultEntryRow[] }>(
      "/api/vault/entries",
    );
    const decrypted = await Promise.all(
      rows.map(async (row) => {
        try {
          const secret = await decryptJSON<VaultEntrySecret>(
            vaultKey,
            row.encryptedBlob,
            row.iv,
          );
          return { ...row, secret };
        } catch {
          return {
            ...row,
            secret: { username: "", password: "", notes: "(failed to decrypt)" },
          };
        }
      }),
    );
    setEntries(decrypted);
  }, [vaultKey]);

  useEffect(() => {
    // Data fetching on mount: state is set from the async callbacks below,
    // never synchronously in the effect body itself.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadEntries().catch((err) =>
      setError(err instanceof Error ? err.message : "Failed to load entries."),
    );
    apiFetch<{ categories: VaultCategoryRow[] }>("/api/vault/categories")
      .then((res) => setCategories(res.categories))
      .catch(() => {});
  }, [loadEntries]);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPrefillPassword(stash.consume());
      setEditing("new");
      router.replace("/passwords");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const flags = useMemo(
    () => (entries ? computeEntryFlags(entries) : new Map()),
    [entries],
  );

  const filtered = useMemo(() => {
    if (!entries) return [];
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.siteName.toLowerCase().includes(q) ||
        (e.category ?? "").toLowerCase().includes(q) ||
        e.secret.username.toLowerCase().includes(q),
    );
  }, [entries, search]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this vault entry? This can't be undone.")) return;
    await apiFetch(`/api/vault/entries/${id}`, { method: "DELETE" });
    setEntries((prev) => prev?.filter((e) => e.id !== id) ?? null);
  }

  async function markUsed(entry: DecryptedVaultEntry) {
    try {
      await apiFetch(`/api/vault/entries/${entry.id}`, {
        method: "PATCH",
        body: JSON.stringify({ lastUsedAt: new Date().toISOString() }),
      });
    } catch {
      // Non-critical — ignore.
    }
  }

  const weakCount = entries
    ? [...flags.values()].filter((f) => f.weak).length
    : 0;
  const reusedCount = entries
    ? [...flags.values()].filter((f) => f.reused).length
    : 0;

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Passwords</h1>
          {entries && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {entries.length} saved
              {weakCount > 0 && ` · ${weakCount} weak`}
              {reusedCount > 0 && ` · ${reusedCount} reused`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" />
            Add entry
          </Button>
          <Button variant="secondary" onClick={onLock}>
            <Lock className="h-4 w-4" />
            Lock
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-neutral-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by site, category, or username"
            className="pl-8"
          />
        </div>
        {entries && (
          <ImportExport vaultKey={vaultKey} entries={entries} onImported={loadEntries} />
        )}
      </div>

      {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        {entries === null ? (
          <p className="p-6 text-center text-sm text-neutral-500">Decrypting...</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-center text-sm text-neutral-500">
            {entries.length === 0
              ? "No entries yet — add your first password."
              : "No entries match your search."}
          </p>
        ) : (
          filtered.map((entry) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              flags={flags.get(entry.id)}
              onEdit={() => setEditing(entry)}
              onDelete={() => handleDelete(entry.id)}
              onUsed={() => markUsed(entry)}
            />
          ))
        )}
      </div>

      {editing && (
        <EntryForm
          vaultKey={vaultKey}
          categories={categories}
          initial={editing === "new" ? null : editing}
          prefillPassword={editing === "new" ? prefillPassword : undefined}
          onClose={() => {
            setEditing(null);
            setPrefillPassword(null);
          }}
          onSaved={(saved) => {
            setEntries((prev) => {
              if (!prev) return [saved];
              const exists = prev.some((e) => e.id === saved.id);
              return exists
                ? prev.map((e) => (e.id === saved.id ? saved : e))
                : [...prev, saved];
            });
            setEditing(null);
            setPrefillPassword(null);
          }}
        />
      )}
    </div>
  );
}
