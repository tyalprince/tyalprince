"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { TodayTab } from "./today-tab";
import { GoalsTab } from "./goals-tab";
import { PlansTab } from "./plans-tab";
import { ProgressTab } from "./progress-tab";
import { LibraryTab } from "./library-tab";

const TABS = [
  { key: "today", label: "Today", Component: TodayTab },
  { key: "goals", label: "Goals", Component: GoalsTab },
  { key: "plans", label: "Plans", Component: PlansTab },
  { key: "progress", label: "Progress", Component: ProgressTab },
  { key: "library", label: "Library", Component: LibraryTab },
] as const;

export function FitnessApp() {
  const [active, setActive] = useState<(typeof TABS)[number]["key"]>("today");
  const ActiveComponent = TABS.find((t) => t.key === active)?.Component ?? TodayTab;

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <h1 className="mb-4 text-xl font-semibold">Fitness</h1>
      <div className="mb-4 flex gap-1 overflow-x-auto rounded-md bg-neutral-100 p-1 dark:bg-neutral-800">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            className={cn(
              "whitespace-nowrap rounded px-3 py-1.5 text-sm font-medium transition-colors",
              active === tab.key
                ? "bg-white shadow-sm dark:bg-neutral-950"
                : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <ActiveComponent />
    </div>
  );
}
