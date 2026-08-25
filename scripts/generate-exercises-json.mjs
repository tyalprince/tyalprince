// One-time generator for data/exercises.json — the global exercise library
// seed data. Run with `node scripts/generate-exercises-json.mjs` whenever
// the base movement lists below change; the output is committed so
// `npm run db:seed-exercises` doesn't need to regenerate it at deploy time.
import { writeFileSync } from "fs";

/** @typedef {{name:string, category:string, muscleGroups:string[], equipment:string|null, instructions:string}} Exercise */

/** @type {Exercise[]} */
const exercises = [];
const seen = new Set();

function add(name, category, muscleGroups, equipment, instructions) {
  const key = `${name}`.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  exercises.push({ name, category, muscleGroups, equipment, instructions });
}

// ---------------------------------------------------------------------------
// Strength: compound movements x equipment variants x unilateral variants
// ---------------------------------------------------------------------------

const COMPOUND_MOVEMENTS = [
  {
    base: "Squat",
    muscleGroups: ["quads", "glutes", "hamstrings", "core"],
    equipment: ["Barbell", "Dumbbell", "Kettlebell", "Machine", "Smith Machine", "Bodyweight", "Goblet"],
    unilateral: false,
    cue: "Brace your core, sit the hips back and down, then drive through the mid-foot to stand.",
  },
  {
    base: "Deadlift",
    muscleGroups: ["hamstrings", "glutes", "back", "core"],
    equipment: ["Barbell", "Dumbbell", "Trap Bar", "Kettlebell", "Smith Machine"],
    unilateral: false,
    cue: "Hinge at the hips with a flat back, drive the floor away, and lock out the hips at the top.",
  },
  {
    base: "Romanian Deadlift",
    muscleGroups: ["hamstrings", "glutes", "back"],
    equipment: ["Barbell", "Dumbbell", "Kettlebell"],
    unilateral: false,
    cue: "Keep a slight knee bend and push the hips back, lowering the weight along the shins.",
  },
  {
    base: "Bench Press",
    muscleGroups: ["chest", "shoulders", "triceps"],
    equipment: ["Barbell", "Dumbbell", "Machine", "Smith Machine"],
    unilateral: false,
    cue: "Retract the shoulder blades, lower the bar to the chest, and press up over the shoulders.",
  },
  {
    base: "Incline Bench Press",
    muscleGroups: ["chest", "shoulders", "triceps"],
    equipment: ["Barbell", "Dumbbell", "Machine", "Smith Machine"],
    unilateral: false,
    cue: "On an incline bench, press the weight up and slightly back over the upper chest.",
  },
  {
    base: "Overhead Press",
    muscleGroups: ["shoulders", "triceps", "core"],
    equipment: ["Barbell", "Dumbbell", "Machine", "Kettlebell", "Smith Machine"],
    unilateral: true,
    cue: "Brace the core and press the weight straight overhead without arching the lower back.",
  },
  {
    base: "Row",
    muscleGroups: ["back", "biceps"],
    equipment: ["Barbell", "Dumbbell", "Cable", "Machine", "T-Bar"],
    unilateral: true,
    cue: "Hinge forward with a flat back and pull the weight to the lower ribs, squeezing the shoulder blades.",
  },
  {
    base: "Lat Pulldown",
    muscleGroups: ["back", "biceps"],
    equipment: ["Cable", "Machine"],
    unilateral: true,
    cue: "Pull the bar down to the upper chest while keeping the chest tall.",
  },
  {
    base: "Pull-Up",
    muscleGroups: ["back", "biceps"],
    equipment: ["Bodyweight", "Assisted Machine", "Weighted"],
    unilateral: false,
    cue: "Pull the chin over the bar with a controlled descent to full arm extension.",
  },
  {
    base: "Chin-Up",
    muscleGroups: ["back", "biceps"],
    equipment: ["Bodyweight", "Assisted Machine", "Weighted"],
    unilateral: false,
    cue: "Using an underhand grip, pull the chin over the bar and lower under control.",
  },
  {
    base: "Hip Thrust",
    muscleGroups: ["glutes", "hamstrings"],
    equipment: ["Barbell", "Machine", "Bodyweight", "Band"],
    unilateral: false,
    cue: "With shoulders on a bench, drive the hips up until the body forms a straight line.",
  },
  {
    base: "Glute Bridge",
    muscleGroups: ["glutes", "hamstrings"],
    equipment: ["Barbell", "Bodyweight", "Band"],
    unilateral: false,
    cue: "Lying on the floor, drive the hips upward, squeezing the glutes at the top.",
  },
  {
    base: "Lunge",
    muscleGroups: ["quads", "glutes", "hamstrings"],
    equipment: ["Barbell", "Dumbbell", "Kettlebell", "Bodyweight"],
    unilateral: true,
    cue: "Step forward and lower until both knees reach roughly 90 degrees, then push back to start.",
  },
  {
    base: "Split Squat",
    muscleGroups: ["quads", "glutes", "hamstrings"],
    equipment: ["Barbell", "Dumbbell", "Kettlebell", "Bodyweight"],
    unilateral: true,
    cue: "From a staggered stance, lower the back knee toward the floor and drive back up.",
  },
  {
    base: "Bulgarian Split Squat",
    muscleGroups: ["quads", "glutes", "hamstrings"],
    equipment: ["Dumbbell", "Kettlebell", "Barbell", "Bodyweight"],
    unilateral: true,
    cue: "With the rear foot elevated behind you, lower straight down and drive through the front heel.",
  },
  {
    base: "Step-Up",
    muscleGroups: ["quads", "glutes"],
    equipment: ["Dumbbell", "Barbell", "Bodyweight", "Kettlebell"],
    unilateral: true,
    cue: "Step fully onto the box and drive through the lead leg to stand tall.",
  },
  {
    base: "Leg Press",
    muscleGroups: ["quads", "glutes", "hamstrings"],
    equipment: ["Machine"],
    unilateral: true,
    cue: "Lower the sled until the knees reach about 90 degrees, then press back to start.",
  },
  {
    base: "Front Squat",
    muscleGroups: ["quads", "glutes", "core"],
    equipment: ["Barbell", "Dumbbell", "Kettlebell", "Smith Machine"],
    unilateral: false,
    cue: "Keep the elbows high and torso upright as you squat with the load racked on the front shoulders.",
  },
  {
    base: "Sumo Deadlift",
    muscleGroups: ["glutes", "hamstrings", "back"],
    equipment: ["Barbell", "Dumbbell", "Kettlebell"],
    unilateral: false,
    cue: "With a wide stance, grip inside the knees and drive the floor away, keeping the chest tall.",
  },
  {
    base: "Good Morning",
    muscleGroups: ["hamstrings", "glutes", "back"],
    equipment: ["Barbell", "Band"],
    unilateral: false,
    cue: "Hinge at the hips with a soft knee bend, keeping the bar path close to the body.",
  },
  {
    base: "Push-Up",
    muscleGroups: ["chest", "shoulders", "triceps", "core"],
    equipment: ["Bodyweight", "Weighted", "Resistance Band"],
    unilateral: false,
    cue: "Lower the chest to the floor with a straight body line, then press back up.",
  },
  {
    base: "Dip",
    muscleGroups: ["chest", "triceps", "shoulders"],
    equipment: ["Bodyweight", "Assisted Machine", "Weighted"],
    unilateral: false,
    cue: "Lower until the shoulders dip below the elbows, then press back to lockout.",
  },
  {
    base: "Push Press",
    muscleGroups: ["shoulders", "triceps", "legs"],
    equipment: ["Barbell", "Dumbbell", "Kettlebell"],
    unilateral: false,
    cue: "Dip slightly at the knees and drive the weight overhead using leg drive.",
  },
  {
    base: "Landmine Press",
    muscleGroups: ["shoulders", "chest", "triceps"],
    equipment: ["Barbell"],
    unilateral: true,
    cue: "Press the landmine-anchored bar up and forward along its natural arc.",
  },
  {
    base: "Farmer's Carry",
    muscleGroups: ["forearms", "core", "back"],
    equipment: ["Dumbbell", "Kettlebell", "Trap Bar"],
    unilateral: false,
    cue: "Walk with a tall posture while carrying a heavy load in each hand.",
  },
  {
    base: "Suitcase Carry",
    muscleGroups: ["core", "obliques", "forearms"],
    equipment: ["Dumbbell", "Kettlebell"],
    unilateral: true,
    cue: "Carry the load in one hand, resisting lateral lean through the core.",
  },
  {
    base: "Kettlebell Swing",
    muscleGroups: ["glutes", "hamstrings", "core"],
    equipment: ["Kettlebell"],
    unilateral: false,
    cue: "Hinge and snap the hips forward to drive the kettlebell to chest height.",
  },
  {
    base: "Turkish Get-Up",
    muscleGroups: ["core", "shoulders", "full body"],
    equipment: ["Kettlebell", "Dumbbell"],
    unilateral: true,
    cue: "Move from lying to standing while keeping the loaded arm locked overhead throughout.",
  },
  {
    base: "Clean",
    muscleGroups: ["full body", "legs", "back"],
    equipment: ["Barbell", "Dumbbell", "Kettlebell"],
    unilateral: false,
    cue: "Pull the weight explosively from the floor and receive it in a front-rack position.",
  },
  {
    base: "Snatch",
    muscleGroups: ["full body", "legs", "shoulders"],
    equipment: ["Barbell", "Dumbbell", "Kettlebell"],
    unilateral: false,
    cue: "Pull the weight explosively overhead in one continuous motion, receiving it in a squat.",
  },
  {
    base: "Thruster",
    muscleGroups: ["legs", "shoulders", "full body"],
    equipment: ["Barbell", "Dumbbell", "Kettlebell"],
    unilateral: false,
    cue: "Combine a front squat with a push press into one continuous, explosive movement.",
  },
  {
    base: "Sled Push",
    muscleGroups: ["legs", "glutes", "core"],
    equipment: ["Sled"],
    unilateral: false,
    cue: "Drive through the legs with a low, powerful stride to push the loaded sled forward.",
  },
  {
    base: "Sled Pull",
    muscleGroups: ["back", "legs", "core"],
    equipment: ["Sled"],
    unilateral: false,
    cue: "Walk backward or forward pulling the sled via rope or harness attachment.",
  },
  {
    base: "Box Jump",
    muscleGroups: ["legs", "glutes"],
    equipment: ["Bodyweight"],
    unilateral: false,
    cue: "Swing the arms and explode upward, landing softly on the box in a stable position.",
  },
  {
    base: "Broad Jump",
    muscleGroups: ["legs", "glutes"],
    equipment: ["Bodyweight"],
    unilateral: false,
    cue: "Swing the arms and jump forward for maximum distance, sticking the landing.",
  },
  {
    base: "Back Extension",
    muscleGroups: ["back", "glutes", "hamstrings"],
    equipment: ["Bodyweight", "Weighted", "Machine"],
    unilateral: false,
    cue: "Hinge at the hips over the pad and extend back to a neutral spine position.",
  },
  {
    base: "Nordic Curl",
    muscleGroups: ["hamstrings"],
    equipment: ["Bodyweight"],
    unilateral: false,
    cue: "Anchored at the ankles, lower the torso forward under control using the hamstrings.",
  },
  {
    base: "Sissy Squat",
    muscleGroups: ["quads"],
    equipment: ["Bodyweight", "Weighted"],
    unilateral: false,
    cue: "Lean back from the knees while keeping hips extended, then return to standing.",
  },
  {
    base: "Wall Sit",
    muscleGroups: ["quads"],
    equipment: ["Bodyweight"],
    unilateral: false,
    cue: "Hold a seated position against the wall with thighs parallel to the floor.",
  },
  {
    base: "Hack Squat",
    muscleGroups: ["quads", "glutes"],
    equipment: ["Machine", "Barbell"],
    unilateral: false,
    cue: "Lower under control on the fixed track, then press through the mid-foot to stand.",
  },
  {
    base: "Belt Squat",
    muscleGroups: ["quads", "glutes"],
    equipment: ["Machine"],
    unilateral: true,
    cue: "Squat against a belt-loaded resistance with the spine kept free of axial load.",
  },
  {
    base: "Zercher Squat",
    muscleGroups: ["quads", "glutes", "core"],
    equipment: ["Barbell"],
    unilateral: false,
    cue: "Cradle the bar in the elbow creases and squat while keeping the torso upright.",
  },
  {
    base: "Overhead Squat",
    muscleGroups: ["quads", "glutes", "shoulders", "core"],
    equipment: ["Barbell", "Dumbbell"],
    unilateral: false,
    cue: "Keep the arms locked overhead while squatting to full depth with an upright torso.",
  },
  {
    base: "Pendlay Row",
    muscleGroups: ["back", "biceps"],
    equipment: ["Barbell"],
    unilateral: false,
    cue: "From a dead stop on the floor, explosively row the bar to the lower chest.",
  },
  {
    base: "Seal Row",
    muscleGroups: ["back", "biceps"],
    equipment: ["Barbell", "Dumbbell"],
    unilateral: false,
    cue: "Lying face-down on an elevated bench, row the weight up without any body English.",
  },
  {
    base: "Meadows Row",
    muscleGroups: ["back", "biceps"],
    equipment: ["Barbell", "Landmine"],
    unilateral: true,
    cue: "Using a landmine setup, row the bar up and back with a wide range of motion.",
  },
  {
    base: "Reverse Hyperextension",
    muscleGroups: ["back", "glutes", "hamstrings"],
    equipment: ["Machine", "Bench"],
    unilateral: false,
    cue: "Swing the legs up and back using the glutes and hamstrings while the torso stays still.",
  },
  {
    base: "Split Jerk",
    muscleGroups: ["shoulders", "legs", "full body"],
    equipment: ["Barbell"],
    unilateral: false,
    cue: "Dip, drive, and split the feet to receive the bar overhead in a stable lunge position.",
  },
  {
    base: "Bear Crawl",
    muscleGroups: ["core", "shoulders", "full body"],
    equipment: ["Bodyweight"],
    unilateral: false,
    cue: "Crawl forward on hands and feet with hips low and core braced.",
  },
  {
    base: "Pallof Press",
    muscleGroups: ["core", "obliques"],
    equipment: ["Cable", "Band"],
    unilateral: false,
    cue: "Press the handle straight out from the chest, resisting rotation from the core.",
  },
  {
    base: "Cable Woodchopper",
    muscleGroups: ["core", "obliques"],
    equipment: ["Cable", "Band"],
    unilateral: true,
    cue: "Rotate through the torso, pulling the cable diagonally across the body.",
  },
  {
    base: "GHD Sit-Up",
    muscleGroups: ["core"],
    equipment: ["Machine"],
    unilateral: false,
    cue: "Lower back beyond parallel on the GHD, then curl forward to full flexion.",
  },
  {
    base: "Ab Wheel Rollout",
    muscleGroups: ["core"],
    equipment: ["Ab Wheel"],
    unilateral: false,
    cue: "Roll forward keeping the spine neutral, then pull back to the starting position.",
  },
];

