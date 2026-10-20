"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, ListMusic, Pencil, Play, Plus, RefreshCw, Shuffle, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api-client";
import { usePlayer } from "./player-context";
import { useLibrary } from "./library-context";
import { Artwork } from "./player-bar";
import { BackLink } from "./browse";
import { displayArtist, formatTime, type PlaylistSummary, type Track } from "@/lib/music/types";
import { totalDurationSeconds } from "@/lib/music/similarity";
import { isMixRecipe, runRecipe } from "@/lib/music/mixes";

export function PlaylistList({ onOpen }: { onOpen: (p: PlaylistSummary) => void }) {
  const library = useLibrary();
  const [name, setName] = useState("");

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const playlist = await library.createPlaylist({ name: name.trim(), trackIds: [] });
    setName("");
    onOpen({ ...playlist, trackCount: 0 });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={create} className="flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New playlist name" />
        <Button type="submit" disabled={!name.trim()}>
          <Plus className="h-4 w-4" />
          Create
        </Button>
      </form>
      {library.playlists.length === 0 ? (
        <p className="py-6 text-center text-sm text-neutral-500">
          No playlists yet. Create one above, or generate one from the Mixes tab.
        </p>
      ) : (
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800/70">
          {library.playlists.map((p) => (
            <button key={p.id} onClick={() => onOpen(p)} className="flex w-full items-center gap-3 py-2.5 text-left">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
                {p.kind === "generated" ? <Sparkles className="h-5 w-5" /> : <ListMusic className="h-5 w-5" />}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{p.name}</span>
                <span className="block text-xs text-neutral-500">
                  {p.trackCount} songs{p.kind === "generated" ? " · generated" : ""}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function PlaylistView({
  playlist,
  onBack,
  onDetails,
}: {
  playlist: PlaylistSummary;
  onBack: () => void;
  onDetails: (t: Track) => void;
}) {
  const library = useLibrary();
  const player = usePlayer();
  const [trackIds, setTrackIds] = useState<string[] | null>(null);
  const [name, setName] = useState(playlist.name);
  const [renaming, setRenaming] = useState(false);
  const [editing, setEditing] = useState(false);
  const [kept, setKept] = useState(false);

  useEffect(() => {
    apiFetch<{ trackIds: string[] }>(`/api/music/playlists/${playlist.id}`)
      .then((d) => setTrackIds(d.trackIds))
      .catch(() => setTrackIds([]));
  }, [playlist.id]);

  const tracks = (trackIds ?? []).map((id) => library.byId.get(id)).filter((t): t is Track => Boolean(t));

  const save = useCallback(
    async (ids: string[], extra: Record<string, unknown> = {}) => {
      setTrackIds(ids);
      await apiFetch(`/api/music/playlists/${playlist.id}`, {
        method: "PATCH",
        body: JSON.stringify({ trackIds: ids, ...extra }),
      });
      library.reloadPlaylists();
    },
    [playlist.id, library],
  );

  function move(i: number, delta: number) {
    const ids = tracks.map((t) => t.id);
    const j = i + delta;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    save(ids);
  }

  async function rename() {
    if (!name.trim()) return;
    await apiFetch(`/api/music/playlists/${playlist.id}`, { method: "PATCH", body: JSON.stringify({ name: name.trim() }) });
    setRenaming(false);
    library.reloadPlaylists();
  }

  async function remove() {
    if (!confirm(`Delete playlist "${playlist.name}"? Songs stay in your library.`)) return;
    await apiFetch(`/api/music/playlists/${playlist.id}`, { method: "DELETE" });
    library.reloadPlaylists();
    onBack();
  }

  const recipe = isMixRecipe(playlist.recipe) ? playlist.recipe : null;

  return (
    <div>
      <BackLink onClick={onBack} label={playlist.kind === "history" ? "Back" : "Playlists"} />
      <div className="mb-4 space-y-2">
        {renaming ? (
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            <Button onClick={rename}>Save</Button>
          </div>
        ) : (
          <h2 className="text-xl font-semibold">{name}</h2>
        )}
        <p className="text-xs text-neutral-500">
          {tracks.length} songs · {formatTime(totalDurationSeconds(tracks))}
          {playlist.kind === "generated" ? " · generated mix" : ""}
          {playlist.kind === "history" ? ` · made ${new Date(playlist.createdAt).toLocaleDateString()}${kept ? " · saved to playlists" : ""}` : ""}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => player.play(tracks)} disabled={!tracks.length}>
            <Play className="h-4 w-4" />
            Play
          </Button>
          <Button
            variant="secondary"
            onClick={() => player.play(tracks, Math.floor(Math.random() * tracks.length), { shuffle: true })}
            disabled={!tracks.length}
          >
            <Shuffle className="h-4 w-4" />
            Shuffle
          </Button>
          {playlist.kind === "history" && !kept && (
            <Button
              variant="secondary"
              onClick={async () => {
                await library.keepMix(playlist.id, name);
                setKept(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Save to playlists
            </Button>
          )}
          {recipe && library.tracks && (
            <Button variant="secondary" onClick={() => save(runRecipe(recipe, library.tracks!).map((t) => t.id))}>
              <RefreshCw className="h-4 w-4" />
              Refresh mix
            </Button>
          )}
          <Button variant="ghost" onClick={() => setEditing((v) => !v)}>
            <Pencil className="h-4 w-4" />
            {editing ? "Done" : "Edit"}
          </Button>
        </div>
        {editing && (
          <div className="flex gap-3 text-xs">
            <button onClick={() => setRenaming(true)} className="text-indigo-600 underline dark:text-indigo-400">
              Rename
            </button>
            <button onClick={remove} className="flex items-center gap-1 text-red-600 underline">
              <Trash2 className="h-3 w-3" />
              Delete playlist
            </button>
          </div>
        )}
      </div>

      {trackIds === null ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : tracks.length === 0 ? (
        <p className="py-6 text-center text-sm text-neutral-500">
          Empty playlist. Open any song&apos;s details (•••) and choose &quot;Add to playlist&quot;.
        </p>
      ) : (
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800/70">
          {tracks.map((t, i) => (
            <div key={`${t.id}-${i}`} className="flex items-center gap-3 py-2">
              <button onClick={() => player.play(tracks, i)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <Artwork track={t} className="h-10 w-10" />
                <span className="min-w-0">
                  <span className="block truncate text-sm">{t.title}</span>
                  <span className="block truncate text-xs text-neutral-500">{displayArtist(t)}</span>
                </span>
              </button>
              {editing ? (
                <span className="flex shrink-0">
                  <button onClick={() => move(i, -1)} disabled={i === 0} className="p-1 text-neutral-400 disabled:opacity-30" aria-label="Move up">
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button onClick={() => move(i, 1)} disabled={i === tracks.length - 1} className="p-1 text-neutral-400 disabled:opacity-30" aria-label="Move down">
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => save(tracks.filter((_, k) => k !== i).map((x) => x.id))}
                    className="p-1 text-neutral-400 hover:text-red-500"
                    aria-label={`Remove ${t.title}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </span>
              ) : (
                <button onClick={() => onDetails(t)} className="shrink-0 text-xs text-neutral-400">
                  {formatTime(t.durationSeconds)}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
