"use client";

import { useEffect, useState } from "react";
import { Dumbbell, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { WorkoutSession } from "./workout-session";
import type {
  ExerciseRow,
  LoggedExerciseRow,
  PlanDayRow,
  PlanDetail,
  PlanRow,
  WorkoutLogRow,
} from "@/lib/fitness/types";

export function TodayTab() {
  const [activePlans, setActivePlans] = useState<PlanRow[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [planDetail, setPlanDetail] = useState<PlanDetail | null>(null);
  const [selectedDayId, setSelectedDayId] = useState<string>("");
  const [starting, setStarting] = useState(false);

  const [session, setSession] = useState<{
    workoutLogId: string;
    exercises: { loggedExercise: LoggedExerciseRow; info: ExerciseRow }[];
    targets: Record<string, PlanDayRow["exercises"][number]>;
  } | null>(null);

  useEffect(() => {
    apiFetch<{ plans: PlanRow[] }>("/api/fitness/plans")
      .then((res) => setActivePlans(res.plans.filter((p) => p.status === "active")))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedPlanId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPlanDetail(null);
      return;
    }
    apiFetch<PlanDetail>(`/api/fitness/plans/${selectedPlanId}`)
      .then((detail) => {
        setPlanDetail(detail);
        setSelectedDayId(detail.days[0]?.id ?? "");
      })
      .catch(() => {});
  }, [selectedPlanId]);

  async function startFreeform() {
    setStarting(true);
    try {
      const { log } = await apiFetch<{ log: WorkoutLogRow }>("/api/fitness/workouts", {
        method: "POST",
        body: JSON.stringify({ date: new Date().toISOString().slice(0, 10) }),
      });
      setSession({ workoutLogId: log.id, exercises: [], targets: {} });
    } finally {
      setStarting(false);
    }
  }

  async function startPlanDay() {
    const day = planDetail?.days.find((d) => d.id === selectedDayId);
    if (!day) return;
    setStarting(true);
    try {
      const { log } = await apiFetch<{ log: WorkoutLogRow }>("/api/fitness/workouts", {
        method: "POST",
        body: JSON.stringify({
          planId: selectedPlanId,
          planDayId: day.id,
          date: new Date().toISOString().slice(0, 10),
        }),
      });

      const exercises: { loggedExercise: LoggedExerciseRow; info: ExerciseRow }[] = [];
      const targets: Record<string, PlanDayRow["exercises"][number]> = {};
      for (const [i, target] of day.exercises.entries()) {
        const [{ loggedExercise }, { exercise }] = await Promise.all([
          apiFetch<{ loggedExercise: LoggedExerciseRow }>(
            `/api/fitness/workouts/${log.id}/exercises`,
            { method: "POST", body: JSON.stringify({ exerciseId: target.exerciseId, orderIndex: i }) },
          ),
          apiFetch<{ exercise: ExerciseRow }>(`/api/fitness/exercises/${target.exerciseId}`),
        ]);
        exercises.push({ loggedExercise: { ...loggedExercise, sets: [] }, info: exercise });
        targets[target.exerciseId] = target;
      }

      setSession({ workoutLogId: log.id, exercises, targets });
    } finally {
      setStarting(false);
    }
  }

  if (session) {
    return (
      <WorkoutSession
        workoutLogId={session.workoutLogId}
        initialExercises={session.exercises}
        targets={session.targets}
        onFinish={() => setSession(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-2 text-sm font-semibold">Start a workout</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={startFreeform} disabled={starting}>
            <Play className="h-4 w-4" />
            Freeform / quick log
          </Button>
        </div>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          Log any exercise on the fly — pickup basketball, a freeform run, or an
          unplanned lift. Add exercises as you go.
        </p>
      </div>

      {activePlans.length > 0 && (
        <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Dumbbell className="h-4 w-4" />
            Follow a plan
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              className="rounded-md border border-neutral-300 bg-white px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            >
              <option value="">Choose a plan...</option>
              {activePlans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
            {planDetail && (
              <select
                value={selectedDayId}
                onChange={(e) => setSelectedDayId(e.target.value)}
                className="rounded-md border border-neutral-300 bg-white px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
              >
                {planDetail.days.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </select>
            )}
            <Button
              variant="secondary"
              onClick={startPlanDay}
              disabled={!selectedDayId || starting}
            >
              Start this day
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
