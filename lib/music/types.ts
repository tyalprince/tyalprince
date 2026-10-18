import type { AudioFeatures } from "@/lib/music/analysis";

/** A library track as the client receives it from GET /api/music/tracks. */
export type Track = {
  id: string;
  title: string;
  fileName: string;
  artist: string | null;
  albumArtist: string | null;
  album: string | null;
  genre: string | null;
  year: number | null;
  trackNumber: number | null;
  discNumber: number | null;
  durationSeconds: string | null;
  bitrate: number | null;
  mimeType: string;
  fileSize: number;
  artworkKey: string | null;
  features: AudioFeatures | null;
  featureVector: number[] | null;
  releaseDate: string | null;
  composer: string | null;
  lyricist: string | null;
  producer: string | null;
  label: string | null;
  copyright: string | null;
  enrichedAt: string | null;
  external: Record<string, string> | null;
  liked: boolean;
  playCount: number;
  lastPlayedAt: string | null;
  /** 0–100, 20 per star (iTunes scale); null = unrated. */
  rating: number | null;
  skipCount: number;
  /** When it entered the library in iTunes (null if added here). */
  addedAt: string | null;
  createdAt: string;
};

export type PlaylistSummary = {
  id: string;
  name: string;
  description: string | null;
  kind: "manual" | "generated";
  recipe: Record<string, unknown> | null;
  trackCount: number;
  createdAt: string;
  updatedAt: string;
};

/** Public URL (through the app, which redirects to storage) for a track's artwork. */
export function artworkUrl(artworkKey: string | null): string | null {
  if (!artworkKey) return null;
  return `/api/music/art/${artworkKey.split("/").pop()}`;
}

export function streamUrl(trackId: string): string {
  return `/api/music/tracks/${trackId}/stream`;
}

export function formatTime(seconds: number | string | null | undefined): string {
  const s = Math.max(0, Math.round(Number(seconds ?? 0)));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

export function displayArtist(t: Pick<Track, "artist" | "albumArtist">): string {
  return t.artist || t.albumArtist || "Unknown artist";
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${Math.round(bytes / 1e6)} MB`;
  return `${Math.max(1, Math.round(bytes / 1e3))} KB`;
}

/** "1998-03-24" → "Mar 24, 1998"; "1998" stays "1998". */
export function formatReleaseDate(value: string | null): string | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return value.slice(0, 4);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** "1 song", "2,807 songs". */
export function plural(n: number, word: string, many = `${word}s`): string {
  return `${n.toLocaleString()} ${n === 1 ? word : many}`;
}
