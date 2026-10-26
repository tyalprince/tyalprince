import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Download, Folder } from "lucide-react";
import { resolveShare, sharedChildren, sharedItem, sharedTrail } from "@/lib/files/share";
import { canPreview, fileCategory, formatBytes } from "@/lib/files/names";
import { FileIcon } from "@/components/files/file-icon";

export const metadata = { title: "Shared file · Life OS", robots: { index: false } };

type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ folder?: string }> };

/** Public, view-only page for a shared file or folder. */
export default async function SharedPage({ params, searchParams }: Props) {
  const { token } = await params;
  const { folder: folderId } = await searchParams;
  const root = await resolveShare(token);
  if (!root) notFound();
  const item = await sharedItem(root, typeof folderId === "string" ? folderId : null);
  if (!item) notFound();
  const api = (id: string, extra = "") => `/api/files/share/${token}?item=${id}${extra}`;

  return (
    <div className="mx-auto w-full max-w-4xl p-4 sm:p-6">
      <p className="mb-4 text-xs uppercase tracking-wide text-neutral-500">Shared with you · view only</p>
      {item.kind === "file" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold">{item.name}</h1>
              <p className="text-sm text-neutral-500">{formatBytes(item.size)}</p>
            </div>
            <a
              href={api(item.id, "&download=1")}
              className="inline-flex items-center gap-2 rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
            >
              <Download className="h-4 w-4" />
              Download
            </a>
          </div>
          <Preview src={api(item.id)} name={item.name} contentType={item.contentType} />
        </div>
      ) : (
        <SharedFolder token={token} root={root} folder={item} api={api} />
      )}
    </div>
  );
}

async function SharedFolder({
  token,
  root,
  folder,
  api,
}: {
  token: string;
  root: NonNullable<Awaited<ReturnType<typeof resolveShare>>>;
  folder: NonNullable<Awaited<ReturnType<typeof resolveShare>>>;
  api: (id: string, extra?: string) => string;
}) {
  const [children, trail] = await Promise.all([sharedChildren(root, folder), sharedTrail(root, folder)]);
  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap items-center gap-1 text-lg font-semibold">
        {trail.map((f, i) => (
          <span key={f.id} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-4 w-4 text-neutral-400" />}
            {i < trail.length - 1 ? (
              <Link href={`/s/${token}${f.id === root.id ? "" : `?folder=${f.id}`}`} className="text-neutral-500 hover:underline">
                {f.name}
              </Link>
            ) : (
              <span>{f.name}</span>
            )}
          </span>
        ))}
      </nav>
      {children.length === 0 && <p className="text-sm text-neutral-500">This folder is empty.</p>}
      <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
        {children.map((c) => (
          <li key={c.id} className="flex items-center gap-3 px-3 py-2">
            {c.kind === "folder" ? (
              <Link href={`/s/${token}?folder=${c.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <Folder className="h-5 w-5 shrink-0 text-sky-500" />
                <span className="truncate text-sm">{c.name}</span>
              </Link>
            ) : (
              <>
                <a href={api(c.id)} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 items-center gap-3">
                  <FileIcon category={fileCategory(c.name, c.contentType)} className="h-5 w-5 shrink-0" />
                  <span className="truncate text-sm">{c.name}</span>
                </a>
                <span className="shrink-0 text-xs text-neutral-500">{formatBytes(c.size)}</span>
                <a href={api(c.id, "&download=1")} className="shrink-0 p-1 text-neutral-500" aria-label={`Download ${c.name}`}>
                  <Download className="h-4 w-4" />
                </a>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Preview({ src, name, contentType }: { src: string; name: string; contentType: string | null }) {
  if (!canPreview(name, contentType)) {
    return <p className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">No preview for this kind of file — download it to open.</p>;
  }
  switch (fileCategory(name, contentType)) {
    case "image":
      // eslint-disable-next-line @next/next/no-img-element -- presigned redirect URLs; next/image can't optimise them
      return <img src={src} alt={name} className="mx-auto max-h-[75vh] rounded-lg object-contain" />;
    case "video":
      return <video src={src} controls className="max-h-[75vh] w-full rounded-lg bg-black" />;
    case "audio":
      return <audio src={src} controls className="w-full" />;
    default:
      return <iframe src={src} title={name} className="h-[75vh] w-full rounded-lg border border-neutral-200 bg-white dark:border-neutral-800" />;
  }
}
