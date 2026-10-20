"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { usePlayer } from "./player-context";
import {
  albumKeyOf,
  applyArtRecheck,
  applyLookup,
  nextArtRecheckCandidate,
  nextArtworkCandidate,
  nextDateCandidate,
} from "@/lib/music/album-art";
import type { PlaylistSummary, Track } from "@/lib/music/types";

// Apple's catalog allows roughly 20 searches a minute, and a lookup can take
// two (song, then album).
const ARTWORK_GAP_MS = 5000;
const RATE_LIMIT_PAUSE_MS = 60_000;
// MusicBrainz asks for at most one request a second.
const DATE_CHECK_GAP_MS = 1200;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Library = {
  tracks: Track[] | null;
  playlists: PlaylistSummary[];
  /** Generated mixes kept automatically (newest first), not yet saved as playlists. */
  history: PlaylistSummary[];
  storageConfigured: boolean | null;
  byId: Map<string, Track>;
  reload: () => void;
  reloadPlaylists: () => void;
  addTracks: (tracks: Track[]) => void;
  replaceTrack: (track: Track) => void;
  updateTrack: (id: string, changes: Partial<Track>) => Promise<void>;
  removeTrack: (id: string) => Promise<void>;
  /** Keeps one copy of each song and removes the others; returns how many were removed. */
  mergeDuplicates: (groups: { keepId: string; removeIds: string[] }[]) => Promise<number>;
  toggleLike: (track: Track) => Promise<void>;
  createPlaylist: (input: { name: string; trackIds: string[]; kind?: "manual" | "generated" | "history"; recipe?: Record<string, unknown>; description?: string }) => Promise<PlaylistSummary>;
  /** Saves a mix from history as a regular playlist. */
  keepMix: (id: string, name?: string) => Promise<void>;
  addToPlaylist: (playlistId: string, trackIds: string[]) => Promise<void>;
};

const LibraryContext = createContext<Library | null>(null);

export function useLibrary(): Library {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibrary must be used inside <LibraryProvider>");
  return ctx;
}

