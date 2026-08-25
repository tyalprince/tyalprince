"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function RestTimer({
  seconds,
  onDismiss,
}: {
  seconds: number;
  onDismiss: () => void;
}) {
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(true);
  const audioCtxRef = useRef<AudioContext | null>(null);

  function playChime() {
    try {
      const ctx =
        audioCtxRef.current ??
        new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      audioCtxRef.current = ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch {
      // Audio isn't critical — ignore if unavailable.
    }
  }

  useEffect(() => {
    if (!running) return;
    if (remaining <= 0) {
      playChime();
      return;
    }
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [running, remaining]);

  return (
    <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-2 dark:border-neutral-800 dark:bg-neutral-900">
      <span className="font-mono text-lg font-semibold tabular-nums">
        {remaining > 0 ? formatTime(remaining) : "Rest done"}
      </span>
      <Button variant="ghost" className="px-2" onClick={() => setRunning((r) => !r)}>
        {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <Button variant="ghost" className="px-2" onClick={() => setRemaining((r) => r + 15)}>
        <Plus className="h-4 w-4" />
        15s
      </Button>
      <Button variant="ghost" className="ml-auto px-2" onClick={onDismiss} aria-label="Dismiss">
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
