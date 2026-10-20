"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { displayArtist, trackArtworkUrl, trackAudioUrl, type Track } from "@/lib/music/types";

type Repeat = "off" | "all" | "one";

type PlayerState = {
  queue: Track[];
  index: number;
  current: Track | null;
  playing: boolean;
  shuffle: boolean;
  repeat: Repeat;
  volume: number;
  play: (tracks: Track[], startIndex?: number, options?: { shuffle?: boolean }) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (seconds: number) => void;
  jumpTo: (index: number) => void;
  playNext: (track: Track) => void;
  addToQueue: (track: Track) => void;
  setShuffle: (on: boolean) => void;
  cycleRepeat: () => void;
  setVolume: (v: number) => void;
  updateTrack: (track: Track) => void;
  /** Refreshes queued copies of songs (e.g. album art found for an album). */
  updateTracks: (apply: (tracks: Track[]) => Track[]) => void;
  /** Called with each song the player looks up on first play; returns an unsubscribe. */
  onLookup: (listener: (track: Track) => void) => () => void;
};

const PlayerContext = createContext<PlayerState | null>(null);
// Position changes several times a second; kept separate so only the
// progress UI re-renders, not every track list that reads the player.
const ProgressContext = createContext<{ position: number; duration: number }>({ position: 0, duration: 0 });

export function usePlayerProgress() {
  return useContext(ProgressContext);
}

export function usePlayer(): PlayerState {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used inside <MusicPlayerProvider>");
  return ctx;
}

function shuffled<T>(items: T[], keepFirst?: T): T[] {
  const rest = items.filter((t) => t !== keepFirst);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return keepFirst ? [keepFirst, ...rest] : rest;
}

/**
 * App-wide audio player. Lives in the (app) layout so playback continues
 * while moving between tabs, and wires up the Media Session API so the
 * phone's lock screen / headphones can control it.
 */
