import "dotenv/config";
import { db } from "./index";
import { exercises } from "./schema";

interface ExDef {
  name: string;
  muscleGroup: string;
  equipment: string | null;
  defaultSets: number;
  notes: string | null;
}

// Curated additions. Grouped by muscleGroup. Default 3 sets unless notes say otherwise.
// Equipment uses lowercase tags so the picker chips read consistently.
const ADDITIONS: ExDef[] = [
  // chest
  { name: "Dumbbell Bench Press", muscleGroup: "chest", equipment: "dumbbells", defaultSets: 3, notes: "Flat bench. Bigger ROM than barbell." },
  { name: "Decline Bench Press", muscleGroup: "chest", equipment: "barbell", defaultSets: 3, notes: "Targets lower-pec fibres." },
  { name: "Machine Chest Press", muscleGroup: "chest", equipment: "machine", defaultSets: 3, notes: "Stable; good for high-rep finishers." },
  { name: "Cable Crossover", muscleGroup: "chest", equipment: "cable", defaultSets: 3, notes: "High-to-low. Squeeze at midline." },
  { name: "Pec Deck", muscleGroup: "chest", equipment: "machine", defaultSets: 3, notes: "Strict ROM; great for hypertrophy." },
  { name: "Push-up", muscleGroup: "chest", equipment: "bodyweight", defaultSets: 3, notes: "Add weight or elevate feet to scale." },
  { name: "Svend Press", muscleGroup: "chest", equipment: "plate", defaultSets: 2, notes: "Plate squeeze; inner-pec finisher." },

  // back
  { name: "Barbell Row", muscleGroup: "back", equipment: "barbell", defaultSets: 3, notes: "Pendlay-style: dead-stop each rep." },
  { name: "Pendlay Row", muscleGroup: "back", equipment: "barbell", defaultSets: 3, notes: "Strict, explosive concentric." },
  { name: "Single-Arm DB Row", muscleGroup: "back", equipment: "dumbbell", defaultSets: 3, notes: "Bench supported." },
  { name: "Meadows Row", muscleGroup: "back", equipment: "barbell", defaultSets: 3, notes: "Landmine, single-arm. Lats + upper back." },
  { name: "Wide-Grip Lat Pulldown", muscleGroup: "back", equipment: "cable", defaultSets: 3, notes: "Lats. Slight lean-back." },
  { name: "Chin-up", muscleGroup: "back", equipment: "bodyweight", defaultSets: 3, notes: "Underhand. Biceps + lats." },
  { name: "Reverse Pec Deck", muscleGroup: "back", equipment: "machine", defaultSets: 3, notes: "Upper back / rear delts." },
  { name: "Straight-Arm Pulldown", muscleGroup: "back", equipment: "cable", defaultSets: 3, notes: "Lat isolation, no elbow flexion." },
  { name: "Barbell Shrug", muscleGroup: "back", equipment: "barbell", defaultSets: 3, notes: "Upper traps." },

  // quads
  { name: "Front Squat", muscleGroup: "quads", equipment: "barbell", defaultSets: 3, notes: "More upright torso, more quad-dominant." },
  { name: "Goblet Squat", muscleGroup: "quads", equipment: "dumbbell", defaultSets: 3, notes: "Beginner-friendly; great warm-up." },
  { name: "Leg Press", muscleGroup: "quads", equipment: "machine", defaultSets: 3, notes: "Feet low for quads, high for glutes." },
  { name: "Walking Lunge", muscleGroup: "quads", equipment: "dumbbells", defaultSets: 3, notes: "10–12 steps per leg." },
  { name: "Step-up", muscleGroup: "quads", equipment: "dumbbells", defaultSets: 3, notes: "Knee-height bench." },
  { name: "Sissy Squat", muscleGroup: "quads", equipment: "bodyweight", defaultSets: 3, notes: "Knees-forward; rectus femoris." },
  { name: "Belt Squat", muscleGroup: "quads", equipment: "machine", defaultSets: 3, notes: "Spine-friendly squat alternative." },

  // hamstrings
  { name: "Lying Leg Curl", muscleGroup: "hamstrings", equipment: "machine", defaultSets: 3, notes: "Knee-flexion variant." },
  { name: "Stiff-Leg Deadlift", muscleGroup: "hamstrings", equipment: "barbell", defaultSets: 3, notes: "Slight knee bend; deep stretch." },
  { name: "Nordic Hamstring Curl", muscleGroup: "hamstrings", equipment: "bodyweight", defaultSets: 3, notes: "Eccentric-focused. Brutal." },
  { name: "Glute Ham Raise", muscleGroup: "hamstrings", equipment: "machine", defaultSets: 3, notes: "GHD bench." },
  { name: "Single-Leg RDL", muscleGroup: "hamstrings", equipment: "dumbbell", defaultSets: 3, notes: "Per leg. Balance + posterior chain." },

  // glutes (new muscle group)
  { name: "Hip Thrust", muscleGroup: "glutes", equipment: "barbell", defaultSets: 3, notes: "Pause at top; full extension." },
  { name: "Glute Bridge", muscleGroup: "glutes", equipment: "barbell", defaultSets: 3, notes: "Floor variant." },
  { name: "Cable Pull-Through", muscleGroup: "glutes", equipment: "cable", defaultSets: 3, notes: "Hip-hinge pattern." },
  { name: "Bulgarian Split Squat (Glute-Focus)", muscleGroup: "glutes", equipment: "dumbbells", defaultSets: 3, notes: "Long stride emphasises glutes." },
  { name: "Kickback", muscleGroup: "glutes", equipment: "cable", defaultSets: 3, notes: "Single-leg, glute-max." },

  // shoulders
  { name: "Seated DB Press", muscleGroup: "shoulders", equipment: "dumbbells", defaultSets: 3, notes: "Bigger ROM than barbell." },
  { name: "Push Press", muscleGroup: "shoulders", equipment: "barbell", defaultSets: 3, notes: "Leg drive; allows heavier loads." },
  { name: "Arnold Press", muscleGroup: "shoulders", equipment: "dumbbells", defaultSets: 3, notes: "Rotational; hits all 3 heads." },
  { name: "Landmine Press", muscleGroup: "shoulders", equipment: "barbell", defaultSets: 3, notes: "Joint-friendly OHP alternative." },
  { name: "Machine Shoulder Press", muscleGroup: "shoulders", equipment: "machine", defaultSets: 3, notes: "Stable; good for high-rep work." },

  // side-delts
  { name: "DB Lateral Raise", muscleGroup: "side-delts", equipment: "dumbbells", defaultSets: 3, notes: "Lean forward slightly." },
  { name: "Machine Lateral Raise", muscleGroup: "side-delts", equipment: "machine", defaultSets: 3, notes: "Constant tension." },
  { name: "Y-Raise", muscleGroup: "side-delts", equipment: "dumbbells", defaultSets: 3, notes: "Incline bench. Upper back + delts." },
  { name: "Upright Row", muscleGroup: "side-delts", equipment: "barbell", defaultSets: 3, notes: "Wider grip = friendlier on shoulders." },

  // rear-delts
  { name: "Rear Delt Fly", muscleGroup: "rear-delts", equipment: "dumbbells", defaultSets: 3, notes: "Bent-over or chest-supported." },
  { name: "Reverse Cable Fly", muscleGroup: "rear-delts", equipment: "cable", defaultSets: 3, notes: "High-cable, cross-body." },
  { name: "Bent-Over Lateral Raise", muscleGroup: "rear-delts", equipment: "dumbbells", defaultSets: 3, notes: "Chest on incline bench." },

  // biceps
  { name: "Barbell Curl", muscleGroup: "biceps", equipment: "barbell", defaultSets: 3, notes: "Strict; no swing." },
  { name: "EZ-Bar Curl", muscleGroup: "biceps", equipment: "ez-bar", defaultSets: 3, notes: "Wrist-friendly." },
  { name: "Preacher Curl", muscleGroup: "biceps", equipment: "machine", defaultSets: 3, notes: "Stretched-position emphasis." },
  { name: "Concentration Curl", muscleGroup: "biceps", equipment: "dumbbell", defaultSets: 3, notes: "Single arm; isolation." },
  { name: "Spider Curl", muscleGroup: "biceps", equipment: "dumbbells", defaultSets: 3, notes: "Incline bench, face-down." },
  { name: "Cable Curl", muscleGroup: "biceps", equipment: "cable", defaultSets: 3, notes: "Constant tension." },
  { name: "Reverse Curl", muscleGroup: "biceps", equipment: "ez-bar", defaultSets: 3, notes: "Brachialis + forearms." },

  // triceps
  { name: "Skull Crusher", muscleGroup: "triceps", equipment: "ez-bar", defaultSets: 3, notes: "Lying tricep extension." },
  { name: "Bench Dip", muscleGroup: "triceps", equipment: "bodyweight", defaultSets: 3, notes: "Add a plate on lap to scale." },
  { name: "Diamond Push-up", muscleGroup: "triceps", equipment: "bodyweight", defaultSets: 3, notes: "Hands together; tricep-emphasis." },
  { name: "JM Press", muscleGroup: "triceps", equipment: "barbell", defaultSets: 3, notes: "Hybrid skull-crusher / close-grip." },
  { name: "DB Triceps Kickback", muscleGroup: "triceps", equipment: "dumbbell", defaultSets: 3, notes: "Bent-over, single arm." },
  { name: "Tate Press", muscleGroup: "triceps", equipment: "dumbbells", defaultSets: 3, notes: "Elbows out; medial head." },

  // calves
  { name: "Donkey Calf Raise", muscleGroup: "calves", equipment: "machine", defaultSets: 4, notes: "Bent at hips; max stretch." },
  { name: "Single-Leg Calf Raise", muscleGroup: "calves", equipment: "bodyweight", defaultSets: 4, notes: "Hold a DB for load." },
  { name: "Leg Press Calf Raise", muscleGroup: "calves", equipment: "machine", defaultSets: 4, notes: "Toes on bottom of platform." },

  // abs
  { name: "Plank", muscleGroup: "abs", equipment: "bodyweight", defaultSets: 3, notes: "Hold to fatigue; squeeze glutes." },
  { name: "Side Plank", muscleGroup: "abs", equipment: "bodyweight", defaultSets: 3, notes: "Per side. Obliques." },
  { name: "Russian Twist", muscleGroup: "abs", equipment: "plate", defaultSets: 3, notes: "Heels up; controlled rotation." },
  { name: "Ab Wheel Rollout", muscleGroup: "abs", equipment: "ab-wheel", defaultSets: 3, notes: "Knee or full ROM." },
  { name: "Dead Bug", muscleGroup: "abs", equipment: "bodyweight", defaultSets: 3, notes: "Anti-extension; lower back-friendly." },
  { name: "Pallof Press", muscleGroup: "abs", equipment: "cable", defaultSets: 3, notes: "Anti-rotation. 8–12/side." },
  { name: "Decline Sit-up", muscleGroup: "abs", equipment: "bodyweight", defaultSets: 3, notes: "Add plate to scale." },
  { name: "Wood Chop", muscleGroup: "abs", equipment: "cable", defaultSets: 3, notes: "Rotational power." },

  // forearms (new muscle group)
  { name: "Wrist Curl", muscleGroup: "forearms", equipment: "barbell", defaultSets: 3, notes: "Bench-supported." },
  { name: "Reverse Wrist Curl", muscleGroup: "forearms", equipment: "barbell", defaultSets: 3, notes: "Wrist extensors." },
  { name: "Farmer's Carry", muscleGroup: "forearms", equipment: "dumbbells", defaultSets: 3, notes: "Walk for time or distance." },
  { name: "Wrist Roller", muscleGroup: "forearms", equipment: "specialty", defaultSets: 2, notes: "Roll up and down." },

  // traps (new muscle group; was lumped into back)
  { name: "DB Shrug", muscleGroup: "traps", equipment: "dumbbells", defaultSets: 3, notes: "Pause at top." },
  { name: "Trap Bar Shrug", muscleGroup: "traps", equipment: "trap-bar", defaultSets: 3, notes: "Heavier than barbell shrug." },
  { name: "Face Pull (Traps Focus)", muscleGroup: "traps", equipment: "cable", defaultSets: 3, notes: "Higher elbows; mid-traps." },
];

async function main() {
  console.log(`Adding ${ADDITIONS.length} exercises (idempotent)…`);

  // Read existing names so we don't insert duplicates.
  const existing = await db.select({ name: exercises.name }).from(exercises);
  const existingNames = new Set(existing.map((e) => e.name));

  const toInsert = ADDITIONS.filter((e) => !existingNames.has(e.name));
  if (toInsert.length === 0) {
    console.log("Already up-to-date — no new rows.");
    process.exit(0);
  }

  await db.insert(exercises).values(
    toInsert.map((e) => ({
      name: e.name,
      muscleGroup: e.muscleGroup,
      equipment: e.equipment,
      defaultSets: e.defaultSets,
      isMainLift: false,
      notes: e.notes,
    })),
  );

  console.log(`Added ${toInsert.length} new exercises.`);
  if (toInsert.length < ADDITIONS.length) {
    console.log(`Skipped ${ADDITIONS.length - toInsert.length} that already existed.`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
