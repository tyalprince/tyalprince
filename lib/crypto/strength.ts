import zxcvbn from "zxcvbn";

export type StrengthLevel = "very-weak" | "weak" | "fair" | "strong" | "very-strong";

export type StrengthResult = {
  score: 0 | 1 | 2 | 3 | 4;
  level: StrengthLevel;
  crackTimeDisplay: string;
};

const LEVELS: StrengthLevel[] = [
  "very-weak",
  "weak",
  "fair",
  "strong",
  "very-strong",
];

export function evaluateStrength(password: string): StrengthResult {
  if (!password) {
    return { score: 0, level: "very-weak", crackTimeDisplay: "instant" };
  }
  const result = zxcvbn(password);
  const score = result.score as StrengthResult["score"];
  return {
    score,
    level: LEVELS[score],
    crackTimeDisplay: String(
      result.crack_times_display.offline_slow_hashing_1e4_per_second,
    ),
  };
}
