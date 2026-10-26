"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowDownUp,
  ChevronRight,
  Clock,
  Download,
  FileUp,
  FolderInput,
  FolderPlus,
  FolderUp,
  HardDrive,
  Image as ImageIcon,
  LayoutGrid,
  List,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Share2,
  Star,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { fileCategory, formatBytes } from "@/lib/files/names";
import { filesFromDrop, filesFromInput } from "@/lib/files/upload-client";
import { contentUrl, thumbnailUrl, type DriveItem, type DriveView, type Usage } from "@/lib/files/types";
import { FileIcon } from "./file-icon";
import { MoveDialog, NameDialog, PreviewDialog, ShareDialog } from "./dialogs";
import { UploadPanel, useUploads } from "./uploads";

const VIEWS: { id: DriveView; label: string; icon: typeof HardDrive }[] = [
  { id: "files", label: "My files", icon: HardDrive },
  { id: "recent", label: "Recent", icon: Clock },
  { id: "photos", label: "Photos", icon: ImageIcon },
  { id: "shared", label: "Shared", icon: Users },
  { id: "starred", label: "Starred", icon: Star },
  { id: "trash", label: "Recycle bin", icon: Trash2 },
];

type Sort = { by: "name" | "modified" | "size"; desc: boolean };
type Dialogs =
  | { type: "new-folder" }
  | { type: "rename"; item: DriveItem }
  | { type: "move"; ids: string[] }
  | { type: "share"; item: DriveItem }
  | { type: "preview"; index: number }
  | null;

const EMPTY = new Set<string>();

