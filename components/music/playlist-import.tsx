"use client";

import { useMemo, useRef, useState } from "react";
import { CheckCircle2, ListMusic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { useLibrary } from "./library-context";
import { matchPlaylists, parsePlaylistCsv, yearsFromPlaylists, type MatchedPlaylist } from "@/lib/music/playlist-csv";
import { plural } from "@/lib/music/types";

/**
 * Brings playlists in from a "songs by playlist" CSV export: recreates them
 * from the matching songs here, and can use year-named playlists ("1997")
 * to set (and lock) songs' years.
 */
export function PlaylistImport() {
  const library = useLibrary();
  const input = useRef<HTMLInputElement | null>(null);
  const [playlists, setPlaylists] = useState<MatchedPlaylist[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [useYears, setUseYears] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function load(file: File | undefined) {
    if (!file) return;
    setError(null);
    setDone(null);
    try {
      const matched = matchPlaylists(parsePlaylistCsv(await file.text()), library.tracks ?? []);
      setPlaylists(matched);
      setSelected(new Set(matched.filter((p) => !p.suggestSkip && !p.year && p.trackIds.length).map((p) => p.name)));
    } catch (err) {
      setPlaylists(null);
      setError(err instanceof Error ? err.message : "Couldn't read that file.");
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  const yearPlaylists = useMemo(() => (playlists ?? []).filter((p) => p.year), [playlists]);
  const years = useMemo(() => yearsFromPlaylists(playlists ?? []), [playlists]);
  const regular = (playlists ?? []).filter((p) => !p.year);

  function toggle(name: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  async function run() {
    if (!playlists) return;
    setDone(null);
    setError(null);
    try {
      let yearsSet = 0;
      if (useYears && years.size) {
        const updates = [...years.entries()].map(([id, year]) => ({ id, year }));
        for (let i = 0; i < updates.length; i += 1000) {
          setBusy(`Setting years… ${Math.min(i + 1000, updates.length).toLocaleString()} / ${updates.length.toLocaleString()}`);
          const res = await apiFetch<{ updated: number }>("/api/music/tracks/years", {
            method: "POST",
            body: JSON.stringify({ years: updates.slice(i, i + 1000) }),
          });
          yearsSet += res.updated;
        }
      }
      const chosen = playlists.filter((p) => selected.has(p.name) && p.trackIds.length);
      let created = 0;
      let refreshed = 0;
      for (const [n, p] of chosen.entries()) {
        setBusy(`Playlists… ${n + 1} / ${chosen.length}`);
        // Importing the same file again updates these playlists instead of duplicating them.
        const existing = library.playlists.find((x) => x.recipe?.source === "csv" && x.recipe?.name === p.name);
        if (existing) {
          await apiFetch(`/api/music/playlists/${existing.id}`, { method: "PATCH", body: JSON.stringify({ trackIds: p.trackIds }) });
          refreshed += 1;
        } else {
          await apiFetch("/api/music/playlists", {
            method: "POST",
            body: JSON.stringify({ name: p.name.slice(0, 200), kind: "manual", recipe: { source: "csv", name: p.name }, trackIds: p.trackIds }),
          });
          created += 1;
        }
      }
      library.reload();
      library.reloadPlaylists();
      setDone(
        [
          created ? `added ${plural(created, "playlist")}` : null,
          refreshed ? `updated ${plural(refreshed, "playlist")}` : null,
          yearsSet ? `set years on ${plural(yearsSet, "song")}` : null,
        ]
          .filter(Boolean)
          .join(" · ") || "Nothing to import.",
      );
    } catch {
      setError("Something went wrong partway — importing again is safe.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-6 space-y-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex items-start gap-3">
        <ListMusic className="mt-0.5 h-5 w-5 shrink-0 text-neutral-400" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">Import playlists from a file</p>
          <p className="text-xs text-neutral-500">
            Open a &ldquo;songs by playlist&rdquo; CSV (one column per playlist, songs as &ldquo;Title - Artist&rdquo;). Playlists are
            rebuilt from the matching songs in your library. Year playlists (&ldquo;1997&rdquo;) can set your songs&apos; years.
          </p>
        </div>
      </div>
      <Button variant="secondary" onClick={() => input.current?.click()} disabled={Boolean(busy) || !library.tracks}>
        {playlists ? "Open another file" : "Open playlist CSV"}
      </Button>
      <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => load(e.target.files?.[0])} />
      {error && <p className="text-xs text-red-600">{error}</p>}

      {playlists && (
        <div className="space-y-3">
          {yearPlaylists.length > 0 && (
            <label className="flex items-start gap-2 rounded-md bg-indigo-50/60 p-3 text-xs dark:bg-indigo-950/30">
              <input type="checkbox" className="mt-0.5" checked={useYears} onChange={(e) => setUseYears(e.target.checked)} />
              <span>
                <span className="font-medium">Use my {plural(yearPlaylists.length, "year playlist")} to set song years</span> —{" "}
                {plural(years.size, "song")} matched. Your years win over looked-up dates and won&apos;t be changed automatically.
              </span>
            </label>
          )}
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>
              {selected.size} of {regular.length} playlists selected
            </span>
            <span className="flex gap-3">
              <button onClick={() => setSelected(new Set(regular.filter((p) => p.trackIds.length).map((p) => p.name)))} className="underline">
                All
              </button>
              <button onClick={() => setSelected(new Set())} className="underline">
                None
              </button>
            </span>
          </div>
          <ul className="max-h-80 divide-y divide-neutral-100 overflow-y-auto rounded-md border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {regular.map((p) => {
              const total = p.entries.length;
              return (
                <li key={p.name}>
                  <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-900">
                    <input type="checkbox" checked={selected.has(p.name)} onChange={() => toggle(p.name)} disabled={!p.trackIds.length} />
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    <span className={p.trackIds.length === total ? "text-xs text-emerald-600" : "text-xs text-neutral-500"}>
                      {p.trackIds.length.toLocaleString()} / {total.toLocaleString()} found
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <p className="text-[11px] text-neutral-400">
            Songs not in your library (Apple Music subscription or not imported yet) are left out. Importing the same file again updates
            these playlists instead of making copies.
          </p>
          <Button onClick={run} disabled={Boolean(busy) || (!selected.size && !(useYears && years.size))}>
            {busy ?? "Import"}
          </Button>
          {done && (
            <p className="flex items-center gap-1.5 text-xs text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Done — {done}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
