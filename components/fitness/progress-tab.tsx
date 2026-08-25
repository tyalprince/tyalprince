"use client";

import { useEffect, useMemo, useState } from "react";
import { Trophy } from "lucide-react";
import {
  Line,
  LineChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiFetch } from "@/lib/api-client";
import { CalendarHeatmap } from "./calendar-heatmap";
import { ExercisePicker } from "./exercise-picker";
import { Button } from "@/components/ui/button";
import { estimateOneRepMax } from "@/lib/fitness/pr";
import type { ExerciseRow, WorkoutLogRow } from "@/lib/fitness/types";
import type { PersonalRecord } from "@/lib/fitness/pr";

type SetHistoryRow = {
  setId: string;
  reps: number | null;
  weight: string | null;
  durationSeconds: number | null;
  distance: string | null;
  date: string | null;
};

export function ProgressTab() {
  const [logs, setLogs] = useState<WorkoutLogRow[]>([]);
  const [records, setRecords] = useState<PersonalRecord[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<ExerciseRow | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [history, setHistory] = useState<SetHistoryRow[]>([]);

  useEffect(() => {
    apiFetch<{ logs: WorkoutLogRow[] }>("/api/fitness/workouts")
      .then((res) => setLogs(res.logs))
      .catch(() => {});
    apiFetch<{ records: PersonalRecord[] }>("/api/fitness/prs")
      .then((res) => setRecords(res.records))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedExercise) return;
    apiFetch<{ history: SetHistoryRow[] }>(
      `/api/fitness/exercises/${selectedExercise.id}/history`,
    )
      .then((res) => setHistory(res.history))
      .catch(() => setHistory([]));
  }, [selectedExercise]);

  const chartData = useMemo(() => {
    if (!selectedExercise) return [];
    const isEndurance = ["cardio", "running", "cycling"].includes(selectedExercise.category);
    return history
      .map((h) => {
        if (isEndurance) {
          const distance = h.distance ? Number(h.distance) : null;
          const duration = h.durationSeconds;
          if (!distance || !duration) return null;
          return {
            date: h.date?.slice(0, 10) ?? "",
            value: Math.round((duration / distance / 60) * 100) / 100, // min per unit
          };
        }
        if (!h.weight || !h.reps) return null;
        return {
          date: h.date?.slice(0, 10) ?? "",
          value: Math.round(estimateOneRepMax(Number(h.weight), h.reps) * 10) / 10,
        };
      })
      .filter((d): d is { date: string; value: number } => d !== null);
  }, [history, selectedExercise]);

  const weekCount = useMemo(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return logs.filter((l) => new Date(l.date) >= weekAgo).length;
  }, [logs]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Consistency</h2>
          <span className="text-xs text-neutral-500">{weekCount} workouts this week</span>
        </div>
        <CalendarHeatmap dates={logs.map((l) => l.date)} />
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Progression</h2>
          <Button variant="secondary" onClick={() => setPickerOpen(true)}>
            {selectedExercise ? selectedExercise.name : "Choose exercise"}
          </Button>
        </div>
        {selectedExercise ? (
          chartData.length > 0 ? (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="text-neutral-200 dark:text-neutral-800" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={48} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-neutral-500">No logged sets for this exercise yet.</p>
          )
        ) : (
          <p className="text-sm text-neutral-500">
            Pick an exercise to see its estimated 1RM or pace trend over time.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Trophy className="h-4 w-4" />
          Personal records
        </h2>
        {records.length === 0 ? (
          <p className="text-sm text-neutral-500">Log a few workouts to start tracking PRs.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {records.map((r) => (
                <tr key={r.exerciseId} className="border-t border-neutral-100 dark:border-neutral-900">
                  <td className="py-1.5">{r.exerciseName}</td>
                  <td className="py-1.5 text-right font-medium">
                    {r.metric === "estimated1RM"
                      ? `${Math.round(r.value)} lb (est. 1RM)`
                      : `${(r.value / 60).toFixed(2)} min/${r.unit ?? "unit"}`}
                  </td>
                  <td className="py-1.5 text-right text-xs text-neutral-400">
                    {r.achievedAt.slice(0, 10)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={setSelectedExercise}
      />
    </div>
  );
}
