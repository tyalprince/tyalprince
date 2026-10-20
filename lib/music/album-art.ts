import type { Track } from "@/lib/music/types";

// Client-side helpers for album-level details (cover art, release date),
// mirroring how lib/music/enrich.ts shares them between songs on one album.

/** The album's artist, as the server matches it: album artist, else the song's artist. */
function albumArtistOf(t: Track): string | null {
  return t.albumArtist || t.artist;
}

/** Stable key for "this song's album" (songs without an album are their own group). */
export function albumKeyOf(t: Track): string {
  return t.album ? `${(albumArtistOf(t) ?? "").toLowerCase()}|${t.album.toLowerCase()}` : `track:${t.id}`;
}

function sameAlbum(a: Track, b: Track): boolean {
  if (!a.album || a.album !== b.album) return false;
  const artist = albumArtistOf(a);
  return !artist || (b.albumArtist ? b.albumArtist === artist : b.artist === artist);
}

/**
 * Applies a freshly looked-up track to the list, and gives its album art and
 * release date to album-mates that have none (the server does the same).
 */
export function applyLookup(tracks: Track[], updated: Track): Track[] {
  const next = tracks.map((t) => {
    if (t.id === updated.id) return { ...t, ...updated };
    if (!sameAlbum(updated, t)) return t;
    const art = !t.artworkKey && updated.artworkKey ? updated.artworkKey : t.artworkKey;
    const date = !t.releaseDate && updated.releaseDate ? updated.releaseDate : t.releaseDate;
    const checked = updated.external?.itunesChecked && !t.external?.itunesChecked;
    if (art === t.artworkKey && date === t.releaseDate && !checked) return t;
    return {
      ...t,
      artworkKey: art,
      releaseDate: date,
      external: checked ? { ...(t.external ?? {}), itunesChecked: "1" } : t.external,
    };
  });
  // Same array back when nothing changed, so React can skip the update.
  return next.some((t, i) => t !== tracks[i]) ? next : tracks;
}

/** Next song whose album still needs cover art looked up, one per album; null when done. */
export function nextArtworkCandidate(tracks: Track[], tried: Set<string>): Track | null {
  for (const t of tracks) {
    if (t.artworkKey || t.enrichedAt || t.external?.itunesChecked) continue;
    if (!tried.has(albumKeyOf(t))) return t;
  }
  return null;
}

/**
 * Next song whose release date hasn't been checked against MusicBrainz yet.
 * Songs whose looked-up date is well after their file's year tag (likely a
 * reissue date) go first.
 */
export function nextDateCandidate(tracks: Track[], tried: Set<string>): Track | null {
  let fallback: Track | null = null;
  for (const t of tracks) {
    if (t.remote || t.external?.mbDateChecked || tried.has(t.id) || !(t.artist || t.albumArtist)) continue;
    const looked = t.releaseDate ? Number(t.releaseDate.slice(0, 4)) : null;
    if (looked && t.year && looked > t.year + 1) return t;
    fallback ??= t;
  }
  return fallback;
}

/** Next song (one per album) whose cover is flagged for a re-check against its album. */
export function nextArtRecheckCandidate(tracks: Track[], tried: Set<string>): Track | null {
  for (const t of tracks) {
    if (!t.external?.artRecheck || tried.has(albumKeyOf(t))) continue;
    return t;
  }
  return null;
}

/** After a cover re-check: the album's flagged songs take the checked cover, and the flags clear. */
export function applyArtRecheck(tracks: Track[], updated: Track): Track[] {
  const next = tracks.map((t) => {
    if (t.id === updated.id) return { ...t, ...updated };
    if (!sameAlbum(updated, t) || !t.external?.artRecheck) return t;
    const rest = { ...t.external };
    delete rest.artRecheck;
    return { ...t, artworkKey: updated.artworkKey ?? t.artworkKey, external: rest };
  });
  return next.some((t, i) => t !== tracks[i]) ? next : tracks;
}
