"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { usePlayer } from "./player-context";
import type { PlaylistSummary, Track } from "@/lib/music/types";

type Library = {
  tracks: Track[] | null;
  playlists: PlaylistSummary[];
  storageConfigured: boolean | null;
  byId: Map<string, Track>;
  reload: () => void;
  reloadPlaylists: () => void;
  addTracks: (tracks: Track[]) => void;
  replaceTrack: (track: Track) => void;
  updateTrack: (id: string, changes: Partial<Track>) => Promise<void>;
  removeTrack: (id: string) => Promise<void>;
  toggleLike: (track: Track) => Promise<void>;
  createPlaylist: (input: { name: string; trackIds: string[]; kind?: "manual" | "generated"; recipe?: Record<string, unknown>; description?: string }) => Promise<PlaylistSummary>;
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

  const { updateTrack: updatePlayingTrack, current: playing } = player;

  // The player enriches songs as they play (art, release date, credits);
  // overlay the playing song's fresher copy onto the library list.
  const merged = useMemo(() => {
    if (!tracks || !playing?.enrichedAt) return tracks;
    return tracks.map((t) => (t.id === playing.id && t.enrichedAt !== playing.enrichedAt ? { ...t, ...playing } : t));
  }, [tracks, playing]);
  const value = useMemo<Library>(() => {
    const byId = new Map((merged ?? []).map((t) => [t.id, t]));
    const updateTrack = async (id: string, changes: Partial<Track>) => {
      const { track } = await apiFetch<{ track: Track }>(`/api/music/tracks/${id}`, {
        method: "PATCH",
        body: JSON.stringify(changes),
      });
      setTracks((prev) => prev?.map((t) => (t.id === id ? track : t)) ?? prev);
      updatePlayingTrack(track);
    };
    return {
      tracks: merged,
      playlists,
      storageConfigured,
      byId,
      reload,
      reloadPlaylists,
      addTracks: (added) => setTracks((prev) => [...(prev ?? []), ...added]),
      replaceTrack: (track) => {
        setTracks((prev) => prev?.map((t) => (t.id === track.id ? { ...t, ...track } : t)) ?? prev);
        updatePlayingTrack(track);
      },
      updateTrack,
      removeTrack: async (id) => {
        await apiFetch(`/api/music/tracks/${id}`, { method: "DELETE" });
        setTracks((prev) => prev?.filter((t) => t.id !== id) ?? prev);
        reloadPlaylists();
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
      addToPlaylist: async (playlistId, trackIds) => {
        const { trackIds: existing } = await apiFetch<{ trackIds: string[] }>(`/api/music/playlists/${playlistId}`);
        await apiFetch(`/api/music/playlists/${playlistId}`, {
          method: "PATCH",
          body: JSON.stringify({ trackIds: [...existing, ...trackIds] }),
        });
        reloadPlaylists();
      },
    };
  }, [merged, playlists, storageConfigured, reload, reloadPlaylists, updatePlayingTrack]);

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}
