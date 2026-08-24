"use client";

import { useState } from "react";
import { Copy, Eye, EyeOff, Pencil, Trash2, AlertTriangle, Repeat, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copyWithAutoClear } from "@/lib/clipboard";
import type { DecryptedVaultEntry } from "@/lib/vault/types";
import type { EntryFlags } from "@/lib/vault/analysis";
import { cn } from "@/lib/utils";

function faviconUrl(siteUrl: string | null): string | null {
  if (!siteUrl) return null;
  try {
    const host = new URL(
      siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`,
    ).hostname;
    return `https://www.google.com/s2/favicons?sz=64&domain=${host}`;
  } catch {
    return null;
  }
}

export function EntryRow({
  entry,
  flags,
  onEdit,
  onDelete,
  onUsed,
}: {
  entry: DecryptedVaultEntry;
  flags?: EntryFlags;
  onEdit: () => void;
  onDelete: () => void;
  onUsed: () => void;
}) {
  const [reveal, setReveal] = useState(false);
  const favicon = faviconUrl(entry.siteUrl);

  async function handleCopyPassword() {
    await copyWithAutoClear(entry.secret.password);
    onUsed();
  }

  return (
    <div className="flex items-center gap-3 border-b border-neutral-100 px-3 py-3 last:border-b-0 dark:border-neutral-900">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded bg-neutral-100 dark:bg-neutral-800">
        {favicon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={favicon} alt="" className="h-5 w-5" />
        ) : (
          <span className="text-xs font-semibold text-neutral-400">
            {entry.siteName.slice(0, 1).toUpperCase()}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-medium">{entry.siteName}</p>
          {flags?.weak && (
            <span title="Weak password">
              <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
            </span>
          )}
          {flags?.reused && (
            <span title="Reused password">
              <Repeat className="h-3.5 w-3.5 text-amber-500" />
            </span>
          )}
          {flags?.old && (
            <span title="Not updated in over a year">
              <Clock className="h-3.5 w-3.5 text-neutral-400" />
            </span>
          )}
        </div>
        <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
          {entry.secret.username || "—"}
        </p>
      </div>

      <div className="hidden w-40 shrink-0 items-center sm:flex">
        <span
          className={cn(
            "truncate font-mono text-sm",
            !reveal && "select-none tracking-widest",
          )}
        >
          {reveal ? entry.secret.password : "•".repeat(10)}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          className="px-2"
          onClick={() => setReveal((v) => !v)}
          aria-label={reveal ? "Hide password" : "Reveal password"}
        >
          {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          className="px-2"
          onClick={handleCopyPassword}
          aria-label="Copy password"
        >
          <Copy className="h-4 w-4" />
        </Button>
        <Button variant="ghost" className="px-2" onClick={onEdit} aria-label="Edit">
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          className="px-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
          onClick={onDelete}
          aria-label="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