/** Loads the whole library once (a few thousand rows) so search, browsing and mix generation are instant. */
export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const player = usePlayer();
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [storageConfigured, setStorageConfigured] = useState<boolean | null>(null);

  const reload = useCallback(() => {
    apiFetch<{ tracks: Track[] }>("/api/music/tracks")
      .then((res) => setTracks(res.tracks))
      .catch(() => setTracks([]));
  }, []);

  const reloadPlaylists = useCallback(() => {
    apiFetch<{ playlists: PlaylistSummary[] }>("/api/music/playlists")
      .then((res) => setPlaylists(res.playlists))
      .catch(() => {});
  }, []);

  useEffect(() => {
    reload();
    reloadPlaylists();
    apiFetch<{ storageConfigured: boolean }>("/api/music/status")
      .then((res) => setStorageConfigured(res.storageConfigured))
      .catch(() => setStorageConfigured(false));
  }, [reload, reloadPlaylists]);

  const { updateTrack: updatePlayingTrack, updateTracks: updateQueuedTracks, onLookup } = player;

  // A looked-up song (art, release date, credits) and the album-mates it shares art with.
  const replaceTrack = useCallback(
    (track: Track) => {
      setTracks((prev) => (prev ? applyLookup(prev, track) : prev));
      updateQueuedTracks((queue) => applyLookup(queue, track));
    },
    [updateQueuedTracks],
  );

  const applyRecheck = useCallback(
    (track: Track) => {
      setTracks((prev) => (prev ? applyArtRecheck(prev, track) : prev));
      updateQueuedTracks((queue) => applyArtRecheck(queue, track));
    },
    [updateQueuedTracks],
  );

  // Songs looked up by the player on first play.
  useEffect(() => onLookup(replaceTrack), [onLookup, replaceTrack]);

  // Background cover-art fill while the Music tab is open: one song per album
  // that has no art, paced for Apple's limit. Results are saved, so it picks up
  // where it left off next time.
  const latest = useRef<Track[] | null>(null);
  useEffect(() => {
    latest.current = tracks;
  }, [tracks]);
  const loaded = tracks !== null;
  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;
    const tried = new Set<string>();
    (async () => {
      await sleep(2000);
      while (!cancelled) {
        // Missing covers first, then covers flagged for a re-check against their album.
        const missing = nextArtworkCandidate(latest.current ?? [], tried);
        const next = missing ?? nextArtRecheckCandidate(latest.current ?? [], tried);
        if (!next) return;
        tried.add(albumKeyOf(next));
        try {
          const res = await apiFetch<{ track: Track; retryLater?: boolean }>(
            missing ? `/api/music/tracks/${next.id}/enrich` : `/api/music/tracks/${next.id}/artwork-check`,
            missing ? { method: "POST", body: JSON.stringify({ artworkOnly: true }) } : { method: "POST" },
          );
          if (cancelled) return;
          if (missing) replaceTrack({ ...next, ...res.track });
          else if (!res.retryLater) applyRecheck({ ...next, ...res.track });
          if (res.retryLater) {
            tried.delete(albumKeyOf(next));
            await sleep(RATE_LIMIT_PAUSE_MS);
            continue;
          }
        } catch {
          // Skip this album for now; it's retried next visit.
        }
        await sleep(ARTWORK_GAP_MS);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loaded, replaceTrack, applyRecheck]);

  // Background release-date check: each song's original release date from
  // MusicBrainz, so remasters and compilations don't make old songs look new.
  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;
    const tried = new Set<string>();
    (async () => {
      await sleep(4000);
      while (!cancelled) {
        const next = nextDateCandidate(latest.current ?? [], tried);
        if (!next) return;
        tried.add(next.id);
        try {
          const res = await apiFetch<{ track: Track; retryLater?: boolean }>(`/api/music/tracks/${next.id}/release-date`, { method: "POST" });
          if (cancelled) return;
          if (res.retryLater) {
            tried.delete(next.id);
            await sleep(RATE_LIMIT_PAUSE_MS);
            continue;
          }
          replaceTrack({ ...next, ...res.track });
        } catch {
          // Skip for now; retried next visit.
        }
        await sleep(DATE_CHECK_GAP_MS);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loaded, replaceTrack]);

  const value = useMemo<Library>(() => {
    const byId = new Map((tracks ?? []).map((t) => [t.id, t]));
    const updateTrack = async (id: string, changes: Partial<Track>) => {
      const { track } = await apiFetch<{ track: Track }>(`/api/music/tracks/${id}`, {
        method: "PATCH",
        body: JSON.stringify(changes),
      });
      setTracks((prev) => prev?.map((t) => (t.id === id ? track : t)) ?? prev);
      updatePlayingTrack(track);
    };
    return {
      tracks,
      playlists: playlists.filter((p) => p.kind !== "history"),
      history: playlists.filter((p) => p.kind === "history").sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      storageConfigured,
      byId,
      reload,
      reloadPlaylists,
      addTracks: (added) => setTracks((prev) => [...(prev ?? []), ...added]),
      replaceTrack,
      updateTrack,
      removeTrack: async (id) => {
        await apiFetch(`/api/music/tracks/${id}`, { method: "DELETE" });
        setTracks((prev) => prev?.filter((t) => t.id !== id) ?? prev);
        reloadPlaylists();
      },
      mergeDuplicates: async (groups) => {
        let removed = 0;
        for (let i = 0; i < groups.length; i += 50) {
          const res = await apiFetch<{ removed: number }>("/api/music/tracks/merge", {
            method: "POST",
            body: JSON.stringify({ groups: groups.slice(i, i + 50) }),
          });
          removed += res.removed;
        }
        reload();
        reloadPlaylists();
        return removed;
      },
      toggleLike: async (track) => {
        await updateTrack(track.id, { liked: !track.liked });
      },
      createPlaylist: async (input) => {
        const { playlist } = await apiFetch<{ playlist: PlaylistSummary }>("/api/music/playlists", {
          method: "POST",
          body: JSON.stringify({ kind: "manual", ...input }),
        });
        reloadPlaylists();
        return playlist;
      },
      keepMix: async (id, name) => {
        await apiFetch(`/api/music/playlists/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ kind: "generated", ...(name?.trim() ? { name: name.trim() } : {}) }),
        });
        reloadPlaylists();
      },
      addToPlaylist: async (playlistId, trackIds) => {
        const { trackIds: existing } = await apiFetch<{ trackIds: string[] }>(`/api/music/playlists/${playlistId}`);
        await apiFetch(`/api/music/playlists/${playlistId}`, {
          method: "PATCH",
          body: JSON.stringify({ trackIds: [...existing, ...trackIds] }),
        });
        reloadPlaylists();
      },
    };
  }, [tracks, playlists, storageConfigured, reload, reloadPlaylists, updatePlayingTrack, replaceTrack]);

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}
