import { estimateOneRepMax } from "@/lib/fitness/pr";
import type { SetStats } from "@/lib/fitness/types";

export type StatSet = {
  reps: number | null;
  weight: string | number | null;
  durationSeconds: number | null;
  distance: string | number | null;
};

export function emptyStats(): SetStats {
  return {
    sets: 0,
    reps: 0,
    volume: 0,
    durationSeconds: 0,
    distance: 0,
    maxWeight: 0,
    bestE1rm: 0,
    maxReps: 0,
    maxDurationSeconds: 0,
  };
}

/** Rolls up reps / weight / time for any group of logged sets. */
export function computeSetStats(sets: StatSet[]): SetStats {
  const out = emptyStats();
  for (const s of sets) {
    const reps = s.reps ?? 0;
    const weight = s.weight == null ? 0 : Number(s.weight);
    const duration = s.durationSeconds ?? 0;
    out.sets += 1;
    out.reps += reps;
    out.volume += weight * reps;
    out.durationSeconds += duration;
    out.distance += s.distance == null ? 0 : Number(s.distance);
    out.maxWeight = Math.max(out.maxWeight, weight);
    out.maxReps = Math.max(out.maxReps, reps);
    out.maxDurationSeconds = Math.max(out.maxDurationSeconds, duration);
    if (weight > 0 && reps > 0) out.bestE1rm = Math.max(out.bestE1rm, estimateOneRepMax(weight, reps));
  }
  out.volume = Math.round(out.volume * 100) / 100;
  out.distance = Math.round(out.distance * 1000) / 1000;
  return out;
}

export function mergeStats(a: SetStats, b: SetStats): SetStats {
  return {
    sets: a.sets + b.sets,
    reps: a.reps + b.reps,
    volume: Math.round((a.volume + b.volume) * 100) / 100,
    durationSeconds: a.durationSeconds + b.durationSeconds,
    distance: Math.round((a.distance + b.distance) * 1000) / 1000,
    maxWeight: Math.max(a.maxWeight, b.maxWeight),
    bestE1rm: Math.max(a.bestE1rm, b.bestE1rm),
    maxReps: Math.max(a.maxReps, b.maxReps),
    maxDurationSeconds: Math.max(a.maxDurationSeconds, b.maxDurationSeconds),
  };
}

export type ProgressMetric = "e1rm" | "reps" | "duration" | "none";

/** The headline number for an exercise: est. 1RM when weighted, else best reps, else longest time. */
export function headlineMetric(stats: SetStats): { metric: ProgressMetric; value: number } {
  if (stats.bestE1rm > 0) return { metric: "e1rm", value: stats.bestE1rm };
  if (stats.maxReps > 0) return { metric: "reps", value: stats.maxReps };
  if (stats.maxDurationSeconds > 0) return { metric: "duration", value: stats.maxDurationSeconds };
  return { metric: "none", value: 0 };
}

/** Relative change of the headline metric between two sessions, or null if not comparable. */
export function percentChange(before: SetStats, after: SetStats): number | null {
  const a = headlineMetric(before);
  const b = headlineMetric(after);
  if (a.metric === "none" || a.metric !== b.metric || a.value === 0) return null;
  return (b.value - a.value) / a.value;
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return sec ? `${m}m ${sec}s` : `${m}m`;
  return `${sec}s`;
}

export function formatNumber(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}
