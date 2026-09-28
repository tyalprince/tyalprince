"use client";

import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Replace, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ExercisePicker } from "./exercise-picker";
import { DayTypeBadge, cardClass, defaultTargets, describeTarget, formatDay, selectClass } from "./shared";
import {
  DAY_TYPE_LABELS,
  STRENGTH_TEMPLATES,
  buildDayContent,
  templateFromTitle,
  type LibraryExercise,
} from "@/lib/fitness/generator";
import type { DayType, DraftDay, DraftExercise, ExerciseRow, FocusScores } from "@/lib/fitness/types";

const DAY_TYPES: DayType[] = ["gym", "home", "cardio", "recovery", "rest"];
const CARDIO = new Set(["cardio", "running", "cycling", "basketball"]);

type NumericField = "targetSets" | "targetReps" | "targetWeight" | "targetDurationSeconds";

/**
 * Week-by-week editor for a plan's schedule: change each day's type (which
 * rebuilds that day's workout), rename it, and add / swap / reorder / remove
 * exercises or tweak their targets. Structural edits also apply to the same
 * weekday in other weeks when that day currently has the identical workout,
 * so a "weekly" split stays consistent without editing four times.
 */
export function PlanScheduleEditor({
  days,
  onChange,
  library,
  focus,
}: {
  days: DraftDay[];
  onChange: (days: DraftDay[]) => void;
  library: LibraryExercise[];
  focus: FocusScores;
}) {
  const weeks = [...new Set(days.map((d) => d.weekNumber))].sort((a, b) => a - b);
  const [week, setWeek] = useState(weeks[0] ?? 1);
  const [syncWeeks, setSyncWeeks] = useState(true);
  const [picker, setPicker] = useState<{ dayIdx: number; exIdx: number | null } | null>(null);
  const [editing, setEditing] = useState<Set<number>>(new Set());
  // Each rebuild uses a fresh seed so "Rebuild as…" gives new exercises.
  const seedRef = useRef(1000);

  const signature = (d: DraftDay) => `${d.dayType}|${d.exercises.map((e) => e.exerciseId).join(",")}`;

  /** Applies `fn` to day `idx`, plus matching days in other weeks when syncing. */
  function edit(idx: number, fn: (day: DraftDay) => DraftDay, structural = true) {
    const source = days[idx];
    const sig = signature(source);
    onChange(
      days.map((d, i) => {
        if (i === idx) return fn(d);
        if (
          structural &&
          syncWeeks &&
          d.weekNumber !== source.weekNumber &&
          d.dayOfWeek === source.dayOfWeek &&
          signature(d) === sig
        ) {
          return fn(d);
        }
        return d;
      }),
    );
  }

  function changeType(idx: number, dayType: DayType) {
    const current = days[idx];
    const content = buildDayContent(dayType, library, focus, ++seedRef.current, {
      strengthTemplate: templateFromTitle(current.title),
    });
    edit(idx, (d) => ({ ...d, dayType, title: content.title, exercises: content.exercises }));
  }

  function changeTemplate(idx: number, template: string) {
    const current = days[idx];
    const content = buildDayContent(current.dayType, library, focus, ++seedRef.current, {
      strengthTemplate: template,
    });
    edit(idx, (d) => ({ ...d, title: content.title, exercises: content.exercises }));
  }

  function toDraft(ex: ExerciseRow): DraftExercise {
    return { exerciseId: ex.id, name: ex.name, category: ex.category, ...defaultTargets(ex.category) };
  }

  function handlePick(ex: ExerciseRow) {
    if (!picker) return;
    const { dayIdx, exIdx } = picker;
    edit(dayIdx, (d) => ({
      ...d,
      exercises:
        exIdx === null
          ? [...d.exercises, toDraft(ex)]
          : d.exercises.map((e, i) =>
              i === exIdx ? { ...e, exerciseId: ex.id, name: ex.name, category: ex.category } : e,
            ),
    }));
  }

  function move(dayIdx: number, exIdx: number, delta: number) {
    edit(dayIdx, (d) => {
      const next = [...d.exercises];
      const target = exIdx + delta;
      if (target < 0 || target >= next.length) return d;
      [next[exIdx], next[target]] = [next[target], next[exIdx]];
      return { ...d, exercises: next };
    });
  }

  function setTarget(dayIdx: number, exIdx: number, field: NumericField, raw: string) {
    const value = raw.trim() === "" ? null : Number(raw);
    if (value !== null && (Number.isNaN(value) || value < 0)) return;
    const stored = field === "targetDurationSeconds" && value !== null ? Math.round(value) : value;
    edit(
      dayIdx,
      (d) => ({
        ...d,
        exercises: d.exercises.map((e, i) => (i === exIdx ? { ...e, [field]: stored } : e)),
      }),
      false,
    );
  }

  function toggleEditing(idx: number) {
    setEditing((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  const weekDays = days
    .map((d, idx) => ({ d, idx }))
    .filter(({ d }) => d.weekNumber === week);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-md bg-neutral-100 p-1 dark:bg-neutral-800">
          {weeks.map((w) => (
            <button
              key={w}
              onClick={() => setWeek(w)}
              className={cn(
                "rounded px-3 py-1 text-sm font-medium",
                week === w
                  ? "bg-white shadow-sm dark:bg-neutral-950"
                  : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400",
              )}
            >
              Week {w}
            </button>
          ))}
        </div>
        {weeks.length > 1 && (
          <label className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
            <input type="checkbox" checked={syncWeeks} onChange={(e) => setSyncWeeks(e.target.checked)} />
            Apply changes to the same day in other weeks
          </label>
        )}
      </div>

      {weekDays.map(({ d, idx }) => (
        <div key={`${d.scheduledDate}-${idx}`} className={cn(cardClass, "space-y-2", d.dayType === "rest" && "opacity-80")}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-24 shrink-0 text-sm font-semibold">{formatDay(d.scheduledDate)}</span>
            <select
              value={d.dayType}
              onChange={(e) => changeType(idx, e.target.value as DayType)}
              className={selectClass}
              aria-label="Day type"
            >
              {DAY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {DAY_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            {(d.dayType === "gym" || d.dayType === "home") && (
              <select
                value=""
                onChange={(e) => e.target.value && changeTemplate(idx, e.target.value)}
                className={selectClass}
                aria-label="Rebuild as"
              >
                <option value="">Rebuild as…</option>
                {STRENGTH_TEMPLATES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            )}
          </div>

          {d.dayType !== "rest" && (
            <>
              {editing.has(idx) ? (
                <Input
                  value={d.title}
                  onChange={(e) => edit(idx, (day) => ({ ...day, title: e.target.value }), false)}
                  aria-label="Workout name"
                  className="font-medium"
                />
              ) : (
                <p className="font-medium">{d.title}</p>
              )}
              {d.notes && <p className="text-xs text-amber-700 dark:text-amber-400">{d.notes}</p>}

              <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {d.exercises.map((ex, exIdx) => (
                  <ExerciseRowEditor
                    key={`${ex.exerciseId}-${exIdx}`}
                    ex={ex}
                    expanded={editing.has(idx)}
                    first={exIdx === 0}
                    last={exIdx === d.exercises.length - 1}
                    onField={(field, raw) => setTarget(idx, exIdx, field, raw)}
                    onUp={() => move(idx, exIdx, -1)}
                    onDown={() => move(idx, exIdx, 1)}
                    onSwap={() => setPicker({ dayIdx: idx, exIdx })}
                    onRemove={() =>
                      edit(idx, (day) => ({ ...day, exercises: day.exercises.filter((_, i) => i !== exIdx) }))
                    }
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-1">
                <Button variant="ghost" className="px-2 text-xs" onClick={() => toggleEditing(idx)}>
                  {editing.has(idx) ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                  {editing.has(idx) ? "Done editing" : "Edit workout"}
                </Button>
                <Button variant="ghost" className="px-2 text-xs" onClick={() => setPicker({ dayIdx: idx, exIdx: null })}>
                  <Plus className="h-3.5 w-3.5" />
                  Add exercise
                </Button>
              </div>
            </>
          )}
          {d.dayType === "rest" && <DayTypeBadge type="rest" />}
        </div>
      ))}

      <ExercisePicker open={picker !== null} onClose={() => setPicker(null)} onSelect={handlePick} />
    </div>
  );
}

function ExerciseRowEditor({
  ex,
  expanded,
  first,
  last,
  onField,
  onUp,
  onDown,
  onSwap,
  onRemove,
}: {
  ex: DraftExercise;
  expanded: boolean;
  first: boolean;
  last: boolean;
  onField: (field: NumericField, raw: string) => void;
  onUp: () => void;
  onDown: () => void;
  onSwap: () => void;
  onRemove: () => void;
}) {
  const timed = ex.targetDurationSeconds !== null && ex.targetReps === null;
  // Cardio targets read better in minutes; everything else timed is in seconds.
  const minutes = timed && CARDIO.has(ex.category);
  const small =
    "w-14 rounded border border-neutral-300 bg-white px-1.5 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900";
  const iconBtn =
    "rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-30 dark:hover:bg-neutral-800";

  return (
    <div className="py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm">{ex.name}</p>
          <p className="text-xs text-neutral-500">
            {describeTarget(ex)}
            {ex.notes ? ` · ${ex.notes}` : ""}
          </p>
        </div>
        {expanded && (
          <div className="flex shrink-0 items-center">
            <button className={iconBtn} onClick={onUp} disabled={first} aria-label="Move up">
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button className={iconBtn} onClick={onDown} disabled={last} aria-label="Move down">
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
            <button className={iconBtn} onClick={onSwap} aria-label="Swap exercise">
              <Replace className="h-3.5 w-3.5" />
            </button>
            <button className={cn(iconBtn, "hover:text-red-500")} onClick={onRemove} aria-label="Remove exercise">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
      {expanded && (
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
          <label className="flex items-center gap-1">
            Sets
            <input
              inputMode="numeric"
              defaultValue={ex.targetSets ?? ""}
              onBlur={(e) => onField("targetSets", e.target.value)}
              className={small}
            />
          </label>
          {timed ? (
            <label className="flex items-center gap-1">
              {minutes ? "Min" : "Secs"}
              <input
                inputMode="numeric"
                defaultValue={
                  ex.targetDurationSeconds === null
                    ? ""
                    : minutes
                      ? Math.round(ex.targetDurationSeconds / 60)
                      : ex.targetDurationSeconds
                }
                onBlur={(e) =>
                  onField(
                    "targetDurationSeconds",
                    minutes && e.target.value.trim() !== "" ? String(Number(e.target.value) * 60) : e.target.value,
                  )
                }
                className={small}
              />
            </label>
          ) : (
            <label className="flex items-center gap-1">
              Reps
              <input
                inputMode="numeric"
                defaultValue={ex.targetReps ?? ""}
                onBlur={(e) => onField("targetReps", e.target.value)}
                className={small}
              />
            </label>
          )}
          {!CARDIO.has(ex.category) && ex.category !== "mobility" && (
            <label className="flex items-center gap-1">
              lb
              <input
                inputMode="decimal"
                defaultValue={ex.targetWeight ?? ""}
                onBlur={(e) => onField("targetWeight", e.target.value)}
                className={small}
              />
            </label>
          )}
        </div>
      )}
    </div>
  );
}