export function MusicPlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [original, setOriginal] = useState<Track[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shuffle, setShuffleState] = useState(false);
  const [repeat, setRepeat] = useState<Repeat>("off");
  const [volume, setVolumeState] = useState(1);
  const countedRef = useRef<string | null>(null);
  const current = queue[index] ?? null;

  // Load a new source whenever the current track changes.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    if (audio.dataset.trackId !== current.id) {
      audio.dataset.trackId = current.id;
      audio.src = trackAudioUrl(current);
      countedRef.current = null;
      audio.play().catch(() => setPlaying(false));
    }
  }, [current]);

  const next = useCallback(() => {
    setIndex((i) => {
      if (i + 1 < queue.length) return i + 1;
      return repeat === "all" ? 0 : i;
    });
  }, [queue.length, repeat]);

  const prev = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  }, [current]);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (audio && Number.isFinite(seconds)) audio.currentTime = Math.max(0, seconds);
  }, []);

  const play = useCallback(
    (tracks: Track[], startIndex = 0, options?: { shuffle?: boolean }) => {
      if (!tracks.length) return;
      const shouldShuffle = options?.shuffle ?? shuffle;
      if (options?.shuffle !== undefined) setShuffleState(options.shuffle);
      const start = tracks[Math.min(startIndex, tracks.length - 1)];
      setOriginal(tracks);
      const q = shouldShuffle ? shuffled(tracks, start) : tracks;
      setQueue(q);
      const i = q.indexOf(start);
      setIndex(i);
      // Same track tapped again → restart it.
      const audio = audioRef.current;
      if (audio && audio.dataset.trackId === start.id) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
    },
    [shuffle],
  );

  const setShuffle = useCallback(
    (on: boolean) => {
      setShuffleState(on);
      if (!current) return;
      const q = on ? shuffled(queue, current) : original.length ? original : queue;
      setQueue(q);
      setIndex(Math.max(0, q.findIndex((t) => t.id === current.id)));
    },
    [current, queue, original],
  );

  const updateTrack = useCallback((track: Track) => {
    setQueue((q) => q.map((t) => (t.id === track.id ? track : t)));
    setOriginal((q) => q.map((t) => (t.id === track.id ? track : t)));
  }, []);

  const updateTracks = useCallback((apply: (tracks: Track[]) => Track[]) => {
    setQueue(apply);
    setOriginal(apply);
  }, []);

  const lookupListeners = useRef(new Set<(track: Track) => void>());
  const onLookup = useCallback((listener: (track: Track) => void) => {
    lookupListeners.current.add(listener);
    return () => {
      lookupListeners.current.delete(listener);
    };
  }, []);

  const value = useMemo<PlayerState>(
    () => ({
      queue,
      index,
      current,
      playing,
      shuffle,
      repeat,
      volume,
      play,
      toggle,
      next,
      prev,
      seek,
      jumpTo: (i) => setIndex(Math.max(0, Math.min(queue.length - 1, i))),
      playNext: (track) => {
        if (!current) return play([track]);
        setQueue((q) => [...q.slice(0, index + 1), track, ...q.slice(index + 1)]);
      },
      addToQueue: (track) => {
        if (!current) return play([track]);
        setQueue((q) => [...q, track]);
      },
      setShuffle,
      cycleRepeat: () => setRepeat((r) => (r === "off" ? "all" : r === "all" ? "one" : "off")),
      setVolume: (v) => {
        setVolumeState(v);
        if (audioRef.current) audioRef.current.volume = v;
      },
      updateTrack,
      updateTracks,
      onLookup,
    }),
    [queue, index, current, playing, shuffle, repeat, volume, play, toggle, next, prev, seek, setShuffle, updateTrack, updateTracks, onLookup],
  );
  const progress = useMemo(() => ({ position, duration }), [position, duration]);

  // First play of a song that hasn't been looked up yet: fetch its album art,
  // release date and credits in the background, then refresh it everywhere.
  const enrichingRef = useRef(new Set<string>());
  useEffect(() => {
    if (!current || current.remote || current.enrichedAt || enrichingRef.current.has(current.id)) return;
    enrichingRef.current.add(current.id);
    apiFetch<{ track: Track }>(`/api/music/tracks/${current.id}/enrich`, { method: "POST", body: "{}" })
      .then(({ track }) => {
        const updated = { ...current, ...track };
        updateTrack(updated);
        lookupListeners.current.forEach((l) => l(updated));
      })
      .catch(() => {});
  }, [current, updateTrack]);

  // Lock-screen / headphone controls and metadata.
  useEffect(() => {
    if (!("mediaSession" in navigator) || !current) return;
    const art = trackArtworkUrl(current);
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.title,
      artist: displayArtist(current),
      album: current.album ?? "",
      artwork: art ? [{ src: art, sizes: "512x512" }] : [],
    });
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ["play", () => audioRef.current?.play()],
      ["pause", () => audioRef.current?.pause()],
      ["nexttrack", next],
      ["previoustrack", prev],
      ["seekto", (d) => d.seekTime !== undefined && seek(d.seekTime)],
    ];
    for (const [action, handler] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // Unsupported action on this browser.
      }
    }
  }, [current, next, prev, seek]);

  return (
    <PlayerContext.Provider value={value}>
      <ProgressContext.Provider value={progress}>{children}</ProgressContext.Provider>
      <audio
        ref={audioRef}
        preload="auto"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime;
          setPosition(t);
          // Count a play after 30s (or half of a short track), once per load.
          if (current && !current.remote && countedRef.current !== current.id && (t > 30 || t > (e.currentTarget.duration || 60) / 2)) {
            countedRef.current = current.id;
            apiFetch(`/api/music/tracks/${current.id}/play`, { method: "POST" }).catch(() => {});
          }
        }}
        onEnded={() => {
          if ((repeat === "one" || (repeat === "all" && queue.length === 1)) && audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(() => {});
          } else if (index + 1 < queue.length || repeat === "all") {
            next();
          } else {
            setPlaying(false);
          }
        }}
        className="hidden"
      />
    </PlayerContext.Provider>
  );
}
