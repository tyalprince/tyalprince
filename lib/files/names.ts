// Pure helpers shared by the Files API and the browser.

const MB = 1024 * 1024;

/** Files above this go up in parts. */
export const MULTIPART_THRESHOLD = 64 * MB;
const MIN_PART = 16 * MB;
const MAX_PARTS = 10_000;
/** The bucket's per-object limit (R2/S3: just under 5 TiB). */
export const MAX_FILE_SIZE = 4.99 * 1024 * 1024 * MB;

/** How a file of this size is uploaded: one PUT, or parts of `partSize` bytes. */
export function partPlan(size: number): { multipart: boolean; partSize: number; count: number } {
  if (size <= MULTIPART_THRESHOLD) return { multipart: false, partSize: size, count: 1 };
  const partSize = Math.max(MIN_PART, Math.ceil(size / MAX_PARTS / MB) * MB);
  return { multipart: true, partSize, count: Math.ceil(size / partSize) };
}

/** A name that's safe to show and store: no slashes or control characters, not blank. */
export function cleanName(raw: string): string {
  const name = raw
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[/\\]/g, "-")
    .trim()
    .slice(0, 255);
  return name === "." || name === ".." || !name ? "Untitled" : name;
}

/** "report.pdf" → "report (1).pdf" when taken (case-insensitive), like a desktop drive. */
export function uniqueName(name: string, taken: Iterable<string>): string {
  const used = new Set([...taken].map((n) => n.toLowerCase()));
  if (!used.has(name.toLowerCase())) return name;
  const dot = name.lastIndexOf(".");
  const [stem, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ""];
  const base = stem.replace(/ \(\d+\)$/, "");
  for (let i = 1; ; i++) {
    const candidate = `${base} (${i})${ext}`;
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
}

/** "Trip/Day 1/IMG_1.jpg" → ["Trip", "Day 1"] (the folders to create), dropping empty and dot segments. */
export function folderPath(relativePath: string | undefined | null): string[] {
  if (!relativePath) return [];
  const parts = relativePath.split(/[/\\]/).filter((p) => p && p !== "." && p !== "..");
  return parts.slice(0, -1).map(cleanName);
}

export type FileCategory = "folder" | "image" | "video" | "audio" | "pdf" | "text" | "document" | "spreadsheet" | "presentation" | "archive" | "other";

const EXT: Record<string, FileCategory> = {
  jpg: "image", jpeg: "image", png: "image", gif: "image", webp: "image", heic: "image", heif: "image", avif: "image", bmp: "image", svg: "image", tif: "image", tiff: "image",
  mp4: "video", mov: "video", m4v: "video", webm: "video", mkv: "video", avi: "video",
  mp3: "audio", m4a: "audio", wav: "audio", flac: "audio", aac: "audio", ogg: "audio", aiff: "audio", aif: "audio",
  pdf: "pdf",
  txt: "text", md: "text", csv: "text", json: "text", log: "text", xml: "text", yml: "text", yaml: "text", html: "text", css: "text", js: "text", ts: "text", tsx: "text", py: "text", sql: "text",
  doc: "document", docx: "document", pages: "document", rtf: "document", odt: "document",
  xls: "spreadsheet", xlsx: "spreadsheet", numbers: "spreadsheet", ods: "spreadsheet",
  ppt: "presentation", pptx: "presentation", key: "presentation", odp: "presentation",
  zip: "archive", rar: "archive", "7z": "archive", tar: "archive", gz: "archive", dmg: "archive", iso: "archive",
};

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

export function fileCategory(name: string, contentType: string | null | undefined): FileCategory {
  const byExt = EXT[extensionOf(name)];
  if (byExt) return byExt;
  const type = contentType ?? "";
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";
  if (type === "application/pdf") return "pdf";
  if (type.startsWith("text/")) return "text";
  return "other";
}

/** Can the browser show this inline? (HEIC, MKV, Office files etc. can't be.) */
export function canPreview(name: string, contentType: string | null | undefined): boolean {
  const ext = extensionOf(name);
  switch (fileCategory(name, contentType)) {
    case "image":
      return !["heic", "heif", "tif", "tiff"].includes(ext);
    case "video":
      return ["mp4", "m4v", "webm", "mov"].includes(ext) || !ext;
    case "audio":
    case "pdf":
    case "text":
      return true;
    default:
      return false;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value >= 100 ? Math.round(value) : value.toFixed(1).replace(/\.0$/, "")} ${units[unit]}`;
}
