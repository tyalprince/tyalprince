"use client";

import { useMemo, useState } from "react";
import { Heart, ListEnd, ListPlus, Pencil, Play, Sparkles, Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePlayer } from "./player-context";
import { useLibrary } from "./library-context";
import { Artwork } from "./player-bar";
import { keyLabel } from "@/lib/music/analysis";
import { similarTo } from "@/lib/music/similarity";
import { displayArtist, formatTime, type Track } from "@/lib/music/types";

function Meter({ label, value, text }: { label: string; value: number; text?: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-neutral-500">
        <span>{label}</span>
        <span className="tabular-nums">{text ?? `${Math.round(value * 100)}%`}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
        <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }} />
      </div>
    </div>
  );
}

export function TrackDetails({
  track,
  onClose,
  onMakeMix,
}: {
  track: Track;
  onClose: () => void;
  onMakeMix: (seed: Track) => void;
}) {
  const player = usePlayer();
  const library = useLibrary();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    title: track.title,
    artist: track.artist ?? "",
    album: track.album ?? "",
    genre: track.genre ?? "",
    year: track.year?.toString() ?? "",
  });
  const [notice, setNotice] = useState<string | null>(null);
  const live = library.byId.get(track.id) ?? track;

  const similar = useMemo(
    () => (library.tracks ? similarTo([live], library.tracks, 11).slice(1) : []),
    [library.tracks, live],
  );

  async function saveEdits() {
    await library.updateTrack(live.id, {
      title: draft.title.trim() || live.title,
      artist: draft.artist.trim() || null,
      album: draft.album.trim() || null,
      genre: draft.genre.trim() || null,
      year: draft.year ? Number(draft.year) : null,
    });
    setEditing(false);
  }

  async function remove() {
    if (!confirm(`Remove "${live.title}" from your library? The file is deleted from storage.`)) return;
    await library.removeTrack(live.id);
    onClose();
  }

  async function addTo(playlistId: string) {
    await library.addToPlaylist(playlistId, [live.id]);
    setNotice(`Added to ${library.playlists.find((p) => p.id === playlistId)?.name ?? "playlist"}`);
  }

  const f = live.features;

  return (
    <Dialog open onClose={onClose} title="Song details">
      <div className="space-y-4">
        <div className="flex gap-4">
          <Artwork track={live} className="h-24 w-24 rounded-lg" />
          <div className="min-w-0">
            <p className="font-semibold">{live.title}</p>
            <p className="truncate text-sm text-neutral-500">{displayArtist(live)}</p>
            <p className="truncate text-sm text-neutral-500">
              {[live.album, live.year].filter(Boolean).join(" · ")}
            </p>
            <p className="text-xs text-neutral-400">
              {[live.genre, formatTime(live.durationSeconds), `${live.playCount} plays`].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => player.play([live])}>
            <Play className="h-4 w-4" />
            Play
          </Button>
          <Button variant="secondary" onClick={() => library.toggleLike(live)} aria-pressed={live.liked}>
            <Heart className={live.liked ? "h-4 w-4 fill-rose-500 text-rose-500" : "h-4 w-4"} />
            {live.liked ? "Liked" : "Like"}
          </Button>
          <Button variant="ghost" onClick={() => { player.playNext(live); setNotice("Playing next"); }}>
            <ListEnd className="h-4 w-4" />
            Play next
          </Button>
          <Button variant="ghost" onClick={() => { player.addToQueue(live); setNotice("Added to queue"); }}>
            <ListPlus className="h-4 w-4" />
            Queue
          </Button>
        </div>

        {library.playlists.length > 0 && (
          <select
            value=""
            onChange={(e) => e.target.value && addTo(e.target.value)}
            className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            aria-label="Add to playlist"
          >
            <option value="">Add to playlist…</option>
            {library.playlists.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        {notice && <p className="text-xs text-emerald-600">{notice}</p>}

        {f ? (
          <div className="space-y-2 rounded-lg bg-neutral-50 p-3 dark:bg-neutral-800/50">
            <p className="text-xs font-medium text-neutral-500">
              Sound profile · {Math.round(f.tempo)} BPM · {keyLabel(f.key, f.mode)}
            </p>
            <Meter label="Energy" value={f.energy} />
            <Meter label="Beat strength" value={f.pulse} />
            <Meter label="Brightness" value={(f.brightness - 500) / 3500} text={`${f.brightness} Hz`} />
            <Meter label="Dynamics" value={f.dynamics} />
          </div>
        ) : (
          <p className="text-xs text-neutral-500">
            No audio analysis for this song (its format couldn&apos;t be decoded in the browser) — similar songs use its tags.
          </p>
        )}

        <div>
          <div className="mb-1 flex items-center justify-between">
            <p className="text-sm font-semibold">Similar songs</p>
            <Button variant="ghost" className="px-2 text-xs" onClick={() => onMakeMix(live)}>
              <Sparkles className="h-3.5 w-3.5" />
              Make a mix
            </Button>
          </div>
          <ul className="space-y-1">
            {similar.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => player.play([live, ...similar], similar.indexOf(s) + 1)}
                  className="flex w-full items-center gap-2 rounded px-1 py-1 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800"
                >
                  <Artwork track={s} className="h-8 w-8" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm">{s.title}</span>
                    <span className="block truncate text-xs text-neutral-500">{displayArtist(s)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {editing ? (
          <div className="space-y-2 border-t border-neutral-100 pt-3 dark:border-neutral-800">
            {(["title", "artist", "album", "genre", "year"] as const).map((field) => (
              <label key={field} className="block text-xs capitalize text-neutral-500">
                {field}
                <Input
                  value={draft[field]}
                  inputMode={field === "year" ? "numeric" : undefined}
                  onChange={(e) => setDraft({ ...draft, [field]: e.target.value })}
                />
              </label>
            ))}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button onClick={saveEdits}>Save</Button>
            </div>
          </div>
        ) : (
          <div className="flex justify-between border-t border-neutral-100 pt-3 dark:border-neutral-800">
            <Button variant="ghost" className="text-xs" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" />
              Edit details
            </Button>
            <Button variant="ghost" className="text-xs text-red-600" onClick={remove}>
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
