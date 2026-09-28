import type {
  DayType,
  DraftDay,
  DraftExercise,
  ExerciseCategory,
  FocusScores,
  PlanDraft,
  SplitType,
  WeeklyMix,
} from "@/lib/fitness/types";

// Turns the plan wizard's answers (focus scores, weekly day mix, split
// style) into a concrete multi-week schedule. Pure and seeded, so it runs in
// the browser against the exercise library and "Regenerate" is just a new
// seed. Nothing here is persisted — the user reviews/edits the draft first.

export type LibraryExercise = {
  id: string;
  name: string;
  category: ExerciseCategory;
  muscleGroups: string[];
  equipment: string | null;
};

export type GeneratorInput = {
  title: string;
  focus: FocusScores;
  weeklyMix: WeeklyMix;
  splitType: SplitType;
  progressive: boolean;
  startDate: string; // YYYY-MM-DD
  weeks?: number;
  seed?: number;
};

export const DAY_TYPE_LABELS: Record<DayType, string> = {
  gym: "Gym",
  home: "Home",
  cardio: "Cardio",
  recovery: "Recover & stretch",
  rest: "Rest",
};

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const HOME_EQUIPMENT = new Set([
  null,
  "Bodyweight",
  "Dumbbell",
  "Kettlebell",
  "Band",
  "Resistance Band",
  "Stability Ball",
  "Medicine Ball",
  "Ab Wheel",
  "Plate",
  "Weighted",
]);

const TIMED_RE = /plank|hold|carry|crawl|wall sit|dead hang/i;
// Library entries that are events or long outings rather than a trainable session.
const CARDIO_EXCLUDE_RE =
  /race|marathon|century|trial|parkrun|event|commuter|bikepacking|group|social|class|zwift|criterium|warm-up|shakeout|hiking|swimming/i;
const INTERVAL_RE = /interval|sprint|repeats|tabata|hiit|fartlek|yasso|ladder|stair/i;
const STEADY_RE = /easy|steady|endurance|long run|elliptical|rowing|walk|treadmill run|recovery ride|road ride/i;
const POWER_RE = /box jump|broad jump|clean|snatch|push press|swing|thruster|slam|vertical jump/i;
const STABILITY_RE = /plank|pallof|carry|get-up|bear crawl|copenhagen|renegade|woodchopper|rollout/i;
const FINISHER_RE = /jump rope$|battle ropes|assault bike|rowing machine|sled|kettlebell complex|burpee|hiit/i;

type Scheme = { sets: number; reps: number; rest: number };
const SCHEMES: Record<"strength" | "hypertrophy" | "endurance", Scheme> = {
  strength: { sets: 5, reps: 5, rest: 180 },
  hypertrophy: { sets: 4, reps: 10, rest: 90 },
  endurance: { sets: 3, reps: 15, rest: 45 },
};

type Slot = { muscle: string; compound?: RegExp; accessory?: RegExp };

const COMPOUND: Record<string, RegExp> = {
  chest: /bench press|push-up|dip/i,
  shoulders: /overhead press|push press|landmine press/i,
  back: /row|pull-up|chin-up|pulldown/i,
  quads: /squat|leg press|lunge/i,
  hamstrings: /deadlift|good morning/i,
  glutes: /hip thrust|glute bridge|sumo deadlift/i,
};

const TEMPLATES: Record<string, Slot[]> = {
  Push: [
    { muscle: "chest", compound: COMPOUND.chest },
    { muscle: "shoulders", compound: COMPOUND.shoulders },
    { muscle: "chest" },
    { muscle: "shoulders", accessory: /lateral raise|front raise/i },
    { muscle: "triceps" },
    { muscle: "triceps" },
  ],
  Pull: [
    { muscle: "back", compound: /pull-up|chin-up|pulldown/i },
    { muscle: "back", compound: /row/i },
    { muscle: "back" },
    { muscle: "shoulders", accessory: /rear delt|face pull|reverse fly/i },
    { muscle: "biceps" },
    { muscle: "biceps" },
  ],
  Legs: [
    { muscle: "quads", compound: COMPOUND.quads },
    { muscle: "hamstrings", compound: COMPOUND.hamstrings },
    { muscle: "quads" },
    { muscle: "glutes", compound: COMPOUND.glutes },
    { muscle: "calves" },
  ],
  Upper: [
    { muscle: "chest", compound: COMPOUND.chest },
    { muscle: "back", compound: COMPOUND.back },
    { muscle: "shoulders", compound: COMPOUND.shoulders },
    { muscle: "back" },
    { muscle: "biceps" },
    { muscle: "triceps" },
  ],
  Lower: [
    { muscle: "quads", compound: COMPOUND.quads },
    { muscle: "hamstrings", compound: COMPOUND.hamstrings },
    { muscle: "glutes" },
    { muscle: "quads" },
    { muscle: "calves" },
    { muscle: "core" },
  ],
  "Full Body": [
    { muscle: "quads", compound: COMPOUND.quads },
    { muscle: "chest", compound: COMPOUND.chest },
    { muscle: "back", compound: COMPOUND.back },
    { muscle: "hamstrings", compound: COMPOUND.hamstrings },
    { muscle: "shoulders" },
    { muscle: "core" },
  ],
};

