// Browser side of uploads: sends bytes straight to storage with the
// presigned URLs the API hands out, retrying each request on its own.

export type Picked = { file: File; relativePath?: string };

const JUNK = new Set([".ds_store", "thumbs.db", "desktop.ini"]);
export const isJunk = (name: string) => JUNK.has(name.toLowerCase()) || name.startsWith("._");

export class UploadCancelled extends Error {
  constructor() {
    super("Cancelled");
  }
}

/** PUT a blob with progress. Rejects on a non-2xx answer or network error. */
export function putBlob(
  url: string,
  body: Blob,
  opts: { contentType?: string; onProgress?: (loaded: number) => void; signal?: AbortSignal },
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (opts.signal?.aborted) return reject(new UploadCancelled());
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    if (opts.contentType) xhr.setRequestHeader("Content-Type", opts.contentType);
    xhr.upload.onprogress = (e) => opts.onProgress?.(e.loaded);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Storage answered ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.ontimeout = () => reject(new Error("Timed out"));
    const abort = () => {
      xhr.abort();
      reject(new UploadCancelled());
    };
    opts.signal?.addEventListener("abort", abort, { once: true });
    xhr.onloadend = () => opts.signal?.removeEventListener("abort", abort);
    xhr.send(body);
  });
}

/** Runs `fn` up to `attempts` times with growing pauses (1s, 3s, 9s…), unless cancelled. */
export async function withRetry<T>(fn: () => Promise<T>, signal?: AbortSignal, attempts = 5): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof UploadCancelled || signal?.aborted || i >= attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, 1000 * 3 ** i));
    }
  }
}

/** A small JPEG preview of an image (longest side 480px), or null if the browser can't decode it. */
export async function makeThumbnail(file: File): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 480 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.8));
  } catch {
    return null;
  }
}

/** Files (with their folder paths) from a drag and drop, walking into dropped folders. */
export async function filesFromDrop(data: DataTransfer): Promise<Picked[]> {
  const entries = [...data.items].map((i) => i.webkitGetAsEntry?.()).filter((e): e is FileSystemEntry => Boolean(e));
  if (!entries.length) return [...data.files].map((file) => ({ file }));
  const out: Picked[] = [];
  const walk = async (entry: FileSystemEntry, path: string): Promise<void> => {
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
      out.push({ file, relativePath: path ? `${path}/${file.name}` : undefined });
      return;
    }
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const dir = path ? `${path}/${entry.name}` : entry.name;
    // readEntries hands back at most ~100 at a time.
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
      if (!batch.length) break;
      for (const child of batch) await walk(child, dir);
    }
  };
  for (const entry of entries) await walk(entry, "");
  return out;
}

/** Files from an <input type=file> (with webkitdirectory, they carry their folder path). */
export function filesFromInput(list: FileList | null): Picked[] {
  return [...(list ?? [])].map((file) => ({ file, relativePath: file.webkitRelativePath || undefined }));
}