function readPref<T extends string>(key: string, fallback: T, allowed: readonly T[]): T {
  try {
    const v = localStorage.getItem(key) as T | null;
    return v && allowed.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

/** A personal drive: folders, uploads of any size, previews, sharing, recycle bin. */
export function FilesApp() {
  const params = useSearchParams();
  const view = (VIEWS.some((v) => v.id === params.get("view")) ? params.get("view") : "files") as DriveView;
  const folderId = view === "files" ? params.get("folder") : null;

  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const at = search ? `q:${search}` : view === "files" ? `f:${folderId ?? ""}` : `v:${view}`;

  const [data, setData] = useState<{ at: string; items: DriveItem[]; crumbs: { id: string; name: string }[] } | null>(null);
  const [error, setError] = useState<{ at: string; message: string } | null>(null);
  const [configured, setConfigured] = useState(true);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [tick, setTick] = useState(0);
  const [selection, setSelection] = useState<{ at: string; ids: Set<string> }>({ at, ids: EMPTY });
  const [layout, setLayoutState] = useState<"list" | "grid">("list");
  const [sort, setSort] = useState<Sort>({ by: "name", desc: false });
  const [dialog, setDialog] = useState<Dialogs>(null);
  const [menu, setMenu] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const folderInput = useRef<HTMLInputElement | null>(null);

  const items = data?.at === at ? data.items : null;
  const crumbs = data?.at === at ? data.crumbs : [];
  const selected = selection.at === at ? selection.ids : EMPTY;
  const loadError = error?.at === at ? error.message : null;

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const uploads = useUploads(reload);

  // Remembered per browser: list or grid.
  useEffect(() => {
    const timer = setTimeout(() => setLayoutState(readPref("lifeos.files.layout", "list", ["list", "grid"] as const)), 0);
    return () => clearTimeout(timer);
  }, []);
  const setLayout = (l: "list" | "grid") => {
    setLayoutState(l);
    try {
      localStorage.setItem("lifeos.files.layout", l);
    } catch {}
  };

  // Search as you type (debounced).
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    const url = search
      ? `/api/files?q=${encodeURIComponent(search)}`
      : view === "files"
        ? `/api/files${folderId ? `?folder=${folderId}` : ""}`
        : `/api/files?view=${view}`;
    apiFetch<{ items: DriveItem[]; breadcrumbs?: { id: string; name: string }[]; configured: boolean }>(url, { signal: controller.signal })
      .then((r) => {
        setData({ at, items: r.items, crumbs: r.breadcrumbs ?? [] });
        setConfigured(r.configured);
        setError(null);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError({ at, message: err instanceof Error ? err.message : "Couldn't load your files." });
      });
    return () => controller.abort();
  }, [at, search, view, folderId, tick]);

  useEffect(() => {
    apiFetch<{ usage: Usage }>("/api/files/usage")
      .then((r) => setUsage(r.usage))
      .catch(() => {});
  }, [tick]);

  const go = useCallback((next: { view?: DriveView; folder?: string | null }) => {
    const sp = new URLSearchParams();
    if (next.view && next.view !== "files") sp.set("view", next.view);
    if (next.folder) sp.set("folder", next.folder);
    window.history.pushState(null, "", `/files${sp.size ? `?${sp}` : ""}`);
    setQuery("");
    setSearch("");
  }, []);

  const sorted = useMemo(() => {
    if (!items) return null;
    // Recent, photos and the bin keep the server's (newest first) order unless re-sorted.
    const list = [...items];
    const dir = sort.desc ? -1 : 1;
    list.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
      if (sort.by === "size") return (a.size - b.size) * dir || a.name.localeCompare(b.name);
      if (sort.by === "modified") return (Date.parse(a.updatedAt) - Date.parse(b.updatedAt)) * dir;
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }) * dir;
    });
    return list;
  }, [items, sort]);
  const files = useMemo(() => (sorted ?? []).filter((i) => i.kind === "file"), [sorted]);
  const chosen = useMemo(() => (sorted ?? []).filter((i) => selected.has(i.id)), [sorted, selected]);

  const toggle = (id: string) =>
    setSelection(() => {
      const next = new Set(selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { at, ids: next };
    });
  const clearSelection = () => setSelection({ at, ids: EMPTY });

  const open = (item: DriveItem) => {
    if (view === "trash") return toggle(item.id);
    if (item.kind === "folder") go({ folder: item.id });
    else setDialog({ type: "preview", index: files.findIndex((f) => f.id === item.id) });
  };

  async function batch(action: string, ids: string[], extra: Record<string, unknown> = {}) {
    setNotice(null);
    try {
      await apiFetch("/api/files/batch", { method: "POST", body: JSON.stringify({ action, ids, ...extra }) });
      clearSelection();
      reload();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "That didn't work.");
    }
  }

  const updateItem = (item: DriveItem) =>
    setData((d) => (d ? { ...d, items: d.items.map((i) => (i.id === item.id ? { ...i, ...item } : i)) } : d));

  const uploadInto = view === "files" && !search ? folderId : null;
  const startUpload = (picked: Parameters<typeof uploads.upload>[0]) => {
    if (!picked.length) return;
    uploads.upload(picked, uploadInto);
    if (view !== "files" || search) {
      setNotice("Uploading to My files.");
    }
  };

  const title = search ? `Results for “${search}”` : VIEWS.find((v) => v.id === view)!.label;
  const allStarred = chosen.length > 0 && chosen.every((i) => i.starred);

  return (
    <div
      className="relative mx-auto flex max-w-6xl gap-6 p-4 sm:p-6"
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files") || !configured) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
      }}
      onDrop={async (e) => {
        if (!e.dataTransfer.types.includes("Files") || !configured) return;
        e.preventDefault();
        setDragging(false);
        startUpload(await filesFromDrop(e.dataTransfer));
      }}
    >
      {/* Side navigation (desktop) */}
      <aside className="hidden w-52 shrink-0 md:block">
        <nav className="space-y-0.5">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => go({ view: v.id })}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm",
                view === v.id && !search ? "bg-sky-50 font-medium text-sky-900 dark:bg-sky-950/50 dark:text-sky-100" : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800",
              )}
            >
              <v.icon className="h-4 w-4" />
              {v.label}
            </button>
          ))}
        </nav>
        {usage && <UsageMeter usage={usage} className="mt-6" />}
      </aside>

      <div className="min-w-0 flex-1 space-y-4">
        {/* Views (mobile) */}
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 md:hidden">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => go({ view: v.id })}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs",
                view === v.id && !search ? "border-sky-500 bg-sky-50 text-sky-900 dark:bg-sky-950 dark:text-sky-100" : "border-neutral-200 text-neutral-600 dark:border-neutral-700 dark:text-neutral-300",
              )}
            >
              <v.icon className="h-3.5 w-3.5" />
              {v.label}
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Button onClick={() => setMenu((m) => !m)} disabled={!configured}>
              <Plus className="h-4 w-4" />
              New
            </Button>
            {menu && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setMenu(false)} aria-hidden />
                <div className="absolute left-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
                  {[
                    { id: "folder", label: "Folder", icon: FolderPlus, hide: view !== "files" || Boolean(search) },
                    { id: "files", label: "Upload files", icon: FileUp },
                    { id: "dir", label: "Upload folder", icon: FolderUp },
                  ]
                    .filter((m) => !m.hide)
                    .map((m) => (
                      <button
                        key={m.id}
                        onClick={() => {
                          setMenu(false);
                          if (m.id === "folder") setDialog({ type: "new-folder" });
                          else (m.id === "dir" ? folderInput : fileInput).current?.click();
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      >
                        <m.icon className="h-4 w-4 text-neutral-500" />
                        {m.label}
                      </button>
                    ))}
                </div>
              </>
            )}
          </div>
          <input
            ref={fileInput}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              startUpload(filesFromInput(e.target.files));
              e.target.value = "";
            }}
          />
          <input
            ref={(el) => {
              folderInput.current = el;
              el?.setAttribute("webkitdirectory", "");
            }}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              startUpload(filesFromInput(e.target.files));
              e.target.value = "";
            }}
          />
          <label className="relative min-w-0 flex-1 basis-48">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search everything"
              className="w-full rounded-md border border-neutral-300 bg-white py-2 pl-8 pr-8 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900"
            />
            {query && (
              <button onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400" aria-label="Clear search">
                <X className="h-4 w-4" />
              </button>
            )}
          </label>
          <SortMenu sort={sort} onSort={setSort} />
          <div className="flex rounded-md border border-neutral-200 dark:border-neutral-700">
            <button onClick={() => setLayout("list")} className={cn("p-2", layout === "list" && "bg-neutral-100 dark:bg-neutral-800")} aria-label="List view">
              <List className="h-4 w-4" />
            </button>
            <button onClick={() => setLayout("grid")} className={cn("p-2", layout === "grid" && "bg-neutral-100 dark:bg-neutral-800")} aria-label="Grid view">
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>

        {!configured && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950/40">
            File storage isn&apos;t set up. Files uses the same bucket as Music — set <code>MUSIC_STORAGE_*</code> in Vercel and redeploy.
          </div>
        )}

        {/* Title / breadcrumbs, or the selection bar */}
        {chosen.length ? (
          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-sky-50 px-2 py-1.5 text-sm dark:bg-sky-950/40">
            <button onClick={clearSelection} className="rounded p-1.5 hover:bg-sky-100 dark:hover:bg-sky-900" aria-label="Clear selection">
              <X className="h-4 w-4" />
            </button>
            <span className="mr-2 font-medium">{chosen.length} selected</span>
            {view === "trash" ? (
              <>
                <BarButton icon={RotateCcw} label="Restore" onClick={() => batch("restore", [...selected])} />
                <BarButton
                  icon={Trash2}
                  label="Delete forever"
                  danger
                  onClick={() => {
                    if (confirm(`Delete ${chosen.length === 1 ? `“${chosen[0].name}”` : `${chosen.length} items`} forever? This can't be undone.`)) batch("delete", [...selected]);
                  }}
                />
              </>
            ) : (
              <>
                {chosen.length === 1 && chosen[0].kind === "file" && (
                  <BarButton icon={Download} label="Download" href={contentUrl(chosen[0].id, { download: true })} />
                )}
                {chosen.length > 1 && chosen.every((i) => i.kind === "file") && (
                  <BarButton
                    icon={Download}
                    label="Download"
                    onClick={() => chosen.forEach((f, i) => setTimeout(() => window.open(contentUrl(f.id, { download: true }), "_blank"), i * 400))}
                  />
                )}
                {chosen.length === 1 && <BarButton icon={Share2} label="Share" onClick={() => setDialog({ type: "share", item: chosen[0] })} />}
                {chosen.length === 1 && <BarButton icon={Pencil} label="Rename" onClick={() => setDialog({ type: "rename", item: chosen[0] })} />}
                <BarButton icon={FolderInput} label="Move" onClick={() => setDialog({ type: "move", ids: [...selected] })} />
                <BarButton icon={Star} label={allStarred ? "Unstar" : "Star"} onClick={() => batch(allStarred ? "unstar" : "star", [...selected])} />
                <BarButton icon={Trash2} label="Delete" danger onClick={() => batch("trash", [...selected])} />
              </>
            )}
          </div>
        ) : (
          <div className="flex min-h-9 flex-wrap items-center gap-1 text-lg font-semibold">
            {view === "files" && !search ? (
              <>
                <button onClick={() => go({})} className={cn(crumbs.length && "text-neutral-500 hover:underline")}>
                  My files
                </button>
                {crumbs.map((c, i) => (
                  <span key={c.id} className="flex min-w-0 items-center gap-1">
                    <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" />
                    {i < crumbs.length - 1 ? (
                      <button onClick={() => go({ folder: c.id })} className="truncate text-neutral-500 hover:underline">
                        {c.name}
                      </button>
                    ) : (
                      <span className="truncate">{c.name}</span>
                    )}
                  </span>
                ))}
              </>
            ) : (
              <span>{title}</span>
            )}
            {view === "trash" && !search && (sorted?.length ?? 0) > 0 && (
              <Button
                variant="ghost"
                className="ml-auto text-sm font-normal text-red-600"
                onClick={() => {
                  if (confirm("Empty the recycle bin? Everything in it is deleted forever.")) batch("delete", (sorted ?? []).map((i) => i.id));
                }}
              >
                Empty recycle bin
              </Button>
            )}
          </div>
        )}
        {view === "trash" && !search && <p className="-mt-2 text-xs text-neutral-500">Items in the recycle bin are deleted forever after 30 days.</p>}
        {notice && <p className="text-sm text-amber-700 dark:text-amber-400">{notice}</p>}
        {loadError && <p className="text-sm text-red-600">{loadError}</p>}

        {/* Items */}
        {!sorted ? (
          !loadError && <p className="py-12 text-center text-sm text-neutral-500">Loading…</p>
        ) : sorted.length === 0 ? (
          <EmptyState view={search ? "search" : view} onUpload={() => fileInput.current?.click()} canUpload={configured} />
        ) : layout === "grid" ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {sorted.map((item) => (
              <li key={item.id}>
                <GridCard item={item} selected={selected.has(item.id)} onToggle={() => toggle(item.id)} onOpen={() => open(item)} />
              </li>
            ))}
          </ul>
        ) : (
          <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {sorted.map((item) => (
              <ListRow
                key={item.id}
                item={item}
                showPath={view !== "files" || Boolean(search)}
                selected={selected.has(item.id)}
                onToggle={() => toggle(item.id)}
                onOpen={() => open(item)}
                onMenu={() => setSelection({ at, ids: new Set([item.id]) })}
              />
            ))}
          </ul>
        )}
        {usage && <UsageMeter usage={usage} className="md:hidden" />}
      </div>

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-sky-500/10 p-6">
          <div className="rounded-2xl border-2 border-dashed border-sky-500 bg-white/90 px-8 py-6 text-center shadow-xl dark:bg-neutral-900/90">
            <FolderUp className="mx-auto mb-2 h-8 w-8 text-sky-500" />
            <p className="font-medium">Drop to upload</p>
            <p className="text-xs text-neutral-500">Files and whole folders, any size</p>
          </div>
        </div>
      )}

      <UploadPanel uploads={uploads} />

      {dialog?.type === "new-folder" && (
        <NameDialog
          title="New folder"
          initial="New folder"
          action="Create"
          onClose={() => setDialog(null)}
          onSubmit={async (name) => {
            await apiFetch("/api/files/folders", { method: "POST", body: JSON.stringify({ parentId: folderId, name }) });
            reload();
          }}
        />
      )}
      {dialog?.type === "rename" && (
        <NameDialog
          title="Rename"
          initial={dialog.item.name}
          action="Rename"
          onClose={() => setDialog(null)}
          onSubmit={async (name) => {
            const r = await apiFetch<{ item: DriveItem }>(`/api/files/${dialog.item.id}`, { method: "PATCH", body: JSON.stringify({ name }) });
            updateItem(r.item);
            clearSelection();
          }}
        />
      )}
      {dialog?.type === "move" && (
        <MoveDialog
          ids={dialog.ids}
          onClose={() => setDialog(null)}
          onMove={async (parentId) => {
            await apiFetch("/api/files/batch", { method: "POST", body: JSON.stringify({ action: "move", ids: dialog.ids, parentId }) });
            clearSelection();
            reload();
          }}
        />
      )}
      {dialog?.type === "share" && <ShareDialog item={dialog.item} onChange={updateItem} onClose={() => setDialog(null)} />}
      {dialog?.type === "preview" && (
        <PreviewDialog
          files={files}
          index={dialog.index}
          onIndex={(index) => setDialog({ type: "preview", index })}
          onShare={(item) => setDialog({ type: "share", item })}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}

function BarButton({
  icon: Icon,
  label,
  onClick,
  href,
  danger,
}: {
  icon: typeof Star;
  label: string;
  onClick?: () => void;
  href?: string;
  danger?: boolean;
}) {
  const className = cn(
    "flex items-center gap-1.5 rounded px-2 py-1.5 text-sm hover:bg-sky-100 dark:hover:bg-sky-900",
    danger && "text-red-600 dark:text-red-400",
  );
  return href ? (
    <a href={href} className={className}>
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </a>
  ) : (
    <button onClick={onClick} className={className} title={label}>
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function SortMenu({ sort, onSort }: { sort: Sort; onSort: (s: Sort) => void }) {
  return (
    <label className="flex items-center gap-1 rounded-md border border-neutral-200 px-2 text-sm dark:border-neutral-700">
      <ArrowDownUp className="h-4 w-4 text-neutral-400" />
      <select
        value={`${sort.by}:${sort.desc ? "desc" : "asc"}`}
        onChange={(e) => {
          const [by, dir] = e.target.value.split(":");
          onSort({ by: by as Sort["by"], desc: dir === "desc" });
        }}
        className="bg-transparent py-2 outline-none"
        aria-label="Sort"
      >
        <option value="name:asc">Name A–Z</option>
        <option value="name:desc">Name Z–A</option>
        <option value="modified:desc">Newest</option>
        <option value="modified:asc">Oldest</option>
        <option value="size:desc">Largest</option>
        <option value="size:asc">Smallest</option>
      </select>
    </label>
  );
}

function Thumb({ item, className }: { item: DriveItem; className?: string }) {
  if (item.kind === "file" && item.hasThumbnail) {
    // eslint-disable-next-line @next/next/no-img-element -- presigned redirect URLs; next/image can't optimise them
    return <img src={thumbnailUrl(item.id)} alt="" loading="lazy" className={cn("object-cover", className)} />;
  }
  return <FileIcon category={item.kind === "folder" ? "folder" : fileCategory(item.name, item.contentType)} className={className} />;
}

function subtitle(item: DriveItem) {
  return item.kind === "folder" ? `${item.childCount ?? 0} item${item.childCount === 1 ? "" : "s"}` : formatBytes(item.size);
}

function ListRow({
  item,
  showPath,
  selected,
  onToggle,
  onOpen,
  onMenu,
}: {
  item: DriveItem;
  showPath: boolean;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onMenu: () => void;
}) {
  return (
    <li className={cn("group flex items-center gap-3 px-3 py-2", selected ? "bg-sky-50 dark:bg-sky-950/30" : "hover:bg-neutral-50 dark:hover:bg-neutral-900")}>
      <input type="checkbox" checked={selected} onChange={onToggle} className="h-4 w-4 shrink-0" aria-label={`Select ${item.name}`} />
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded">
          <Thumb item={item} className={item.hasThumbnail ? "h-9 w-9 rounded" : "h-6 w-6"} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm">{item.name}</span>
            {item.starred && <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />}
            {item.shareToken && <Users className="h-3.5 w-3.5 shrink-0 text-sky-500" />}
          </span>
          <span className="block truncate text-xs text-neutral-500">
            {showPath && item.path ? `${item.path} · ` : ""}
            <span className="sm:hidden">{subtitle(item)} · </span>
            {new Date(item.trashedAt ?? item.updatedAt).toLocaleDateString()}
          </span>
        </span>
      </button>
      <span className="hidden w-20 shrink-0 text-right text-xs text-neutral-500 sm:block">{subtitle(item)}</span>
      <button onClick={onMenu} className="shrink-0 rounded p-1 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800" aria-label={`Actions for ${item.name}`}>
        <MoreHorizontal className="h-4 w-4" />
      </button>
    </li>
  );
}

function GridCard({ item, selected, onToggle, onOpen }: { item: DriveItem; selected: boolean; onToggle: () => void; onOpen: () => void }) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border",
        selected ? "border-sky-500 ring-2 ring-sky-500/30" : "border-neutral-200 hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700",
      )}
    >
      <button onClick={onOpen} className="block w-full text-left">
        <span className="flex aspect-[4/3] items-center justify-center bg-neutral-50 dark:bg-neutral-900">
          <Thumb item={item} className={item.hasThumbnail ? "h-full w-full" : "h-12 w-12"} />
        </span>
        <span className="block p-2">
          <span className="block truncate text-sm">{item.name}</span>
          <span className="block text-xs text-neutral-500">{subtitle(item)}</span>
        </span>
      </button>
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className={cn("absolute left-2 top-2 h-4 w-4", !selected && "opacity-0 group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100")}
        aria-label={`Select ${item.name}`}
      />
      {item.starred && <Star className="absolute right-2 top-2 h-4 w-4 fill-amber-400 text-amber-400" />}
    </div>
  );
}

