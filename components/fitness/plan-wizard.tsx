"use client";

import { useState } from "react";
import { ChevronLeft, Minus, Plus, RefreshCw, Repeat, Repeat2, Shuffle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api-client";
import { PlanScheduleEditor } from "./plan-schedule-editor";
import { DayTypeBadge, cardClass, localToday, useExerciseLibrary } from "./shared";
import {
  WEEKDAY_LABELS,
  addDays,
  generatePlan,
  layoutWeek,
  trainingDayCount,
  weekdayIndex,
} from "@/lib/fitness/generator";
import {
  FOCUS_KEYS,
  type FocusKey,
  type FocusScores,
  type PlanDraft,
  type PlanRow,
  type SplitType,
  type WeeklyMix,
} from "@/lib/fitness/types";

const FOCUS_INFO: Record<FocusKey, { label: string; hint: string }> = {
  strength: { label: "Strength", hint: "Lift heavier — low reps, long rest" },
  hypertrophy: { label: "Hypertrophy", hint: "Build muscle — moderate reps, more volume" },
  endurance: { label: "Endurance", hint: "Cardio engine & muscular stamina" },
  flexibility: { label: "Flexibility", hint: "Mobility work & stretching" },
  stability: { label: "Stability", hint: "Core, balance & joint control" },
  athleticism: { label: "Athleticism", hint: "Power, speed, agility & jumps" },
};

const MIX_INFO: { key: keyof WeeklyMix; label: string; hint: string }[] = [
  { key: "gym", label: "Gym workouts", hint: "Full equipment strength sessions" },
  { key: "home", label: "Home workouts", hint: "Bodyweight, dumbbells, kettlebells, bands" },
  { key: "cardio", label: "Cardio days", hint: "Runs, rides, intervals, conditioning" },
  { key: "recovery", label: "Recover & stretch", hint: "Mobility, foam rolling, reload" },
];

const SPLIT_INFO: { key: SplitType; label: string; hint: string; Icon: typeof Repeat }[] = [
  { key: "weekly", label: "Weekly", hint: "Same workouts every week — easiest to track progress", Icon: Repeat },
  { key: "biweekly", label: "Bi-weekly (A/B)", hint: "Two alternating weeks for more variety", Icon: Repeat2 },
  { key: "randomized", label: "Randomized", hint: "Fresh exercises and day order every week", Icon: Shuffle },
];

const STEPS = ["Name", "Focus", "Days", "Split", "Review"] as const;

export function PlanWizard({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (plan: PlanRow) => void;
}) {
  const library = useExerciseLibrary();
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [focus, setFocus] = useState<FocusScores>({
    strength: 6,
    hypertrophy: 6,
    endurance: 4,
    flexibility: 4,
    stability: 4,
    athleticism: 4,
  });
  const [mix, setMix] = useState<WeeklyMix>({ gym: 3, home: 0, cardio: 1, recovery: 1 });
  const [startDate, setStartDate] = useState(localToday());
  const [splitType, setSplitType] = useState<SplitType>("weekly");
  const [progressive, setProgressive] = useState(true);
  const [seed, setSeed] = useState(1);
  const [draft, setDraft] = useState<PlanDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = trainingDayCount(mix);
  const canNext = [title.trim().length > 0, true, total > 0 && total <= 7, true][step] ?? true;

  function generate(nextSeed = seed) {
    if (!library) return;
    setSeed(nextSeed);
    setDraft(
      generatePlan(
        { title: title.trim(), focus, weeklyMix: mix, splitType, progressive, startDate, seed: nextSeed },
        library,
      ),
    );
    setStep(4);
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const { plan } = await apiFetch<{ plan: PlanRow }>("/api/fitness/plans/build", {
        method: "POST",
        body: JSON.stringify({
          ...draft,
          title: title.trim(),
          days: draft.days.map((d) => ({
            ...d,
            exercises: d.exercises.map((e) => ({
              exerciseId: e.exerciseId,
              targetSets: e.targetSets,
              targetReps: e.targetReps,
              targetWeight: e.targetWeight,
              targetDurationSeconds: e.targetDurationSeconds,
              targetRestSeconds: e.targetRestSeconds,
              notes: e.notes,
            })),
          })),
        }),
      });
      onCreated(plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save plan");
    } finally {
      setSaving(false);
    }
  }

  const preview = layoutWeek(mix);
  const startWeekday = weekdayIndex(startDate);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => (step === 0 ? onCancel() : setStep(step - 1))}
          className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
        >
          <ChevronLeft className="h-4 w-4" />
          {step === 0 ? "Cancel" : "Back"}
        </button>
        <span className="text-xs text-neutral-500">
          Step {step + 1} of {STEPS.length} · {STEPS[step]}
        </span>
      </div>
      <div className="flex gap-1">
        {STEPS.map((s, i) => (
          <div
            key={s}
            className={cn("h-1 flex-1 rounded-full", i <= step ? "bg-indigo-500" : "bg-neutral-200 dark:bg-neutral-800")}
          />
        ))}
      </div>

      {step === 0 && (
        <div className={cn(cardClass, "space-y-3")}>
          <h2 className="text-lg font-semibold">Build a workout plan</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Answer a few questions and we&apos;ll generate a 4-week plan you can review and edit before you start.
          </p>
          <label className="block space-y-1">
            <span className="text-sm font-medium">What do you want to call it?</span>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Fall Strength Block"
              autoFocus
              maxLength={200}
              onKeyDown={(e) => e.key === "Enter" && canNext && setStep(1)}
            />
          </label>
        </div>
      )}

      {step === 1 && (
        <div className={cn(cardClass, "space-y-4")}>
          <div>
            <h2 className="text-lg font-semibold">What&apos;s your focus?</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Rate each from 1 (don&apos;t care) to 10 (top priority). This shapes sets, reps, rest and the extras in each workout.
            </p>
          </div>
          {FOCUS_KEYS.map((key) => (
            <label key={key} className="block">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium">{FOCUS_INFO[key].label}</span>
                <span className="text-sm font-semibold tabular-nums">{focus[key]}</span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={focus[key]}
                onChange={(e) => setFocus({ ...focus, [key]: Number(e.target.value) })}
                className="w-full accent-indigo-500"
              />
              <span className="text-xs text-neutral-500">{FOCUS_INFO[key].hint}</span>
            </label>
          ))}
        </div>
      )}

      {step === 2 && (
        <div className={cn(cardClass, "space-y-4")}>
          <div>
            <h2 className="text-lg font-semibold">How many days a week?</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Mix gym, home, cardio and recovery days. Whatever&apos;s left over is a rest day.
            </p>
          </div>
          {MIX_INFO.map(({ key, label, hint }) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-neutral-500">{hint}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  className="h-8 w-8 p-0"
                  onClick={() => setMix({ ...mix, [key]: Math.max(0, mix[key] - 1) })}
                  disabled={mix[key] === 0}
                  aria-label={`Fewer ${label}`}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-5 text-center font-semibold tabular-nums">{mix[key]}</span>
                <Button
                  variant="secondary"
                  className="h-8 w-8 p-0"
                  onClick={() => setMix({ ...mix, [key]: mix[key] + 1 })}
                  disabled={total >= 7}
                  aria-label={`More ${label}`}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          <p className="text-sm">
            <span className="font-semibold">{total}</span> training days ·{" "}
            <span className="font-semibold">{7 - total}</span> rest days
          </p>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Start date</span>
            <Input type="date" value={startDate} onChange={(e) => e.target.value && setStartDate(e.target.value)} />
          </label>
          <div>
            <p className="mb-1 text-xs text-neutral-500">Your week will look like:</p>
            <div className="grid grid-cols-7 gap-1">
              {preview.map((type, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <span className="text-[10px] text-neutral-500">{WEEKDAY_LABELS[(startWeekday + i) % 7]}</span>
                  <DayTypeBadge type={type} compact className="w-full justify-center py-1.5" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className={cn(cardClass, "space-y-3")}>
          <div>
            <h2 className="text-lg font-semibold">How should the weeks vary?</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">This decides your 4-week split.</p>
          </div>
          {SPLIT_INFO.map(({ key, label, hint, Icon }) => (
            <button
              key={key}
              onClick={() => setSplitType(key)}
              className={cn(
                "flex w-full items-start gap-3 rounded-lg border p-3 text-left",
                splitType === key
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40"
                  : "border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800",
              )}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <span className="block text-sm font-medium">{label}</span>
                <span className="block text-xs text-neutral-500">{hint}</span>
              </span>
            </button>
          ))}
          <label className="flex items-start gap-2 pt-1 text-sm">
            <input
              type="checkbox"
              checked={progressive}
              onChange={(e) => setProgressive(e.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="font-medium">Progressive overload</span>
              <span className="block text-xs text-neutral-500">
                Add reps in week 2, a set in week 3, then a lighter deload in week 4.
              </span>
            </span>
          </label>
        </div>
      )}

      {step === 4 && draft && library && (
        <div className="space-y-3">
          <div className={cn(cardClass, "space-y-1")}>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {draft.weeks} weeks · {formatRange(draft.startDate, addDays(draft.startDate, draft.weeks * 7 - 1))}. Review
              each day — change its type, swap exercises, or edit sets, reps and weight — then confirm.
            </p>
          </div>
          <PlanScheduleEditor
            days={draft.days}
            onChange={(days) => setDraft({ ...draft, days })}
            library={library}
            focus={focus}
          />
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap justify-end gap-2">
        {step < 3 && (
          <Button onClick={() => setStep(step + 1)} disabled={!canNext}>
            Next
          </Button>
        )}
        {step === 3 && (
          <Button onClick={() => generate()} disabled={!library}>
            <Sparkles className="h-4 w-4" />
            {library ? "Generate 4-week plan" : "Loading exercises…"}
          </Button>
        )}
        {step === 4 && (
          <>
            <Button
              variant="secondary"
              onClick={() => {
                if (confirm("Regenerate the whole plan? Your edits will be lost.")) generate(seed + 1);
              }}
            >
              <RefreshCw className="h-4 w-4" />
              Regenerate
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Confirm & start plan"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function formatRange(start: string, end: string) {
  const fmt = (d: string) =>
    new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}
