"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** 0–5 stars for a 0–100 rating. With `onChange`, tap a star to rate (tap the same one again to clear). */
export function Stars({
  rating,
  onChange,
  size = "h-4 w-4",
}: {
  rating: number | null;
  onChange?: (rating: number | null) => void;
  size?: string;
}) {
  const stars = Math.round((rating ?? 0) / 20);
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={stars ? `${stars} out of 5 stars` : "Not rated"}>
      {[1, 2, 3, 4, 5].map((n) => {
        const icon = <Star className={cn(size, n <= stars ? "fill-amber-400 text-amber-400" : "text-neutral-300 dark:text-neutral-600")} />;
        return onChange ? (
          <button key={n} type="button" onClick={() => onChange(n === stars ? null : n * 20)} aria-label={`${n} star${n > 1 ? "s" : ""}`}>
            {icon}
          </button>
        ) : (
          <span key={n}>{icon}</span>
        );
      })}
    </span>
  );
}