function EmptyState({ view, onUpload, canUpload }: { view: DriveView | "search"; onUpload: () => void; canUpload: boolean }) {
  const text: Record<DriveView | "search", string> = {
    files: "Nothing here yet. Drop files or folders anywhere on this page, or use New → Upload.",
    recent: "Files you add or change show up here.",
    photos: "Photos and videos you upload show up here.",
    shared: "Files and folders you share with a link show up here.",
    starred: "Star files and folders to find them fast.",
    trash: "The recycle bin is empty.",
    search: "Nothing matches that name.",
  };
  return (
    <div className="rounded-lg border border-dashed border-neutral-300 px-6 py-14 text-center dark:border-neutral-700">
      <p className="text-sm text-neutral-500">{text[view]}</p>
      {view === "files" && canUpload && (
        <Button className="mt-4" variant="secondary" onClick={onUpload}>
          <FileUp className="h-4 w-4" />
          Upload files
        </Button>
      )}
    </div>
  );
}

const CATEGORY_COLORS: Record<string, string> = {
  photos: "bg-pink-500",
  videos: "bg-violet-500",
  documents: "bg-blue-500",
  audio: "bg-indigo-500",
  other: "bg-neutral-400",
};

export function UsageMeter({ usage, className }: { usage: Usage; className?: string }) {
  const total = usage.totalBytes || 1;
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium">Storage</span>
        <span className="text-neutral-500">{formatBytes(usage.totalBytes)} used</span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
        {usage.byCategory.map((c) => (
          <div key={c.category} className={CATEGORY_COLORS[c.category] ?? "bg-neutral-400"} style={{ width: `${(c.bytes / total) * 100}%` }} />
        ))}
        {usage.trashBytes > 0 && <div className="bg-neutral-300 dark:bg-neutral-600" style={{ width: `${(usage.trashBytes / total) * 100}%` }} />}
      </div>
      <ul className="space-y-1 text-xs text-neutral-500">
        {usage.byCategory.map((c) => (
          <li key={c.category} className="flex items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full", CATEGORY_COLORS[c.category] ?? "bg-neutral-400")} />
            <span className="flex-1 capitalize">{c.category}</span>
            <span>{formatBytes(c.bytes)}</span>
          </li>
        ))}
        {usage.trashBytes > 0 && (
          <li className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-neutral-300 dark:bg-neutral-600" />
            <span className="flex-1">Recycle bin</span>
            <span>{formatBytes(usage.trashBytes)}</span>
          </li>
        )}
      </ul>
      <p className="text-[11px] text-neutral-400">
        {usage.fileCount.toLocaleString()} files · {usage.folderCount.toLocaleString()} folders
      </p>
    </div>
  );
}
