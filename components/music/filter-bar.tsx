"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Stars } from "./stars";
import { activeFilterCount, facetOptions, NO_FILTERS, type SongFilters } from "@/lib/music/facets";
import type { Track } from "@/lib/music/types";

type FacetKey = "decades" | "years" | "genres" | "artists";

const FACETS: { key: FacetKey; label: string; searchable: boolean }[] = [
  { key: "decades", label: "Decade", searchable: false },
  { key: "years", label: "Year", searchable: true },
  { key: "genres", label: "Genre", searchable: true },
  { key: "artists", label: "Artist", searchable: true },
];

/** Multi-select filters for the song list; options and counts follow the other active filters. */
export function FilterBar({
  tracks,
  filters,
  onChange,
}: {
  tracks: Track[];
  filters: SongFilters;
  onChange: (f: SongFilters) => void;
}) {
  const [open, setOpen] = useState<FacetKey | "rating" | null>(null);
  const bar = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (bar.current && !bar.current.contains(e.target as Node)) setOpen(null);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const active = activeFilterCount(filters);
  const chips = FACETS.flatMap(({ key }) => filters[key].map((value) => ({ key, value })));

  return (
    <div ref={bar} className="relative mb-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        {FACETS.map(({ key, label, searchable }) => (
          <div key={key}>
            <FilterButton label={label} count={filters[key].length} open={open === key} onClick={() => setOpen(open === key ? null : key)} />
            {open === key && (
              <FacetMenu
                tracks={tracks}
                filters={filters}
                facet={key}
                searchable={searchable}
                onChange={(values) => onChange({ ...filters, [key]: values })}
              />
            )}
          </div>
        ))}
        <div>
          <FilterButton
            label={filters.minStars ? `${filters.minStars}★ & up` : "Rating"}
            count={filters.minStars ? 1 : 0}
            open={open === "rating"}
            onClick={() => setOpen(open === "rating" ? null : "rating")}
          />
          {open === "rating" && (
            <div className="absolute left-0 top-10 z-20 w-48 space-y-0.5 rounded-md border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
              {[0, 5, 4, 3, 2, 1].map((n) => (
                <button
                  key={n}
                  onClick={() => {
                    onChange({ ...filters, minStars: n });
                    setOpen(null);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800",
                    filters.minStars === n && "font-semibold",
                  )}
                >
                  {n ? (
                    <>
                      <Stars rating={n * 20} size="h-3.5 w-3.5" />
                      {n < 5 && <span className="text-xs text-neutral-500">& up</span>}
                    </>
                  ) : (
                    "Any rating"
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        {active > 0 && (
          <button onClick={() => onChange(NO_FILTERS)} className="px-2 text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200">
            Clear all
          </button>
        )}
      </div>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map(({ key, value }) => (
            <button
              key={`${key}:${value}`}
              onClick={() => onChange({ ...filters, [key]: filters[key].filter((v) => v !== value) })}
              className="flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300"
            >
              {value}
              <X className="h-3 w-3" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterButton({ label, count, open, onClick }: { label: string; count: number; open: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-expanded={open}
      className={cn(
        "flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-sm",
        count ? "border-indigo-300 text-indigo-700 dark:border-indigo-800 dark:text-indigo-300" : "border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-400",
      )}
    >
      {label}
      {count > 0 && <span className="rounded-full bg-indigo-600 px-1.5 text-[10px] font-semibold text-white">{count}</span>}
      <ChevronDown className="h-3.5 w-3.5" />
    </button>
  );
}

function FacetMenu({
  tracks,
  filters,
  facet,
  searchable,
  onChange,
}: {
  tracks: Track[];
  filters: SongFilters;
  facet: FacetKey;
  searchable: boolean;
  onChange: (values: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const options = useMemo(() => facetOptions(tracks, filters, facet), [tracks, filters, facet]);
  const selected = filters[facet];
  const q = query.trim().toLowerCase();
  // Selected values stay listed even if the other filters now hide them.
  const shown = [
    ...selected.filter((v) => !options.some((o) => o.value === v)).map((value) => ({ value, count: 0 })),
    ...options,
  ].filter((o) => !q || o.value.toLowerCase().includes(q));

  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  return (
    <div className="absolute inset-x-0 top-10 z-20 rounded-md sm:right-auto sm:w-72 border border-neutral-200 bg-white shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
      {searchable && (
        <div className="border-b border-neutral-100 p-2 dark:border-neutral-800">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="w-full rounded border border-neutral-300 bg-transparent px-2 py-1 text-sm dark:border-neutral-700"
          />
        </div>
      )}
      <ul className="max-h-72 overflow-y-auto p-1">
        {shown.slice(0, 500).map((o) => (
          <li key={o.value}>
            <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800">
              <input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggle(o.value)} />
              <span className="min-w-0 flex-1 truncate">{o.value}</span>
              <span className="text-xs tabular-nums text-neutral-400">{o.count.toLocaleString()}</span>
            </label>
          </li>
        ))}
        {!shown.length && <li className="px-2 py-1.5 text-sm text-neutral-500">No matches.</li>}
      </ul>
      {selected.length > 0 && (
        <div className="border-t border-neutral-100 p-1 dark:border-neutral-800">
          <button onClick={() => onChange([])} className="w-full rounded px-2 py-1 text-left text-xs text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800">
            Clear {selected.length} selected
          </button>
        </div>
      )}
    </div>
  );
}