for (const m of COMPOUND_MOVEMENTS) {
  for (const eq of m.equipment) {
    add(`${eq} ${m.base}`, "strength", m.muscleGroups, eq, m.cue);
    if (m.unilateral) {
      add(`Single-Leg ${eq} ${m.base}`, "strength", m.muscleGroups, eq, `Unilateral variant: ${m.cue.toLowerCase()}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Strength: isolation movements x equipment variants x unilateral variants
// ---------------------------------------------------------------------------

const ISOLATION_MOVEMENTS = [
  { base: "Bicep Curl", muscleGroups: ["biceps"], equipment: ["Barbell", "Dumbbell", "Cable", "Machine", "EZ-Bar", "Band"], unilateral: true, cue: "Curl the weight up while keeping the elbows pinned to your sides." },
  { base: "Hammer Curl", muscleGroups: ["biceps", "forearms"], equipment: ["Dumbbell", "Cable", "Rope"], unilateral: true, cue: "Curl with a neutral grip, keeping the wrist straight throughout." },
  { base: "Tricep Extension", muscleGroups: ["triceps"], equipment: ["Cable", "Dumbbell", "Barbell", "Machine", "Rope"], unilateral: true, cue: "Extend the elbow fully while keeping the upper arm still." },
  { base: "Tricep Pushdown", muscleGroups: ["triceps"], equipment: ["Cable", "Rope", "Bar"], unilateral: false, cue: "Push the attachment down to full elbow extension, keeping elbows tucked." },
  { base: "Skull Crusher", muscleGroups: ["triceps"], equipment: ["Barbell", "Dumbbell", "EZ-Bar"], unilateral: false, cue: "Lower the weight toward the forehead by bending only at the elbow." },
  { base: "Lateral Raise", muscleGroups: ["shoulders"], equipment: ["Dumbbell", "Cable", "Machine"], unilateral: true, cue: "Raise the arms out to the sides to shoulder height with a slight elbow bend." },
  { base: "Front Raise", muscleGroups: ["shoulders"], equipment: ["Dumbbell", "Cable", "Barbell", "Plate"], unilateral: true, cue: "Raise the weight forward to shoulder height, keeping the core braced." },
  { base: "Rear Delt Fly", muscleGroups: ["shoulders", "back"], equipment: ["Dumbbell", "Cable", "Machine"], unilateral: false, cue: "Hinge forward and raise the arms out to the sides, squeezing the rear delts." },
  { base: "Chest Fly", muscleGroups: ["chest"], equipment: ["Dumbbell", "Cable", "Machine"], unilateral: false, cue: "With a slight elbow bend, bring the arms together in a wide arc." },
  { base: "Face Pull", muscleGroups: ["shoulders", "back"], equipment: ["Cable", "Band"], unilateral: false, cue: "Pull the rope toward the face, flaring the elbows out wide." },
  { base: "Shrug", muscleGroups: ["back", "shoulders"], equipment: ["Barbell", "Dumbbell", "Trap Bar", "Machine"], unilateral: false, cue: "Elevate the shoulders straight up toward the ears and lower under control." },
  { base: "Leg Extension", muscleGroups: ["quads"], equipment: ["Machine"], unilateral: true, cue: "Extend the knees fully, pausing briefly at the top." },
  { base: "Leg Curl", muscleGroups: ["hamstrings"], equipment: ["Machine", "Stability Ball"], unilateral: true, cue: "Curl the heels toward the glutes, keeping the hips pressed down." },
  { base: "Calf Raise", muscleGroups: ["calves"], equipment: ["Machine", "Dumbbell", "Barbell", "Bodyweight"], unilateral: true, cue: "Rise onto the balls of the feet, pausing at the top, then lower with control." },
  { base: "Hip Abduction", muscleGroups: ["glutes"], equipment: ["Machine", "Band"], unilateral: false, cue: "Push the legs outward against resistance, focusing on the outer glutes." },
  { base: "Hip Adduction", muscleGroups: ["inner thigh"], equipment: ["Machine", "Band"], unilateral: false, cue: "Squeeze the legs together against resistance." },
  { base: "Ab Crunch", muscleGroups: ["core"], equipment: ["Bodyweight", "Machine", "Cable"], unilateral: false, cue: "Curl the shoulders off the floor, contracting the abs, not pulling the neck." },
  { base: "Hanging Leg Raise", muscleGroups: ["core"], equipment: ["Bodyweight"], unilateral: false, cue: "Hanging from a bar, raise the legs to hip height without swinging." },
  { base: "Russian Twist", muscleGroups: ["core"], equipment: ["Bodyweight", "Dumbbell", "Medicine Ball"], unilateral: false, cue: "Rotate the torso side to side while keeping the feet off the floor." },
  { base: "Plank", muscleGroups: ["core"], equipment: ["Bodyweight"], unilateral: false, cue: "Hold a straight line from head to heels, bracing the core throughout." },
  { base: "Side Plank", muscleGroups: ["core", "obliques"], equipment: ["Bodyweight"], unilateral: true, cue: "Support the body on one forearm, keeping the hips lifted in a straight line." },
  { base: "Wrist Curl", muscleGroups: ["forearms"], equipment: ["Dumbbell", "Barbell"], unilateral: true, cue: "Curl the wrist upward through a full range of motion." },
  { base: "Preacher Curl", muscleGroups: ["biceps"], equipment: ["Barbell", "Dumbbell", "Machine", "EZ-Bar"], unilateral: true, cue: "With the arm braced on the pad, curl through a strict, controlled range of motion." },
  { base: "Concentration Curl", muscleGroups: ["biceps"], equipment: ["Dumbbell"], unilateral: true, cue: "Brace the elbow against the inner thigh and curl with strict form." },
  { base: "Overhead Tricep Extension", muscleGroups: ["triceps"], equipment: ["Dumbbell", "Cable", "Barbell", "EZ-Bar"], unilateral: true, cue: "Keep the elbows close to the head while extending the forearm overhead." },
  { base: "Close-Grip Bench Press", muscleGroups: ["triceps", "chest"], equipment: ["Barbell", "Smith Machine"], unilateral: false, cue: "Press with hands shoulder-width apart, keeping the elbows tucked." },
  { base: "Pec Deck Fly", muscleGroups: ["chest"], equipment: ["Machine"], unilateral: false, cue: "Bring the pads together in front of the chest with a controlled squeeze." },
  { base: "Cable Crossover", muscleGroups: ["chest"], equipment: ["Cable"], unilateral: false, cue: "Pull the cables down and across the body in a wide arc, squeezing the chest." },
  { base: "Upright Row", muscleGroups: ["shoulders", "back"], equipment: ["Barbell", "Dumbbell", "Cable"], unilateral: false, cue: "Pull the weight up along the body to chest height, leading with the elbows." },
  { base: "Reverse Fly", muscleGroups: ["shoulders", "back"], equipment: ["Dumbbell", "Cable", "Machine", "Band"], unilateral: false, cue: "Raise the arms out to the sides while hinged forward, squeezing the shoulder blades." },
  { base: "Cuban Press", muscleGroups: ["shoulders"], equipment: ["Dumbbell"], unilateral: false, cue: "Combine an upright row, external rotation, and press into one controlled sequence." },
  { base: "Good Morning (Isolation)", muscleGroups: ["hamstrings", "back"], equipment: ["Band"], unilateral: false, cue: "Hinge forward against band resistance, keeping the spine neutral." },
  { base: "Seated Calf Raise", muscleGroups: ["calves"], equipment: ["Machine", "Dumbbell", "Barbell"], unilateral: true, cue: "With knees bent, rise onto the toes and pause at the top of the range." },
  { base: "Standing Calf Raise", muscleGroups: ["calves"], equipment: ["Machine", "Dumbbell", "Barbell", "Bodyweight"], unilateral: true, cue: "With legs straight, rise onto the toes through a full range of motion." },
  { base: "Cable Kickback", muscleGroups: ["glutes"], equipment: ["Cable"], unilateral: true, cue: "Kick the leg back and up against cable resistance, squeezing the glute at the top." },
  { base: "Glute Kickback", muscleGroups: ["glutes"], equipment: ["Machine", "Band"], unilateral: true, cue: "Extend the hip back against resistance while keeping the core braced." },
  { base: "Cable Pull-Through", muscleGroups: ["glutes", "hamstrings"], equipment: ["Cable"], unilateral: false, cue: "Hinge at the hips to reach through and pull the cable forward with hip drive." },
  { base: "Curtsy Lunge", muscleGroups: ["glutes", "quads"], equipment: ["Dumbbell", "Bodyweight", "Kettlebell"], unilateral: true, cue: "Step one leg diagonally behind the other and lower into a crossed lunge." },
  { base: "Lateral Lunge", muscleGroups: ["quads", "glutes", "adductors"], equipment: ["Dumbbell", "Bodyweight", "Kettlebell"], unilateral: true, cue: "Step wide to one side and sit back into that hip while the other leg stays straight." },
  { base: "Cossack Squat", muscleGroups: ["adductors", "quads", "glutes"], equipment: ["Bodyweight", "Kettlebell", "Dumbbell"], unilateral: true, cue: "Shift weight fully to one side, sitting low while the opposite leg stays extended." },
  { base: "Copenhagen Plank", muscleGroups: ["adductors", "core"], equipment: ["Bench", "Bodyweight"], unilateral: true, cue: "Support the top leg on a bench and hold a side plank position for the adductors." },
  { base: "Cable Rotation", muscleGroups: ["core", "obliques"], equipment: ["Cable"], unilateral: true, cue: "Rotate the torso against cable resistance while keeping the hips square." },
  { base: "Renegade Row", muscleGroups: ["back", "core", "shoulders"], equipment: ["Dumbbell", "Kettlebell"], unilateral: true, cue: "From a plank, row one weight up while stabilizing the torso against rotation." },
  { base: "Landmine Rotation", muscleGroups: ["core", "obliques"], equipment: ["Barbell"], unilateral: false, cue: "Rotate the landmine bar side to side while keeping the arms extended." },
  { base: "Zottman Curl", muscleGroups: ["biceps", "forearms"], equipment: ["Dumbbell"], unilateral: true, cue: "Curl with palms up, then rotate and lower with palms down." },
  { base: "Spider Curl", muscleGroups: ["biceps"], equipment: ["Dumbbell", "Barbell", "EZ-Bar"], unilateral: true, cue: "Curl while chest-supported on an incline bench for strict isolation." },
  { base: "JM Press", muscleGroups: ["triceps"], equipment: ["Barbell", "EZ-Bar"], unilateral: false, cue: "A hybrid skull-crusher/close-grip press lowering the bar toward the upper chest." },
  { base: "Diamond Push-Up", muscleGroups: ["triceps", "chest"], equipment: ["Bodyweight"], unilateral: false, cue: "With hands forming a diamond shape, lower the chest to the hands and press up." },
];

for (const m of ISOLATION_MOVEMENTS) {
  for (const eq of m.equipment) {
    add(`${eq} ${m.base}`, "strength", m.muscleGroups, eq, m.cue);
    if (m.unilateral) {
      add(`Single-Arm ${eq} ${m.base}`, "strength", m.muscleGroups, eq, `Unilateral variant: ${m.cue.toLowerCase()}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Running
// ---------------------------------------------------------------------------

const RUNNING_TYPES = [
  { name: "Easy Recovery Run", cue: "Conversational pace, low effort, focused on active recovery." },
  { name: "Long Run", cue: "Steady, sustainable pace held for extended distance to build aerobic base." },
  { name: "Tempo Run", cue: "Comfortably hard, sustained pace at or near lactate threshold." },
  { name: "Interval Repeats — 400m", cue: "Hard 400m efforts with equal-distance jog recovery between reps." },
  { name: "Interval Repeats — 800m", cue: "Hard 800m efforts with jog recovery, focused on race-pace speed." },
  { name: "Interval Repeats — 1 Mile", cue: "Sustained hard efforts at 1-mile repeats with full recovery." },
  { name: "Hill Repeats", cue: "Hard uphill efforts focused on power and running economy, jog down to recover." },
  { name: "Fartlek Run", cue: "Unstructured speed play alternating hard and easy efforts by feel." },
  { name: "Progression Run", cue: "Start easy and gradually increase pace through the run." },
  { name: "Track Speed Work — 200m", cue: "Short, fast repeats focused on top-end speed and turnover." },
  { name: "Trail Run", cue: "Off-road running at a controlled effort, adjusting pace for terrain." },
  { name: "Treadmill Run", cue: "Controlled-pace run on the treadmill at a set incline and speed." },
  { name: "Race Pace Run", cue: "Sustained running at goal race pace to build pacing familiarity." },
  { name: "Shakeout Run", cue: "Very short, easy jog the day before a race to stay loose." },
  { name: "Strides", cue: "Short, relaxed accelerations to near-sprint speed, focused on form." },
  { name: "Interval Repeats — 200m", cue: "Short, fast repeats with full recovery, focused on speed and form." },
  { name: "Interval Repeats — 2 Mile", cue: "Longer threshold-pace repeats with short recovery between reps." },
  { name: "Yasso 800s", cue: "800m repeats at a pace matching your marathon goal time in minutes:seconds." },
  { name: "Negative Split Run", cue: "Run the second half of the distance faster than the first half." },
  { name: "Cross-Country Run", cue: "Off-road distance run over varied natural terrain and footing." },
  { name: "Track Time Trial", cue: "All-out effort over a set track distance to assess current fitness." },
  { name: "Marathon Pace Run", cue: "Extended run held at goal marathon race pace." },
  { name: "Half Marathon Pace Run", cue: "Extended run held at goal half marathon race pace." },
  { name: "5K Time Trial", cue: "All-out 5K effort run for time to benchmark fitness." },
  { name: "10K Time Trial", cue: "All-out 10K effort run for time to benchmark fitness." },
  { name: "Treadmill Incline Walk", cue: "Brisk walk at a steep incline for low-impact aerobic work." },
  { name: "Barefoot Strides", cue: "Short barefoot accelerations on grass to build foot strength and form." },
  { name: "Ladder Repeats — 200m to 800m", cue: "Ascending or descending distance repeats with recovery between each rep." },
  { name: "Threshold Run", cue: "Sustained effort right at lactate threshold pace for an extended block." },
  { name: "Fun Run / Social Jog", cue: "Relaxed, easy-paced group run with no specific pace target." },
  { name: "Trail Hill Repeats", cue: "Repeated hard efforts up a trail incline with an easy jog or walk back down." },
  { name: "Beach/Sand Run", cue: "Run on sand for a low-impact, higher-resistance aerobic workout." },
  { name: "Parkrun / 5K Group Event", cue: "Timed 5K community run event at race effort." },
  { name: "Warm-Up Jog", cue: "Very easy short jog to raise heart rate before a workout or race." },
];

for (const r of RUNNING_TYPES) {
  add(r.name, "running", ["legs", "cardiovascular"], null, r.cue);
}

// ---------------------------------------------------------------------------
// Cycling
// ---------------------------------------------------------------------------

const CYCLING_TYPES = [
  { name: "Road Ride — Endurance", cue: "Steady aerobic-pace ride at a conversational effort." },
  { name: "Indoor Trainer — Steady State", cue: "Controlled, sustained wattage/effort on the indoor trainer." },
  { name: "Indoor Trainer — Intervals", cue: "Structured hard/easy interval sets on the indoor trainer." },
  { name: "Hill Climb Ride", cue: "Sustained climbing effort focused on power output on grades." },
  { name: "Recovery Ride", cue: "Very easy spin to promote blood flow and recovery." },
  { name: "Group Ride", cue: "Variable-effort ride in a group, often with surges and pacelines." },
  { name: "Time Trial Effort", cue: "Sustained maximal-sustainable effort simulating a time trial." },
  { name: "Sprint Intervals", cue: "Short, maximal-effort sprints with full recovery between reps." },
  { name: "Tempo Ride", cue: "Comfortably hard, sustained effort just below threshold." },
  { name: "Mountain Bike Ride", cue: "Off-road ride with variable terrain and technical sections." },
  { name: "Gravel Ride", cue: "Mixed-surface ride at an endurance-to-tempo effort." },
  { name: "Spin Class", cue: "Instructor-led interval and cadence work on a stationary bike." },
  { name: "Cyclocross Ride", cue: "Off-road ride mixing pavement, grass, and obstacles at a hard effort." },
  { name: "Century Ride", cue: "Long-distance endurance ride, typically 100 miles, at a steady pace." },
  { name: "Cadence Drills", cue: "Ride at a fixed high cadence with light resistance to build pedaling efficiency." },
  { name: "Threshold Intervals", cue: "Sustained intervals at functional threshold power with short recovery." },
  { name: "VO2 Max Intervals", cue: "Very hard, short intervals designed to push aerobic capacity limits." },
  { name: "Commuter Ride", cue: "Point-to-point ride at a moderate, sustainable effort." },
  { name: "Fixed Gear / Track Ride", cue: "Steady-cadence ride on a fixed-gear or track bike." },
  { name: "Bikepacking Ride", cue: "Long-duration loaded touring ride at a sustainable endurance pace." },
  { name: "Zwift / Virtual Group Ride", cue: "Structured or social ride on a virtual cycling platform." },
  { name: "Criterium Race Simulation", cue: "Short, high-intensity looped-course ride simulating criterium racing." },
];

for (const c of CYCLING_TYPES) {
  add(c.name, "cycling", ["legs", "cardiovascular"], "Bike", c.cue);
}

// ---------------------------------------------------------------------------
// Basketball
// ---------------------------------------------------------------------------

const BASKETBALL_DRILLS = [
  { name: "Spot-Up Shooting", group: "shooting", cue: "Catch and shoot from a fixed spot, focusing on consistent footwork and release." },
  { name: "Catch-and-Shoot Shooting", group: "shooting", cue: "Shoot immediately off a pass with quick footwork into the shot." },
  { name: "Off-the-Dribble Pull-Up Jumper", group: "shooting", cue: "Attack off the dribble and rise into a balanced pull-up jump shot." },
  { name: "Free Throw Practice", group: "shooting", cue: "Repeat a consistent pre-shot routine at the free throw line." },
  { name: "Three-Point Shooting — Corner", group: "shooting", cue: "Shoot from the corner spots, focusing on a quick, repeatable release." },
  { name: "Three-Point Shooting — Wing", group: "shooting", cue: "Shoot from the wing, working on balance off movement." },
  { name: "Mid-Range Shooting", group: "shooting", cue: "Work shots from the elbow and baseline mid-range areas." },
  { name: "Floater / Runner Practice", group: "shooting", cue: "Practice one- and two-foot floaters through traffic near the rim." },
  { name: "Layup Package — Finishing", group: "shooting", cue: "Work both-hand finishes, reverse layups, and euro-steps at full speed." },
  { name: "Ballhandling — Two-Ball Dribbling", group: "ballhandling", cue: "Dribble two balls simultaneously to build coordination and control." },
  { name: "Ballhandling — Crossover Series", group: "ballhandling", cue: "Chain crossover, between-the-legs, and behind-the-back moves at speed." },
  { name: "Ballhandling — Cone Weave", group: "ballhandling", cue: "Dribble through a line of cones using change-of-direction moves." },
  { name: "Ballhandling — Full-Court Dribbling", group: "ballhandling", cue: "Push the ball up the floor at speed while maintaining control." },
  { name: "Passing — Chest and Bounce Pass Accuracy", group: "passing", cue: "Repeat crisp chest and bounce passes at a target for accuracy." },
  { name: "Defensive Slides", group: "conditioning", cue: "Stay low in a defensive stance while sliding laterally without crossing feet." },
  { name: "Closeout Drill", group: "conditioning", cue: "Sprint out and break down into a balanced defensive closeout stance." },
  { name: "Suicides / Line Sprints", group: "conditioning", cue: "Sprint to each line on the court and back, focused on max effort and turns." },
  { name: "Full-Court Conditioning Sprints", group: "conditioning", cue: "Repeated full-court sprints with short recovery to build game conditioning." },
  { name: "Agility Ladder — Basketball Footwork", group: "agility", cue: "Move through an agility ladder pattern focused on quick, precise foot contacts." },
  { name: "Cone Agility — Shuttle Run", group: "agility", cue: "Sprint and change direction sharply between cones set at varying distances." },
  { name: "Reactive Agility — Mirror Drill", group: "agility", cue: "Mirror a partner's lateral movements to build reactive quickness." },
  { name: "Vertical Jump Training", group: "athleticism", cue: "Explosive jump work focused on takeoff mechanics and landing control." },
  { name: "Rebounding — Box Out Drill", group: "rebounding", cue: "Establish position and box out a live opponent before attacking the rebound." },
  { name: "Post Moves — Drop Step and Up-and-Under", group: "post play", cue: "Work footwork-based finishing moves from the post against light resistance." },
  { name: "5-on-5 Scrimmage", group: "team play", cue: "Full team live play applying game concepts under realistic conditions." },
  { name: "3-on-3 Half-Court Scrimmage", group: "team play", cue: "Small-sided live play emphasizing spacing and decision-making." },
  { name: "Pick-and-Roll Reps", group: "team play", cue: "Repeat ball-handler/screener pick-and-roll reads against live or shell defense." },
  { name: "One-on-One Live Play", group: "team play", cue: "Live isolation reps working attacking and defensive moves against a matched opponent." },
  { name: "2-on-2 Shell Drill", group: "team play", cue: "Small-sided defensive shell work emphasizing help-side positioning." },
  { name: "Transition Fast Break Drill", group: "team play", cue: "Push the ball up the floor in numbers advantage situations for quick scores." },
  { name: "Shooting Off Screens", group: "shooting", cue: "Curl or fade off a screen into a balanced catch-and-shoot jumper." },
  { name: "Step-Back Jumper", group: "shooting", cue: "Create separation with a hard step-back before rising into the shot." },
  { name: "And-1 Finishing Drill", group: "shooting", cue: "Finish through contact at the rim while drawing and absorbing a foul." },
  { name: "Full-Speed Layup Drill", group: "shooting", cue: "Finish layups at game speed off a live dribble approach." },
  { name: "Change-of-Pace Ballhandling", group: "ballhandling", cue: "Mix hesitations and speed bursts to beat on-ball defensive pressure." },
  { name: "Wall Dribbling Drill", group: "ballhandling", cue: "Dribble rapidly against a wall or defender's pressure to build hand speed." },
  { name: "T-Drill Agility", group: "agility", cue: "Sprint, shuffle, and backpedal through a T-shaped cone pattern for time." },
  { name: "Lane Agility Drill", group: "agility", cue: "Shuffle and sprint around the free-throw lane boundary for time." },
  { name: "Box-Out and Chase Drill", group: "rebounding", cue: "Box out a live opponent, then release to chase down a long rebound." },
];

for (const d of BASKETBALL_DRILLS) {
  add(d.name, "basketball", [d.group], "Basketball", d.cue);
}

// ---------------------------------------------------------------------------
// Mobility / general cardio
// ---------------------------------------------------------------------------

const MOBILITY_CARDIO = [
  { name: "Foam Rolling — Quads", category: "mobility", muscleGroups: ["quads"], cue: "Roll slowly over the quads, pausing on tender spots for 20-30 seconds." },
  { name: "Foam Rolling — IT Band", category: "mobility", muscleGroups: ["legs"], cue: "Roll along the outside of the thigh, easing pressure as needed." },
  { name: "Foam Rolling — Upper Back", category: "mobility", muscleGroups: ["back"], cue: "Roll across the upper back, supporting the head and keeping hips lifted." },
  { name: "Hip Flexor Stretch", category: "mobility", muscleGroups: ["hips"], cue: "In a half-kneeling position, shift weight forward to stretch the front hip." },
  { name: "Hamstring Stretch", category: "mobility", muscleGroups: ["hamstrings"], cue: "With a straight leg extended, hinge forward until a stretch is felt." },
  { name: "Couch Stretch", category: "mobility", muscleGroups: ["quads", "hips"], cue: "With the rear foot elevated behind you, sink the hips forward and down." },
  { name: "90/90 Hip Stretch", category: "mobility", muscleGroups: ["hips"], cue: "Sit with both legs bent at 90 degrees and rotate through the hips." },
  { name: "World's Greatest Stretch", category: "mobility", muscleGroups: ["full body"], cue: "Flow through a lunge, rotation, and hamstring stretch in one sequence." },
  { name: "Cat-Cow Mobility", category: "mobility", muscleGroups: ["spine"], cue: "Alternate arching and rounding the spine on hands and knees." },
  { name: "Thoracic Spine Rotation", category: "mobility", muscleGroups: ["spine", "back"], cue: "From all fours, rotate one arm up and through, following with the eyes." },
  { name: "Ankle Mobility Drill", category: "mobility", muscleGroups: ["ankles"], cue: "Drive the knee over the toe while keeping the heel down to open the ankle." },
  { name: "Shoulder Dislocates", category: "mobility", muscleGroups: ["shoulders"], cue: "Using a band or stick, rotate the arms overhead and behind the back." },
  { name: "Yoga Flow — Sun Salutation", category: "mobility", muscleGroups: ["full body"], cue: "Move through a linked sequence of standing and forward-fold yoga poses." },
  { name: "Static Stretch — Full Body Cooldown", category: "mobility", muscleGroups: ["full body"], cue: "Hold gentle stretches for major muscle groups after training." },
  { name: "Jump Rope", category: "cardio", muscleGroups: ["calves", "cardiovascular"], cue: "Maintain a steady rhythm with light, quick bounces off the balls of the feet." },
  { name: "Elliptical", category: "cardio", muscleGroups: ["legs", "cardiovascular"], cue: "Maintain a steady cadence and resistance for continuous low-impact cardio." },
  { name: "Rowing Machine", category: "cardio", muscleGroups: ["back", "legs", "cardiovascular"], cue: "Drive with the legs, then lean back and pull, reversing the sequence to recover." },
  { name: "Stair Climber", category: "cardio", muscleGroups: ["legs", "cardiovascular"], cue: "Maintain a steady step cadence without leaning heavily on the rails." },
  { name: "Battle Ropes", category: "cardio", muscleGroups: ["shoulders", "core", "cardiovascular"], cue: "Alternate or double-wave the ropes with quick, powerful arm movements." },
  { name: "Assault Bike / Air Bike Intervals", category: "cardio", muscleGroups: ["full body", "cardiovascular"], cue: "Alternate hard sprint efforts with easy recovery pedaling on the air bike." },
  { name: "Swimming — Freestyle Laps", category: "cardio", muscleGroups: ["full body", "cardiovascular"], cue: "Maintain steady stroke technique and breathing rhythm across laps." },
  { name: "Stair Sprints", category: "cardio", muscleGroups: ["legs", "cardiovascular"], cue: "Sprint up a flight of stairs, walking down to recover between reps." },
  { name: "Swimming — Interval Sets", category: "cardio", muscleGroups: ["full body", "cardiovascular"], cue: "Alternate hard and easy swim intervals on a set rest period." },
  { name: "Brisk Walking", category: "cardio", muscleGroups: ["legs", "cardiovascular"], cue: "Maintain a brisk, purposeful walking pace for continuous low-impact cardio." },
  { name: "Hiking", category: "cardio", muscleGroups: ["legs", "cardiovascular"], cue: "Sustained walking effort over varied outdoor terrain and elevation." },
  { name: "Jump Rope — Double Unders", category: "cardio", muscleGroups: ["calves", "cardiovascular"], cue: "Spin the rope twice per jump, maintaining a quick, consistent rhythm." },
  { name: "Boxing — Heavy Bag Rounds", category: "cardio", muscleGroups: ["full body", "cardiovascular"], cue: "Work timed rounds on the heavy bag combining combinations and footwork." },
  { name: "Boxing — Shadowboxing", category: "cardio", muscleGroups: ["full body", "cardiovascular"], cue: "Throw combinations against an imaginary opponent, focusing on form and movement." },
  { name: "Circuit Training — Full Body", category: "cardio", muscleGroups: ["full body", "cardiovascular"], cue: "Move through a timed circuit of exercises with minimal rest between stations." },
  { name: "HIIT Bodyweight Circuit", category: "cardio", muscleGroups: ["full body", "cardiovascular"], cue: "Alternate short, maximal-effort bodyweight exercises with brief recovery." },
  { name: "Foam Rolling — Calves", category: "mobility", muscleGroups: ["calves"], cue: "Roll slowly along the calf, pausing on tight or tender spots." },
  { name: "Foam Rolling — Glutes", category: "mobility", muscleGroups: ["glutes"], cue: "Sit on the roller and shift weight to target tight areas of the glutes." },
  { name: "Pigeon Pose Stretch", category: "mobility", muscleGroups: ["hips", "glutes"], cue: "From a forward-fold hip position, sink into the stretch while keeping the spine tall." },
  { name: "Doorway Chest Stretch", category: "mobility", muscleGroups: ["chest", "shoulders"], cue: "Press the forearm against a doorframe and step through to stretch the chest." },
  { name: "Cross-Body Shoulder Stretch", category: "mobility", muscleGroups: ["shoulders"], cue: "Pull one arm across the chest, holding gently with the opposite arm." },
  { name: "Seated Spinal Twist", category: "mobility", muscleGroups: ["spine", "obliques"], cue: "Seated with legs extended or crossed, rotate the torso and look over the shoulder." },
  { name: "Deep Squat Hold", category: "mobility", muscleGroups: ["hips", "ankles"], cue: "Hold a relaxed deep squat position to open the hips and ankles." },
  { name: "Band Pull-Apart", category: "mobility", muscleGroups: ["shoulders", "back"], cue: "Pull a light band apart at chest height, squeezing the shoulder blades together." },
  { name: "Foam Rolling — Lats", category: "mobility", muscleGroups: ["back"], cue: "Roll along the side of the ribcage to release the lats." },
  { name: "Wrist Mobility Drill", category: "mobility", muscleGroups: ["forearms"], cue: "Circle and flex the wrists through their full range to prep for pressing work." },
  { name: "Neck Mobility Drill", category: "mobility", muscleGroups: ["neck"], cue: "Gently move the head through flexion, extension, and rotation." },
  { name: "Standing Quad Stretch", category: "mobility", muscleGroups: ["quads"], cue: "Pull one heel toward the glutes while keeping the knees close together." },
  { name: "Calf Stretch on Wall", category: "mobility", muscleGroups: ["calves"], cue: "Lean into a wall with the back heel down to stretch the calf." },
  { name: "Child's Pose Stretch", category: "mobility", muscleGroups: ["back", "hips"], cue: "Sit back onto the heels with arms extended forward to stretch the back." },
  { name: "Downward Dog Stretch", category: "mobility", muscleGroups: ["hamstrings", "calves", "shoulders"], cue: "Form an inverted V, pressing the heels toward the floor and chest toward the thighs." },
  { name: "Kettlebell Complex — Conditioning", category: "cardio", muscleGroups: ["full body", "cardiovascular"], cue: "Chain multiple kettlebell movements together without setting the bell down." },
  { name: "Sled Sprint Conditioning", category: "cardio", muscleGroups: ["legs", "cardiovascular"], cue: "Sprint-push a lightly loaded sled for short, high-effort intervals." },
  { name: "Medicine Ball Slams", category: "cardio", muscleGroups: ["full body", "core"], cue: "Slam the ball to the floor explosively using the whole body, then reset and repeat." },
  { name: "Tabata Bodyweight Intervals", category: "cardio", muscleGroups: ["full body", "cardiovascular"], cue: "20 seconds max effort, 10 seconds rest, repeated for 8 rounds." },
  { name: "Farmer's Carry Conditioning", category: "cardio", muscleGroups: ["full body", "cardiovascular"], cue: "Carry heavy loads for distance or time as a conditioning finisher." },
  { name: "Prowler Push Conditioning", category: "cardio", muscleGroups: ["legs", "cardiovascular"], cue: "Push a loaded prowler sled for short, high-effort distances." },
];

for (const m of MOBILITY_CARDIO) {
  add(m.name, m.category, m.muscleGroups, null, m.cue);
}

// ---------------------------------------------------------------------------

console.log(`Generated ${exercises.length} exercises`);
const byCategory = exercises.reduce((acc, e) => {
  acc[e.category] = (acc[e.category] ?? 0) + 1;
  return acc;
}, {});
console.log(byCategory);

writeFileSync(
  new URL("../data/exercises.json", import.meta.url),
  JSON.stringify(exercises, null, 2),
);
