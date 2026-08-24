"use client";

import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { encryptJSON } from "@/lib/crypto/vault-crypto";
import { parseCredentialCsv } from "@/lib/vault/csv-import";
import type { DecryptedVaultEntry, VaultEntryRow } from "@/lib/vault/types";

export function ImportExport({
  vaultKey,
  entries,
  onImported,
}: {
  vaultKey: CryptoKey;
  entries: DecryptedVaultEntry[];
  onImported: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setImporting(true);
    setImportSummary(null);
    try {
      const text = await file.text();
      const rows = parseCredentialCsv(text);

      let succeeded = 0;
      for (const row of rows) {
        const { ciphertext, iv } = await encryptJSON(vaultKey, {
          username: row.username,
          password: row.password,
          notes: row.notes,
        });
        await apiFetch<{ entry: VaultEntryRow }>("/api/vault/entries", {
          method: "POST",
          body: JSON.stringify({
            siteName: row.siteName,
            siteUrl: row.siteUrl || null,
            category: null,
            encryptedBlob: ciphertext,
            iv,
          }),
        });
        succeeded++;
      }
      setImportSummary(`Imported ${succeeded} of ${rows.length} entries.`);
      onImported();
    } catch (err) {
      setImportSummary(
        err instanceof Error ? `Import failed: ${err.message}` : "Import failed.",
      );
    } finally {
      setImporting(false);
    }
  }

  function handleExport() {
    const backup = {
      exportedAt: new Date().toISOString(),
      note: "This file contains AES-256-GCM encrypted vault entries. It is only readable with your master password.",
      entries: entries.map((e) => ({
        siteName: e.siteName,
        siteUrl: e.siteUrl,
        category: e.category,
        encryptedBlob: e.encryptedBlob,
        iv: e.iv,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      })),
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vault-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleFile}
      />
      <Button
        variant="secondary"
        onClick={() => fileInputRef.current?.click()}
        disabled={importing}
      >
        <Upload className="h-4 w-4" />
        {importing ? "Importing..." : "Import CSV"}
      </Button>
      <Button variant="secondary" onClick={handleExport}>
        <Download className="h-4 w-4" />
        Export backup
      </Button>
      {importSummary && (
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          {importSummary}
        </span>
      )}
    </div>
  );
}
