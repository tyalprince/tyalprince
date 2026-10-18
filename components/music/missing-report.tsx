"use client";

import { useRef, useState } from "react";
import { Download, FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLibrary } from "./library-context";
import {
  buildMissingReport,
  missingCsv,
  parseItunesLibrary,
  type ItunesTrack,
  type MissingReason,
  type MissingReport,
} from "@/lib/music/itunes-library";

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
 * Compares an iTunes library export with this library: what's already here,
 * and for everything else, why it's missing and how to get it in.
 */
export function MissingReportPanel() {
  const library = useLibrary();
  const input = useRef<HTMLInputElement | null>(null);
  const [report, setReport] = useState<MissingReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  async function load(file: File | undefined) {
    if (!file) return;
    setReading(true);
    setError(null);
    try {
      const tracks = parseItunesLibrary(await file.text());
      setReport(buildMissingReport(tracks, library.tracks ?? []));
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : "Couldn't read that file.");
    } finally {
      setReading(false);
      if (input.current) input.current.value = "";
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
          <p className="text-sm font-semibold">What&apos;s missing from iTunes?</p>
          <p className="text-xs text-neutral-500">
            In iTunes choose <b>File → Library → Export Library…</b>, save the file, then open it here. You&apos;ll see
            which songs aren&apos;t in this app yet and how to get each kind in. The file is read on this device only.
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
