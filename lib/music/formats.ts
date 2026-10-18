// Shared by the browser importer and the server (no Node-only imports here).

export const AUDIO_MIME: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  alac: "audio/mp4",
  aac: "audio/aac",
  flac: "audio/flac",
  wav: "audio/wav",
  ogg: "audio/ogg",
  opus: "audio/ogg",
  aif: "audio/aiff",
  aiff: "audio/aiff",
};

/** iTunes Store / Apple Music files protected by DRM — they can't be played outside Apple's apps. */
export const PROTECTED_EXTENSIONS = new Set(["m4p", "movpkg"]);

export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : "";
}

export function audioExtension(fileName: string): string | null {
  const ext = extensionOf(fileName);
  return ext in AUDIO_MIME ? ext : null;
}

export function audioMimeType(fileName: string, browserType?: string): string {
  return browserType || AUDIO_MIME[extensionOf(fileName)] || "application/octet-stream";
}
