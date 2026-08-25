"use client";

import { cn } from "@/lib/utils";

const WEEKS = 16;

export function CalendarHeatmap({ dates }: { dates: string[] }) {
  const daySet = new Set(dates.map((d) => d.slice(0, 10)));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Align to the most recent Sunday so columns are clean weeks.
  const end = new Date(today);
  end.setDate(end.getDate() - end.getDay());
  const start = new Date(end);
  start.setDate(start.getDate() - (WEEKS - 1) * 7);

  const weeks: Date[][] = [];
  for (let w = 0; w < WEEKS; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start);
      date.setDate(date.getDate() + w * 7 + d);
      week.push(date);
    }
    weeks.push(week);
  }

  return (
    <div className="flex gap-1 overflow-x-auto pb-1">
      {weeks.map((week, wi) => (
        <div key={wi} className="flex flex-col gap-1">
          {week.map((date) => {
            const key = date.toISOString().slice(0, 10);
            const active = daySet.has(key);
            const future = date > today;
            return (
              <div
                key={key}
                title={key}
                className={cn(
                  "h-3 w-3 rounded-sm",
                  future
                    ? "bg-transparent"
                    : active
                      ? "bg-indigo-500"
                      : "bg-neutral-200 dark:bg-neutral-800",
                )}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
