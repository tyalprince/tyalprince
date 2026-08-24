"use client";

import { evaluateStrength } from "@/lib/crypto/strength";
import { cn } from "@/lib/utils";

const LEVEL_LABEL: Record<number, string> = {
  0: "Very weak",
  1: "Weak",
  2: "Fair",
  3: "Strong",
  4: "Very strong",
};

const LEVEL_COLOR: Record<number, string> = {
  0: "bg-red-500",
  1: "bg-orange-500",
  2: "bg-yellow-500",
  3: "bg-lime-500",
  4: "bg-green-500",
};

export function StrengthMeter({ password }: { password: string }) {
  const result = evaluateStrength(password);
  return (
    <div className="space-y-1">
      <div className="flex h-1.5 gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={cn(
              "flex-1 rounded-full bg-neutral-200 dark:bg-neutral-800",
              i <= result.score && LEVEL_COLOR[result.score],
            )}
          />
        ))}
      </div>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        {LEVEL_LABEL[result.score]} &middot; crack time (offline): {result.crackTimeDisplay}
      </p>
    </div>
  );
}
