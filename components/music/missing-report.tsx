"use client";

import { useRef, useState } from "react";
import { CheckCircle2, Download, FileSearch, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { useLibrary } from "./library-context";
import {
  buildMissingReport,
  matchToLibrary,
  missingCsv,
  parseItunesLibrary,
  playlistsForLibrary,
  statsForLibrary,
  type ItunesTrack,
  type MissingReason,
  type MissingReport,
  type TrackStats,
} from "@/lib/music/itunes-library";
import { plural } from "@/lib/music/types";

type Transfer = {
  stats: TrackStats[];
  playlists: ReturnType<typeof playlistsForLibrary>;
  rated: number;
  plays: number;
  loved: number;
};

const SECTIONS: { reason: MissingReason; title: string; help: string; fixable: boolean }[] = [
  {
    reason: "notImported",
    title: "On your PC but not imported",
    help: "These files are on your computer — pick their folder in Import above and they'll be added (duplicates are still skipped).",
    fixable: true,
  },
  {
    reason: "cloud",
    title: "In iCloud, not downloaded",
    help: "In iTunes, select these songs → right-click → Download. Then run Import again.",
    fixable: true,
  },
  {
    reason: "protected",
    title: "Old protected purchases",
    help: "Bought before 2009 with copy protection. In iTunes go to Account → Purchased, delete the old copy and download it again — Apple now gives purchases unlocked. Then run Import again.",
    fixable: true,
  },
  {
    reason: "subscription",
    title: "Apple Music subscription songs",
    help: "Locked to Apple's apps and stop playing if the subscription ends, so they can't be imported. To own one, buy it (iTunes Store, Amazon…) and import the purchased file.",
    fixable: false,
  },
];

/**
 * Reads an iTunes library export: carries ratings, play counts, loved songs
 * and playlists over to the matching songs here, and shows what's missing
 * from this library and why.
 */
export function MissingReportPanel() {
  const library = useLibrary();
  const input = useRef<HTMLInputElement | null>(null);
  const [report, setReport] = useState<MissingReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [transfer, setTransfer] = useState<Transfer | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [synced, setSynced] = useState<string | null>(null);

  async function load(file: File | undefined) {
    if (!file) return;
    setReading(true);
    setError(null);
    try {
      const { tracks, playlists } = parseItunesLibrary(await file.text());
      const matches = matchToLibrary(tracks, library.tracks ?? []);
      setReport(buildMissingReport(tracks, library.tracks ?? [], matches));
      const stats = statsForLibrary(tracks, matches);
      setTransfer({
        stats,
        playlists: playlistsForLibrary(playlists, matches),
        rated: stats.filter((s) => s.rating).length,
        plays: stats.reduce((n, s) => n + s.playCount, 0),
        loved: stats.filter((s) => s.loved).length,
      });
      setSynced(null);
    } catch (err) {
      setReport(null);
      setTransfer(null);
      setError(err instanceof Error ? err.message : "Couldn't read that file.");
    } finally {
      setReading(false);
      if (input.current) input.current.value = "";
    }
  }

  async function runTransfer() {
    if (!transfer) return;
    setSynced(null);
    try {
      let updated = 0;
      for (let i = 0; i < transfer.stats.length; i += 500) {
        setSyncing(`Ratings & plays… ${Math.min(i + 500, transfer.stats.length).toLocaleString()} / ${transfer.stats.length.toLocaleString()}`);
        const res = await apiFetch<{ updated: number }>("/api/music/itunes-sync", {
          method: "POST",
          body: JSON.stringify({ stats: transfer.stats.slice(i, i + 500) }),
        });
        updated += res.updated;
      }
      // Re-importing updates the playlists made last time instead of duplicating them.
      let created = 0;
      let refreshed = 0;
      for (const [n, p] of transfer.playlists.entries()) {
        setSyncing(`Playlists… ${n + 1} / ${transfer.playlists.length}`);
        const existing = library.playlists.find((x) => x.recipe?.source === "itunes" && x.recipe?.itunesId === p.id);
        if (existing) {
          await apiFetch(`/api/music/playlists/${existing.id}`, { method: "PATCH", body: JSON.stringify({ name: p.name, trackIds: p.trackIds }) });
          refreshed += 1;
        } else {
          await apiFetch("/api/music/playlists", {
            method: "POST",
            body: JSON.stringify({
              name: p.name,
              kind: "manual",
              description: p.smart ? "Smart playlist from iTunes (songs as of the export)" : "From iTunes",
              recipe: { source: "itunes", itunesId: p.id },
              trackIds: p.trackIds,
            }),
          });
          created += 1;
        }
      }
      library.reload();
      library.reloadPlaylists();
      setSynced(
        `Updated ${plural(updated, "song")}` +
          (created ? ` · added ${plural(created, "playlist")}` : "") +
          (refreshed ? ` · refreshed ${plural(refreshed, "playlist")}` : "") +
          ".",
      );
    } catch {
      setSynced("Something went wrong partway — running it again is safe.");
    } finally {
      setSyncing(null);
    }
  }

  function downloadCsv() {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([missingCsv(report)], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "missing-songs.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const missingCount = report ? Object.values(report.missing).reduce((s, l) => s + l.length, 0) : 0;

  return (
    <div className="mt-6 space-y-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex items-start gap-3">
        <FileSearch className="mt-0.5 h-5 w-5 shrink-0 text-neutral-400" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">Bring over your iTunes history</p>
          <p className="text-xs text-neutral-500">
            In iTunes choose <b>File → Library → Export Library…</b>, save the file, then open it here. Your ratings,
            play counts, loved songs and playlists carry over to the matching songs, and you&apos;ll see which songs
            aren&apos;t in this app yet and why. The file is read on this device; only the matched stats are saved.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => input.current?.click()} disabled={reading || !library.tracks}>
          {reading ? "Reading…" : report ? "Open another export" : "Open library export (.xml)"}
        </Button>
        {report && missingCount > 0 && (
          <Button variant="ghost" onClick={downloadCsv}>
            <Download className="h-4 w-4" />
            Download list (CSV)
          </Button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept=".xml,text/xml,application/xml"
        className="hidden"
        onChange={(e) => load(e.target.files?.[0])}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}

      {transfer && (
        <div className="space-y-2 rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <History className="h-4 w-4 text-neutral-400" />
            Ratings, plays &amp; playlists
          </p>
          <p className="text-xs text-neutral-600 dark:text-neutral-400">
            {plural(transfer.stats.length, "song")} here {transfer.stats.length === 1 ? "has" : "have"} iTunes history:{" "}
            {transfer.rated.toLocaleString()} rated, {plural(transfer.plays, "play")}, {transfer.loved.toLocaleString()} loved
            {transfer.playlists.length > 0 && <> · {plural(transfer.playlists.length, "playlist")}</>}.
          </p>
          {transfer.stats.length > 0 || transfer.playlists.length > 0 ? (
            <Button onClick={runTransfer} disabled={Boolean(syncing)}>
              {syncing ?? "Transfer to this library"}
            </Button>
          ) : (
            <p className="text-xs text-neutral-500">Nothing to transfer.</p>
          )}
          {synced && (
            <p className="flex items-center gap-1.5 text-xs text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {synced}
            </p>
          )}
          <p className="text-[11px] text-neutral-400">
            Safe to run again after more imports: iTunes plays replace the last transfer (plays here are kept), ratings
            fill songs you haven&apos;t rated here, and playlists update instead of duplicating.
          </p>
        </div>
      )}

      {report && (
        <div className="space-y-3">
          <p className="text-sm">
            <span className="font-semibold">{report.inLibrary.toLocaleString()}</span> of {report.total.toLocaleString()} iTunes
            songs are in this app.{" "}
            {missingCount ? (
              <>
                <span className="font-semibold">{missingCount.toLocaleString()}</span> are missing:
              </>
            ) : (
              "Nothing is missing."
            )}
            {report.skippedNonMusic > 0 && (
              <span className="text-xs text-neutral-500"> ({report.skippedNonMusic.toLocaleString()} videos/podcasts ignored)</span>
            )}
          </p>
          {SECTIONS.filter((s) => report.missing[s.reason].length).map((s) => (
            <Section key={s.reason} {...s} tracks={report.missing[s.reason]} />
          ))}
        </div>
      )}
    </div>
  );
}

function Section({ title, help, fixable, tracks }: { title: string; help: string; fixable: boolean; tracks: ItunesTrack[] }) {
  return (
    <details className="rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
      <summary className="cursor-pointer text-sm">
        <span className="font-semibold">{tracks.length.toLocaleString()}</span> {title}
        <span className={fixable ? "ml-2 text-xs text-emerald-600" : "ml-2 text-xs text-neutral-500"}>
          {fixable ? "can be added" : "can't be imported"}
        </span>
      </summary>
      <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">{help}</p>
      <ul className="mt-2 max-h-64 space-y-0.5 overflow-y-auto text-xs text-neutral-600 dark:text-neutral-400">
        {tracks.slice(0, 1000).map((t, i) => (
          <li key={i} className="truncate">
            {t.name}
            {t.artist && <span className="text-neutral-400"> — {t.artist}</span>}
            {t.path && <span className="block truncate font-mono text-[10px] text-neutral-400">{t.path}</span>}
          </li>
        ))}
        {tracks.length > 1000 && <li className="text-neutral-400">…and {tracks.length - 1000} more (see the CSV)</li>}
      </ul>
    </details>
  );
}
