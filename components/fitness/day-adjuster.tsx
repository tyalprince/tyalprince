"use client";

import { useRef, useState } from "react";
import { Home, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { PlanScheduleEditor } from "./plan-schedule-editor";
import {
  NEUTRAL_FOCUS,
  draftsToPayload,
  formatDay,
  planDaysToDrafts,
  selectClass,
  useExerciseLibrary,
} from "./shared";
import {
  DAY_TYPE_LABELS,
  buildDayContent,
  convertToHome,
  templateFromTitle,
} from "@/lib/fitness/generator";
import type { DayType, DraftDay, PlanDayRow, PlanDetail } from "@/lib/fitness/types";

const DAY_TYPES: DayType[] = ["gym", "home", "cardio", "recovery", "rest"];

/**
 * "Plans changed?" controls for one not-yet-started plan day: do a gym day
 * at home, turn it into another kind of day, trade it with another day this
 * week, or edit its exercises. Changes are saved to the plan so the calendar,
 * history and plan review all reflect what was actually scheduled.
 */
export function DayAdjuster({
  detail,
  day,
  swappableDays,
  onSaved,
}: {
  detail: PlanDetail;
  day: PlanDayRow;
  swappableDays: PlanDayRow[];
  onSaved: (detail: PlanDetail) => void;
}) {
  const library = useExerciseLibrary();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<DraftDay | null>(null);
  const focus = detail.plan.focus ?? NEUTRAL_FOCUS;
  // Fresh seed per change so repeated tries give different exercises.
  const seedRef = useRef(1);

  const drafts = planDaysToDrafts(detail.days);
  const current = drafts.find((d) => d.id === day.id)!;

  async function save(changed: DraftDay[]) {
    setBusy(true);
    setError(null);
    try {
      const merged = drafts.map((d) => changed.find((c) => c.id === d.id) ?? d);
      const updated = await apiFetch<PlanDetail>(`/api/fitness/plans/${detail.plan.id}/schedule`, {
        method: "PUT",
        body: JSON.stringify({ days: draftsToPayload(merged) }),
      });
      setEditing(null);
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the plan");
    } finally {
      setBusy(false);
    }
  }

  function doAtHome() {
    if (!library) return;
    save([
      {
        ...current,
        dayType: "home",
        title: `${current.title.replace(/ \(Home\)$/, "")} (Home)`,
        exercises: convertToHome(current.exercises, library, ++seedRef.current),
      },
    ]);
  }

  function changeType(dayType: DayType) {
    if (!library) return;
    const content = buildDayContent(dayType, library, focus, ++seedRef.current, {
      strengthTemplate: templateFromTitle(current.title),
    });
    save([{ ...current, dayType, title: content.title, exercises: content.exercises, notes: null }]);
  }

  function swapWith(otherId: string) {
    const other = drafts.find((d) => d.id === otherId);
    if (!other) return;
    const content = (d: DraftDay) => ({ dayType: d.dayType, title: d.title, notes: d.notes, exercises: d.exercises });
    save([
      { ...current, ...content(other) },
      { ...other, ...content(current) },
    ]);
  }

  if (editing) {
    return (
      <div className="space-y-3 border-t border-neutral-100 pt-3 dark:border-neutral-800">
        <PlanScheduleEditor
          days={[editing]}
          onChange={(days) => setEditing(days[0])}
          library={library ?? []}
          focus={focus}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setEditing(null)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => save([editing])} disabled={busy}>
            {busy ? "Saving…" : "Save day"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 border-t border-neutral-100 pt-3 dark:border-neutral-800">
      <p className="text-xs font-medium text-neutral-500">Plans changed?</p>
      <div className="flex flex-wrap gap-2">
        {day.dayType === "gym" && (
          <Button variant="secondary" onClick={doAtHome} disabled={busy || !library}>
            <Home className="h-4 w-4" />
            Do it at home
          </Button>
        )}
        <select
          value=""
          onChange={(e) => e.target.value && changeType(e.target.value as DayType)}
          disabled={busy || !library}
          className={selectClass}
          aria-label="Change this day to"
        >
          <option value="">Change to…</option>
          {DAY_TYPES.filter((t) => t !== day.dayType).map((t) => (
            <option key={t} value={t}>
              {DAY_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        {swappableDays.length > 0 && (
          <select
            value=""
            onChange={(e) => e.target.value && swapWith(e.target.value)}
            disabled={busy}
            className={selectClass}
            aria-label="Swap with another day"
          >
            <option value="">Swap with…</option>
            {swappableDays.map((d) => (
              <option key={d.id} value={d.id}>
                {formatDay(d.scheduledDate ?? "").slice(0, 3)} · {d.title}
              </option>
            ))}
          </select>
        )}
        {day.dayType !== "rest" && (
          <Button variant="ghost" onClick={() => setEditing(current)} disabled={busy || !library}>
            <Pencil className="h-4 w-4" />
            Edit exercises
          </Button>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
