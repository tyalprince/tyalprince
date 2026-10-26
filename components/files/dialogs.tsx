"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Copy, Download, Folder, FolderOpen, Link2, Share2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api-client";
import { canPreview, fileCategory, formatBytes } from "@/lib/files/names";
import { contentUrl, type DriveItem } from "@/lib/files/types";
import { FileIcon } from "./file-icon";

/** New folder / rename. */
export function NameDialog({
  title,
  initial,
  action,
  onSubmit,
  onClose,
}: {
  title: string;
  initial: string;
  action: string;
  onSubmit: (name: string) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open onClose={onClose} title={title}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          setBusy(true);
          setError(null);
          try {
            await onSubmit(name.trim());
            onClose();
          } catch (err) {
            setError(err instanceof Error ? err.message : "That didn't work.");
            setBusy(false);
          }
        }}
        className="space-y-3"
      >
        <Input
          autoFocus
          value={name}
          maxLength={255}
          onChange={(e) => setName(e.target.value)}
          onFocus={(e) => {
            // Select the name without its extension, like a desktop file manager.
            const dot = e.target.value.lastIndexOf(".");
            e.target.setSelectionRange(0, dot > 0 ? dot : e.target.value.length);
          }}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy || !name.trim()}>
            {action}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

type FolderNode = { id: string; parentId: string | null; name: string };

/** "Move to…" with a folder tree. */
export function MoveDialog({ ids, onMove, onClose }: { ids: string[]; onMove: (parentId: string | null) => Promise<void>; onClose: () => void }) {
  const [folders, setFolders] = useState<FolderNode[] | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ folders: FolderNode[] }>("/api/files/folders")
      .then((r) => setFolders(r.folders))
      .catch(() => setError("Couldn't load your folders."));
  }, []);

  const children = useMemo(() => {
    const map = new Map<string, FolderNode[]>();
    for (const f of folders ?? []) map.set(f.parentId ?? "", [...(map.get(f.parentId ?? "") ?? []), f]);
    for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    return map;
  }, [folders]);

  // The folders being moved (and everything in them) can't be the destination.
  const blocked = useMemo(() => {
    const out = new Set<string>();
    const add = (id: string) => {
      out.add(id);
      for (const c of children.get(id) ?? []) add(c.id);
    };
    for (const id of ids) if (folders?.some((f) => f.id === id)) add(id);
    return out;
  }, [ids, children, folders]);

  const row = (f: FolderNode | null, depth: number): React.ReactNode => {
    const id = f?.id ?? null;
    const kids = children.get(id ?? "") ?? [];
    const expanded = id === null || open.has(id);
    const disabled = id !== null && blocked.has(id);
    return (
      <div key={id ?? "root"}>
        <div className="flex items-center" style={{ paddingLeft: depth * 16 }}>
          <button
            type="button"
            onClick={() =>
              setOpen((s) => {
                const next = new Set(s);
                if (id && next.has(id)) next.delete(id);
                else if (id) next.add(id);
                return next;
              })
            }
            className={cn("p-1 text-neutral-400", (!kids.length || id === null) && "invisible")}
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-90")} />
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setTarget(id)}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1.5 text-left text-sm",
              target === id ? "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100" : "hover:bg-neutral-100 dark:hover:bg-neutral-800",
              disabled && "cursor-not-allowed opacity-40",
            )}
          >
            {target === id ? <FolderOpen className="h-4 w-4 shrink-0 text-sky-500" /> : <Folder className="h-4 w-4 shrink-0 text-sky-500" />}
            <span className="truncate">{f?.name ?? "My files"}</span>
          </button>
        </div>
        {expanded && kids.map((k) => row(k, depth + 1))}
      </div>
    );
  };

  return (
    <Dialog open onClose={onClose} title={`Move ${ids.length === 1 ? "item" : `${ids.length} items`} to…`}>
      <div className="max-h-[50vh] overflow-y-auto rounded-md border border-neutral-200 p-1 dark:border-neutral-800">
        {folders ? row(null, 0) : <p className="p-3 text-sm text-neutral-500">Loading folders…</p>}
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={busy || !folders}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await onMove(target);
              onClose();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Couldn't move that.");
              setBusy(false);
            }
          }}
        >
          Move here
        </Button>
      </div>
    </Dialog>
  );
}

const EXPIRY = [
  { label: "1 day", days: 1 },
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "Never", days: null },
] as const;