const SPLITS: Record<number, string[]> = {
  1: ["Full Body"],
  2: ["Upper", "Lower"],
  3: ["Push", "Pull", "Legs"],
  4: ["Upper", "Lower", "Upper", "Lower"],
  5: ["Push", "Pull", "Legs", "Upper", "Lower"],
  6: ["Push", "Pull", "Legs", "Push", "Pull", "Legs"],
  7: ["Push", "Pull", "Legs", "Upper", "Lower", "Full Body", "Full Body"],
};

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------

/** mulberry32 — tiny deterministic PRNG so the same seed rebuilds the same plan. */
export function createRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;

function pick<T>(rng: Rng, items: T[]): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.floor(rng() * items.length)];
}

function shuffle<T>(rng: Rng, items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 0 = Monday … 6 = Sunday for a YYYY-MM-DD date. */
export function weekdayIndex(isoDate: string): number {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return (d.getUTCDay() + 6) % 7;
}

export function trainingDayCount(mix: WeeklyMix): number {
  return mix.gym + mix.home + mix.cardio + mix.recovery;
}

// ---------------------------------------------------------------------------
// Weekly layout
// ---------------------------------------------------------------------------

/**
 * Places the week's day types across 7 slots: training days are spread out
 * evenly, and strength days are interleaved with cardio/recovery so two heavy
 * sessions don't land back-to-back when there's an alternative.
 */
export function layoutWeek(mix: WeeklyMix): DayType[] {
  const strength: DayType[] = [];
  for (let i = 0; i < Math.max(mix.gym, mix.home); i++) {
    if (i < mix.gym) strength.push("gym");
    if (i < mix.home) strength.push("home");
  }
  const other: DayType[] = [];
  for (let i = 0; i < Math.max(mix.cardio, mix.recovery); i++) {
    if (i < mix.cardio) other.push("cardio");
    if (i < mix.recovery) other.push("recovery");
  }

  const sequence: DayType[] = [];
  let lastWasStrength = false;
  while (strength.length || other.length) {
    // Take strength unless we just did one and there's something lighter
    // available — or strength is running ahead of the remaining slots.
    const takeStrength =
      strength.length > 0 &&
      (!lastWasStrength || other.length === 0 || strength.length > other.length + 1);
    if (takeStrength) {
      sequence.push(strength.shift()!);
      lastWasStrength = true;
    } else {
      sequence.push(other.shift()!);
      lastWasStrength = false;
    }
  }

  const n = Math.min(sequence.length, 7);
  const week: DayType[] = Array(7).fill("rest");
  for (let i = 0; i < n; i++) week[Math.floor((i * 7) / n)] = sequence[i];
  return week;
}

// ---------------------------------------------------------------------------
// Exercise selection
// ---------------------------------------------------------------------------

function mainScheme(focus: FocusScores): Scheme {
  const options: [keyof typeof SCHEMES, number][] = [
    ["strength", focus.strength],
    ["hypertrophy", focus.hypertrophy],
    ["endurance", focus.endurance * 0.8],
  ];
  options.sort((a, b) => b[1] - a[1]);
  return SCHEMES[options[0][0]];
}

function accessoryScheme(focus: FocusScores): Scheme {
  const options: [Scheme, number][] = [
    [SCHEMES.hypertrophy, focus.hypertrophy],
    [SCHEMES.endurance, focus.endurance],
    [{ sets: 4, reps: 8, rest: 120 }, focus.strength * 0.6],
  ];
  options.sort((a, b) => b[1] - a[1]);
  return { ...options[0][0], sets: Math.min(options[0][0].sets, 3) };
}

function isClean(ex: LibraryExercise) {
  // The generated library has "Single-Leg Barbell Row"-style variants that
  // read oddly in a starter plan; users can still add them by hand.
  return !/^single-(leg|arm) /i.test(ex.name);
}

function toDraft(
  ex: LibraryExercise,
  targets: Partial<Omit<DraftExercise, "exerciseId" | "name" | "category">>,
): DraftExercise {
  return {
    exerciseId: ex.id,
    name: ex.name,
    category: ex.category,
    targetSets: targets.targetSets ?? null,
    targetReps: targets.targetReps ?? null,
    targetWeight: targets.targetWeight ?? null,
    targetDurationSeconds: targets.targetDurationSeconds ?? null,
    targetRestSeconds: targets.targetRestSeconds ?? null,
    notes: targets.notes ?? null,
  };
}

class Picker {
  private used = new Set<string>();
  constructor(
    private rng: Rng,
    private library: LibraryExercise[],
    private home: boolean,
  ) {}

  private pool(filter: (ex: LibraryExercise) => boolean) {
    return this.library.filter(
      (ex) =>
        !this.used.has(ex.id) &&
        (!this.home || HOME_EQUIPMENT.has(ex.equipment as never)) &&
        filter(ex),
    );
  }

  take(filter: (ex: LibraryExercise) => boolean, prefer?: (ex: LibraryExercise) => boolean) {
    const base = this.pool(filter);
    const clean = base.filter(isClean);
    const preferred = prefer ? clean.filter(prefer) : [];
    const choice = pick(this.rng, preferred.length ? preferred : clean.length ? clean : base);
    if (choice) this.used.add(choice.id);
    return choice;
  }
}

function strengthDay(
  rng: Rng,
  library: LibraryExercise[],
  template: string,
  home: boolean,
  focus: FocusScores,
): DraftExercise[] {
  const picker = new Picker(rng, library, home);
  const main = mainScheme(focus);
  const acc = accessoryScheme(focus);
  const out: DraftExercise[] = [];
  const strengthLib = (ex: LibraryExercise) => ex.category === "strength";

  if (focus.athleticism >= 6) {
    const power = picker.take((ex) => POWER_RE.test(ex.name) && ex.category !== "basketball");
    if (power) out.push(toDraft(power, { targetSets: 4, targetReps: 3, targetRestSeconds: 120, notes: "Explosive — move fast, full recovery" }));
  }

  for (const slot of TEMPLATES[template]) {
    const primary = (ex: LibraryExercise) => strengthLib(ex) && ex.muscleGroups[0] === slot.muscle;
    let ex: LibraryExercise | undefined;
    let isCompound = false;
    if (slot.compound) {
      ex = picker.take((e) => primary(e) && slot.compound!.test(e.name));
      isCompound = Boolean(ex);
    }
    if (!ex) {
      const notCompound = (e: LibraryExercise) => !(COMPOUND[slot.muscle]?.test(e.name) ?? false);
      const accessory = slot.accessory;
      ex = picker.take(primary, accessory ? (e) => accessory.test(e.name) : notCompound);
    }
    if (!ex) continue;
    if (TIMED_RE.test(ex.name)) {
      out.push(toDraft(ex, { targetSets: 3, targetDurationSeconds: 30 + focus.stability * 3, targetRestSeconds: 60 }));
    } else {
      const s = isCompound ? main : acc;
      out.push(toDraft(ex, { targetSets: s.sets, targetReps: s.reps, targetRestSeconds: s.rest }));
    }
  }

  const stabilityCount = focus.stability >= 8 ? 2 : focus.stability >= 6 ? 1 : 0;
  for (let i = 0; i < stabilityCount; i++) {
    const ex = picker.take(
      (e) => strengthLib(e) && ["core", "obliques", "adductors"].includes(e.muscleGroups[0]),
      (e) => STABILITY_RE.test(e.name),
    );
    if (!ex) continue;
    out.push(
      TIMED_RE.test(ex.name)
        ? toDraft(ex, { targetSets: 3, targetDurationSeconds: 30 + focus.stability * 3, targetRestSeconds: 45 })
        : toDraft(ex, { targetSets: 3, targetReps: 10, targetRestSeconds: 45 }),
    );
  }

  if (focus.endurance >= 7) {
    const ex = picker.take((e) => e.category === "cardio" && FINISHER_RE.test(e.name));
    if (ex) out.push(toDraft(ex, { targetSets: 1, targetDurationSeconds: 8 * 60, notes: "Conditioning finisher" }));
  }

  const mobilityCount = focus.flexibility >= 8 ? 2 : focus.flexibility >= 6 ? 1 : 0;
  for (let i = 0; i < mobilityCount; i++) {
    const ex = picker.take((e) => e.category === "mobility", (e) => !/foam/i.test(e.name));
    if (ex) out.push(toDraft(ex, { targetSets: 1, targetDurationSeconds: 60, notes: "Cooldown" }));
  }
  return out;
}

function cardioDay(
  rng: Rng,
  library: LibraryExercise[],
  focus: FocusScores,
  intervals: boolean,
): { title: string; exercises: DraftExercise[] } {
  const picker = new Picker(rng, library, false);
  const cardioLib = (ex: LibraryExercise) =>
    ["cardio", "running", "cycling"].includes(ex.category) && !CARDIO_EXCLUDE_RE.test(ex.name);
  const minutes = Math.min(60, 20 + focus.endurance * 3);
  const out: DraftExercise[] = [];

  const main = picker.take(cardioLib, (ex) => (intervals ? INTERVAL_RE : STEADY_RE).test(ex.name));
  if (main) {
    out.push(
      toDraft(main, {
        targetSets: 1,
        targetDurationSeconds: (intervals ? Math.round(minutes * 0.6) : minutes) * 60,
        notes: intervals ? "Hard efforts, easy recoveries" : "Conversational pace (zone 2)",
      }),
    );
  }
  if (focus.athleticism >= 7) {
    const drill = picker.take(
      (ex) => ex.category === "basketball" && ["agility", "conditioning", "athleticism"].includes(ex.muscleGroups[0]),
    );
    if (drill) out.push(toDraft(drill, { targetSets: 1, targetDurationSeconds: 10 * 60 }));
  }
  if (focus.endurance >= 7 && intervals) {
    const finisher = picker.take((ex) => ex.category === "cardio" && FINISHER_RE.test(ex.name));
    if (finisher) out.push(toDraft(finisher, { targetSets: 1, targetDurationSeconds: 10 * 60 }));
  }
  if (focus.flexibility >= 5) {
    const cool = picker.take((ex) => ex.category === "mobility");
    if (cool) out.push(toDraft(cool, { targetSets: 1, targetDurationSeconds: 5 * 60, notes: "Cooldown" }));
  }
  return { title: intervals ? "Cardio — Intervals" : "Cardio — Steady State", exercises: out };
}

function recoveryDay(rng: Rng, library: LibraryExercise[], focus: FocusScores): DraftExercise[] {
  const picker = new Picker(rng, library, false);
  const count = Math.min(8, 4 + Math.round(focus.flexibility / 3));
  const hold = focus.flexibility >= 7 ? 90 : 60;
  const out: DraftExercise[] = [];

  const roll = picker.take((ex) => ex.category === "mobility" && /foam/i.test(ex.name));
  if (roll) out.push(toDraft(roll, { targetSets: 1, targetDurationSeconds: 120 }));
  while (out.length < count) {
    const ex = picker.take((e) => e.category === "mobility" && !/foam/i.test(e.name));
    if (!ex) break;
    out.push(toDraft(ex, { targetSets: 2, targetDurationSeconds: hold }));
  }
  if (focus.stability >= 7) {
    const core = picker.take((ex) => ex.category === "strength" && /plank|bear crawl|pallof/i.test(ex.name));
    if (core) out.push(toDraft(core, { targetSets: 2, targetDurationSeconds: 40 }));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Progression
// ---------------------------------------------------------------------------

/**
 * Linear progression for a 4-week block: add a rep in week 2, a set on main
 * lifts in week 3, then deload in week 4. Timed work stretches ~10% a week.
 * For longer blocks, every 4th week is a deload.
 */
export function progressExercise(ex: DraftExercise, weekIndex: number): DraftExercise {
  const phase = weekIndex % 4;
  if (phase === 0) return ex;
  const out = { ...ex };
  if (phase === 3) {
    if (out.targetSets && out.targetSets > 2) out.targetSets -= 1;
    if (out.targetDurationSeconds) out.targetDurationSeconds = Math.round(out.targetDurationSeconds * 0.8);
    return out;
  }
  if (out.targetReps) out.targetReps += phase === 1 ? 1 : 2;
  if (phase === 2 && out.targetSets && out.targetSets >= 4) out.targetSets += 1;
  if (out.targetDurationSeconds) out.targetDurationSeconds = Math.round(out.targetDurationSeconds * (1 + 0.1 * phase));
  return out;
}

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

type DayContent = { title: string; exercises: DraftExercise[] };

/** Builds a single day's workout for the given type — used by the generator
 *  and when the user changes a day's type while reviewing the plan. */
export function buildDayContent(
  dayType: DayType,
  library: LibraryExercise[],
  focus: FocusScores,
  seed: number,
  options: { strengthTemplate?: string; intervals?: boolean } = {},
): DayContent {
  const rng = createRng(seed);
  switch (dayType) {
    case "gym":
    case "home": {
      const template = options.strengthTemplate ?? "Full Body";
      return {
        title: dayType === "home" ? `${template} (Home)` : template,
        exercises: strengthDay(rng, library, template, dayType === "home", focus),
      };
    }
    case "cardio":
      return cardioDay(rng, library, focus, options.intervals ?? focus.athleticism >= 6);
    case "recovery":
      return { title: "Recover & Stretch", exercises: recoveryDay(rng, library, focus) };
    case "rest":
      return { title: "Rest", exercises: [] };
  }
}

export function generatePlan(input: GeneratorInput, library: LibraryExercise[]): PlanDraft {
  const weeks = input.weeks ?? 4;
  const seed = input.seed ?? 1;
  const baseLayout = layoutWeek(input.weeklyMix);
  const strengthCount = baseLayout.filter((t) => t === "gym" || t === "home").length;
  const templates = SPLITS[strengthCount] ?? [];

  // How many distinct "week variants" to build before repeating.
  const variantCount = input.splitType === "weekly" ? 1 : input.splitType === "biweekly" ? 2 : weeks;

  const variants: { layout: DayType[]; content: DayContent[] }[] = [];
  for (let v = 0; v < variantCount; v++) {
    const rng = createRng(seed * 1000 + v);
    let layout = baseLayout;
    if (input.splitType === "randomized" && v > 0) {
      // Keep training on the same weekdays, but shuffle which type lands where.
      const slots = baseLayout.map((t, i) => (t === "rest" ? -1 : i)).filter((i) => i >= 0);
      const types = shuffle(rng, slots.map((i) => baseLayout[i]));
      layout = [...baseLayout];
      slots.forEach((slot, k) => (layout[slot] = types[k]));
    }
    let strengthIdx = 0;
    let cardioIdx = 0;
    const content = layout.map((dayType, dayIdx) => {
      const opts =
        dayType === "gym" || dayType === "home"
          ? { strengthTemplate: templates[strengthIdx++ % Math.max(templates.length, 1)] }
          : dayType === "cardio"
            ? // Alternate steady/interval sessions; biweekly weeks start on opposite ones.
              { intervals: (cardioIdx++ + v) % 2 === 1 || input.focus.athleticism >= 8 }
            : {};
      return buildDayContent(dayType, library, input.focus, Math.floor(rng() * 1e9) + dayIdx, opts);
    });
    variants.push({ layout, content });
  }

  const days: DraftDay[] = [];
  for (let w = 0; w < weeks; w++) {
    const variant = variants[w % variants.length];
    const deload = input.progressive && w % 4 === 3;
    for (let d = 0; d < 7; d++) {
      const date = addDays(input.startDate, w * 7 + d);
      const dayType = variant.layout[d];
      const content = variant.content[d];
      days.push({
        weekNumber: w + 1,
        dayOfWeek: weekdayIndex(date),
        scheduledDate: date,
        dayType,
        title: content.title,
        notes: deload && dayType !== "rest" ? "Deload week — lighter loads, focus on form" : null,
        exercises: content.exercises.map((ex) => (input.progressive ? progressExercise(ex, w) : { ...ex })),
      });
    }
  }

  return {
    title: input.title,
    focus: input.focus,
    weeklyMix: input.weeklyMix,
    splitType: input.splitType,
    progressive: input.progressive,
    startDate: input.startDate,
    weeks,
    days,
  };
}
