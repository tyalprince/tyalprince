"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api-client";
import type { GoalRow } from "@/lib/fitness/types";

function timeProgress(createdAt: string, targetDate: string | null): number | null {
  if (!targetDate) return null;
  const start = new Date(createdAt).getTime();
  const end = new Date(targetDate).getTime();
  const now = Date.now();
  if (end <= start) return null;
  return Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
}

export function GoalsTab() {
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  function load() {
    apiFetch<{ goals: GoalRow[] }>("/api/fitness/goals")
      .then((res) => setGoals(res.goals))
      .catch(() => {});
  }

  useEffect(load, []);

  async function updateStatus(goal: GoalRow, status: GoalRow["status"]) {
    await apiFetch(`/api/fitness/goals/${goal.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    load();
  }

  async function remove(goal: GoalRow) {
    if (!confirm(`Delete goal "${goal.title}"?`)) return;
    await apiFetch(`/api/fitness/goals/${goal.id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          New goal
        </Button>
      </div>

      {goals.length === 0 ? (
        <p className="text-center text-sm text-neutral-500">
          No goals yet — set one to start tracking progress.
        </p>
      ) : (
        <div className="space-y-3">
          {goals.map((g) => {
            const progress = timeProgress(g.createdAt, g.targetDate);
            return (
              <div
                key={g.id}
                className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{g.title}</p>
                    <p className="text-xs capitalize text-neutral-500">
                      {g.goalType}
                      {g.targetMetric ? ` · ${g.targetMetric}` : ""}
                      {g.targetValue ? ` · target ${g.targetValue}` : ""}
                    </p>
                  </div>
                  <select
                    value={g.status}
                    onChange={(e) => updateStatus(g, e.target.value as GoalRow["status"])}
                    className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900"
                  >
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="abandoned">Abandoned</option>
                  </select>
                </div>
                {g.description && (
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                    {g.description}
                  </p>
                )}
                {progress !== null && (
                  <div className="mt-2">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                      <div
                        className="h-full bg-indigo-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-neutral-400">
                      {Math.round(progress)}% of time to target date elapsed
                    </p>
                  </div>
                )}
                <button
                  onClick={() => remove(g)}
                  className="mt-2 text-xs text-neutral-400 underline hover:text-red-500"
                >
                  Delete
                </button>
              </div>
            );
          })}
        </div>
      )}

      <NewGoalDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={() => {
          setDialogOpen(false);
          load();
        }}
      />
    </div>
  );
}

function NewGoalDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [goalType, setGoalType] = useState<GoalRow["goalType"]>("strength");
  const [targetMetric, setTargetMetric] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await apiFetch("/api/fitness/goals", {
        method: "POST",
        body: JSON.stringify({
          title,
          goalType,
          targetMetric: targetMetric || null,
          targetValue: targetValue ? Number(targetValue) : null,
          targetDate: targetDate || null,
        }),
      });
      setTitle("");
      setTargetMetric("");
      setTargetValue("");
      setTargetDate("");
      onCreated();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="New goal">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1">
          <label className="text-sm font-medium">Title</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Bench 225 lbs x5"
            required
            autoFocus
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Type</label>
          <select
            value={goalType}
            onChange={(e) => setGoalType(e.target.value as GoalRow["goalType"])}
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          >
            <option value="strength">Strength</option>
            <option value="endurance">Endurance</option>
            <option value="weight">Weight</option>
            <option value="skill">Skill</option>
            <option value="sport">Sport</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">Target metric</label>
            <Input
              value={targetMetric}
              onChange={(e) => setTargetMetric(e.target.value)}
              placeholder="e.g. 5k time"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Target value</label>
            <Input value={targetValue} onChange={(e) => setTargetValue(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Target date</label>
          <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving..." : "Create goal"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