/** View-only link for a file or folder. */
export function ShareDialog({ item, onChange, onClose }: { item: DriveItem; onChange: (item: DriveItem) => void; onClose: () => void }) {
  const [current, setCurrent] = useState(item);
  const [days, setDays] = useState<1 | 7 | 30 | null>(7);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const link = current.shareToken ? `${window.location.origin}/s/${current.shareToken}` : null;
  const expired = current.shareExpiresAt ? new Date(current.shareExpiresAt) < new Date() : false;

  async function call(method: "POST" | "DELETE") {
    setBusy(true);
    setError(null);
    try {
      const r = await apiFetch<{ item: DriveItem }>(`/api/files/${current.id}/share`, {
        method,
        ...(method === "POST" ? { body: JSON.stringify({ expiresInDays: days }) } : {}),
      });
      setCurrent(r.item);
      onChange(r.item);
      setCopied(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title={`Share “${current.name}”`}>
      <div className="space-y-4">
        {link && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input readOnly value={link} onFocus={(e) => e.target.select()} className="min-w-0 flex-1 font-mono text-xs" />
              <Button
                variant="secondary"
                onClick={async () => {
                  await navigator.clipboard.writeText(link).catch(() => {});
                  setCopied(true);
                }}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className={cn("text-xs", expired ? "text-red-600" : "text-neutral-500")}>
              Anyone with this link can view and download{current.kind === "folder" ? " everything in this folder" : " this file"}.{" "}
              {current.shareExpiresAt
                ? `${expired ? "Expired" : "Expires"} ${new Date(current.shareExpiresAt).toLocaleString()}.`
                : "It doesn't expire."}
            </p>
          </div>
        )}
        <div className="space-y-2">
          <p className="text-sm font-medium">{link ? "Make a new link" : "Link expires after"}</p>
          <div className="flex flex-wrap gap-2">
            {EXPIRY.map((e) => (
              <button
                key={e.label}
                onClick={() => setDays(e.days)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs",
                  days === e.days ? "border-sky-500 bg-sky-50 text-sky-800 dark:bg-sky-950 dark:text-sky-200" : "border-neutral-200 dark:border-neutral-700",
                )}
              >
                {e.label}
              </button>
            ))}
          </div>
          {link && <p className="text-[11px] text-neutral-400">A new link replaces the old one — the old link stops working.</p>}
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          {link && (
            <Button variant="ghost" disabled={busy} onClick={() => call("DELETE")}>
              Stop sharing
            </Button>
          )}
          <Button disabled={busy} onClick={() => call("POST")}>
            <Link2 className="h-4 w-4" />
            {link ? "New link" : "Create link"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/** Full-screen preview with previous / next through the files in view. */
export function PreviewDialog({
  files,
  index,
  onIndex,
  onShare,
  onClose,
}: {
  files: DriveItem[];
  index: number;
  onIndex: (i: number) => void;
  onShare: (item: DriveItem) => void;
  onClose: () => void;
}) {
  const item = files[index];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
      if (e.key === "ArrowRight" && index < files.length - 1) onIndex(index + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, files.length, onIndex, onClose]);
  if (!item) return null;
  const category = fileCategory(item.name, item.contentType);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-950/95 text-white">
      <div className="flex items-center gap-2 px-3 py-2">
        <FileIcon category={category} className="h-5 w-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{item.name}</p>
          <p className="text-xs text-neutral-400">
            {formatBytes(item.size)} · {new Date(item.updatedAt).toLocaleDateString()}
            {files.length > 1 ? ` · ${index + 1} of ${files.length}` : ""}
          </p>
        </div>
        <a href={contentUrl(item.id, { download: true })} className="rounded p-2 hover:bg-white/10" aria-label="Download" title="Download">
          <Download className="h-5 w-5" />
        </a>
        <button onClick={() => onShare(item)} className="rounded p-2 hover:bg-white/10" aria-label="Share" title="Share">
          <Share2 className="h-5 w-5" />
        </button>
        <button onClick={onClose} className="rounded p-2 hover:bg-white/10" aria-label="Close" title="Close">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-2 sm:p-6">
        {index > 0 && (
          <button onClick={() => onIndex(index - 1)} className="absolute left-2 z-10 rounded-full bg-black/50 p-2 hover:bg-black/70" aria-label="Previous">
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        <PreviewBody key={item.id} item={item} />
        {index < files.length - 1 && (
          <button onClick={() => onIndex(index + 1)} className="absolute right-2 z-10 rounded-full bg-black/50 p-2 hover:bg-black/70" aria-label="Next">
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>
    </div>
  );
}

function PreviewBody({ item }: { item: DriveItem }) {
  const src = contentUrl(item.id);
  const category = fileCategory(item.name, item.contentType);
  if (!canPreview(item.name, item.contentType)) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <FileIcon category={category} className="h-16 w-16" />
        <p className="text-sm text-neutral-300">No preview for this kind of file.</p>
        <a href={contentUrl(item.id, { download: true })} className="rounded-md bg-white px-3 py-2 text-sm font-medium text-neutral-900">
          Download
        </a>
      </div>
    );
  }
  switch (category) {
    case "image":
      // eslint-disable-next-line @next/next/no-img-element -- presigned redirect URLs; next/image can't optimise them
      return <img src={src} alt={item.name} className="max-h-full max-w-full object-contain" />;
    case "video":
      return <video src={src} controls autoPlay className="max-h-full max-w-full" />;
    case "audio":
      return <audio src={src} controls autoPlay className="w-full max-w-lg" />;
    case "text":
      return <TextPreview src={src} />;
    default:
      return <iframe src={src} title={item.name} className="h-full w-full max-w-5xl rounded bg-white" />;
  }
}

function TextPreview({ src }: { src: string }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(src, { signal: controller.signal })
      .then((r) => (r.ok ? r.text() : Promise.reject()))
      .then((t) => setText(t.length > 1_000_000 ? `${t.slice(0, 1_000_000)}\n\n… (download to see the rest)` : t))
      .catch(() => setText("Couldn't load a preview — download the file to open it."));
    return () => controller.abort();
  }, [src]);
  return (
    <pre className="h-full w-full max-w-5xl overflow-auto whitespace-pre-wrap rounded bg-neutral-900 p-4 font-mono text-xs text-neutral-100">
      {text ?? "Loading…"}
    </pre>
  );
}
