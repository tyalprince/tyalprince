import { parseReleaseDate } from "@/lib/music/metadata-sources";
import type { Track } from "@/lib/music/types";

// Jamendo (jamendo.com): free, Creative Commons-licensed music from independent
// artists. Shared mapping only — the API is called from lib/music/jamendo-server.ts.

export type JamendoTrack = {
  id: string;
  name: string;
  duration?: number;
  artist_name?: string;
  album_name?: string;
  releasedate?: string;
  image?: string;
  album_image?: string;
  audio?: string;
  audiodownload?: string;
  audiodownload_allowed?: boolean;
  shareurl?: string;
  license_ccurl?: string;
  musicinfo?: { tags?: { genres?: string[]; vartags?: string[] } };
};

export const JAMENDO_GENRES = [
  "pop",
  "hiphop",
  "rnb",
  "electronic",
  "rock",
  "jazz",
  "soul",
  "funk",
  "lounge",
  "chillout",
  "ambient",
  "classical",
  "soundtrack",
  "reggae",
  "latin",
  "metal",
  "world",
] as const;

const GENRE_LABELS: Record<string, string> = { hiphop: "Hip-Hop", rnb: "R&B", chillout: "Chill" };

export function genreLabel(tag: string): string {
  return GENRE_LABELS[tag] ?? tag.charAt(0).toUpperCase() + tag.slice(1);
}

/** "CC BY-NC-SA" from a Creative Commons license URL. */
export function licenseLabel(url: string | null | undefined): string | null {
  const m = /licenses\/([a-z-]+)\//i.exec(url ?? "");
  return m ? `CC ${m[1].toUpperCase()}` : null;
}

const httpsOnly = (u: string | undefined) => (u && /^https:\/\//.test(u) ? u : null);

/** A Jamendo result as a playable (not yet saved) track. */
export function fromJamendo(t: JamendoTrack): Track {
  const genre = t.musicinfo?.tags?.genres?.[0];
  const releaseDate = parseReleaseDate(t.releasedate);
  return {
    id: `jamendo:${t.id}`,
    title: t.name,
    fileName: `${t.name}.mp3`,
    artist: t.artist_name ?? null,
    albumArtist: null,
    album: t.album_name || null,
    genre: genre ? genreLabel(genre) : null,
    year: releaseDate ? Number(releaseDate.slice(0, 4)) : null,
    trackNumber: null,
    discNumber: null,
    durationSeconds: t.duration ? String(t.duration) : null,
    bitrate: null,
    mimeType: "audio/mpeg",
    fileSize: 0,
    artworkKey: null,
    features: null,
    featureVector: null,
    releaseDate,
    composer: null,
    lyricist: null,
    producer: null,
    label: null,
    copyright: null,
    enrichedAt: null,
    external: null,
    liked: false,
    playCount: 0,
    lastPlayedAt: null,
    rating: null,
    skipCount: 0,
    addedAt: null,
    createdAt: new Date(0).toISOString(),
    remote: {
      source: "jamendo",
      jamendoId: t.id,
      audioUrl: httpsOnly(t.audio) ?? "",
      imageUrl: httpsOnly(t.image) ?? httpsOnly(t.album_image),
      pageUrl: httpsOnly(t.shareurl),
      license: licenseLabel(t.license_ccurl),
      licenseUrl: httpsOnly(t.license_ccurl),
      downloadable: Boolean(t.audiodownload_allowed),
    },
  };
}

export type ExploreView = "trending" | "new" | "genre" | "search";
