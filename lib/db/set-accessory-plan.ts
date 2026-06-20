import "dotenv/config";
import { and, eq, isNotNull, notInArray } from "drizzle-orm";
import { db } from "./index";
import {
  exercises,
  lifts,
  programDays,
  programExercises,
  workoutSessions,
  type liftNameEnum,
  type sessionTypeEnum,
} from "./schema";

// Idempotent, declarative. Forces each session type's accessory work to EXACTLY
// the target below, on program days that have NOT been started yet. Already
// logged / in-progress workouts (their own session_exercises snapshot) are
// never touched, and because untouched/un-started template rows have no session
// FK, deletes here are safe.
//
// Converges any starting variant to the same plan: updates matching rows in
// place (preserving main-lift liftId + the bench wave rows), inserts anything
// missing, deletes anything not in the target. Bench Press rows are preserved
// untouched (they hold the % wave). Scoped to one user (default = legacy/Sam).

type SessionType = (typeof sessionTypeEnum.enumValues)[number];
type LiftName = (typeof liftNameEnum.enumValues)[number];

const TARGET_USER_ID = process.env.TARGET_USER_ID ?? "00000000-0000-0000-0000-000000000001";

interface Item {
  name: string;
  sets: number;
  reps: number;
  rir: number;
  liftName?: LiftName; // set for tracked main lifts so a fresh insert links correctly
}

// Accessory plan per session type (bench wave is separate and preserved).
const TARGET: Record<string, Item[]> = {
  upper_a: [
    { name: "Weighted Pull-up", sets: 3, reps: 7, rir: 2 },
    { name: "Seated Cable Row", sets: 2, reps: 11, rir: 1 },
    { name: "Chest-Supported Machine Row", sets: 2, reps: 11, rir: 1 },
    { name: "Incline DB Press", sets: 2, reps: 9, rir: 1 },
    { name: "Hammer Curl", sets: 2, reps: 11, rir: 1 },
    { name: "Cable Face Pull", sets: 3, reps: 13, rir: 1 },
    { name: "Cable Lateral Raise", sets: 2, reps: 13, rir: 0 },
    { name: "Overhead Press", sets: 3, reps: 6, rir: 2, liftName: "overhead_press" },
  ],
  lower_a: [
    { name: "Back Squat", sets: 4, reps: 5, rir: 2, liftName: "back_squat" },
    { name: "Bulgarian Split Squat", sets: 2, reps: 9, rir: 1 },
    { name: "Seated Leg Curl", sets: 2, reps: 11, rir: 1 },
    { name: "Standing Calf Raise", sets: 4, reps: 10, rir: 1 },
    { name: "Weighted Hanging Leg Raise", sets: 3, reps: 10, rir: 1 },
  ],
  upper_b: [
    { name: "Chest-Supported Smith Row", sets: 4, reps: 9, rir: 1 },
    { name: "One-Arm Lat Pulldown", sets: 2, reps: 11, rir: 1 },
    { name: "Reverse Pec Deck", sets: 2, reps: 12, rir: 1 },
    { name: "Cable Lateral Raise", sets: 3, reps: 12, rir: 1 },
    { name: "Overhead Cable Triceps Extension", sets: 2, reps: 13, rir: 0 },
    { name: "Preacher Curl", sets: 2, reps: 10, rir: 1 },
  ],
  upper_c: [
    { name: "Close-Grip Bench Press", sets: 2, reps: 7, rir: 2 },
    { name: "Overhead Cable Triceps Extension", sets: 3, reps: 11, rir: 1 },
    { name: "Incline DB Curl", sets: 2, reps: 11, rir: 1 },
    { name: "Cable Lateral Raise", sets: 2, reps: 13, rir: 0 },
  ],
  lower_b: [
    { name: "Romanian Deadlift", sets: 3, reps: 7, rir: 2 },
    { name: "Hack Squat", sets: 2, reps: 9, rir: 1 },
    { name: "Leg Extension", sets: 2, reps: 11, rir: 1 },
    { name: "Seated Leg Curl", sets: 2, reps: 11, rir: 1 },
    { name: "Standing Calf Raise", sets: 3, reps: 12, rir: 1 },
    { name: "Weighted Cable Crunch", sets: 3, reps: 12, rir: 1 },
  ],
};

// Catalog metadata so any target exercise missing on a given DB is created with
// a sensible muscle group (drives the insights region fallback).
const CATALOG: Record<string, { muscleGroup: string; equipment: string | null }> = {
  "Weighted Pull-up": { muscleGroup: "back", equipment: "pull-up-bar" },
  "Seated Cable Row": { muscleGroup: "back", equipment: "cable" },
  "Chest-Supported Machine Row": { muscleGroup: "back", equipment: "machine" },
  "Incline DB Press": { muscleGroup: "chest", equipment: "dumbbell" },
  "Hammer Curl": { muscleGroup: "biceps", equipment: "dumbbell" },
  "Cable Face Pull": { muscleGroup: "rear-delts", equipment: "cable" },
  "Cable Lateral Raise": { muscleGroup: "side-delts", equipment: "cable" },
  "Overhead Press": { muscleGroup: "shoulders", equipment: "barbell" },
  "Back Squat": { muscleGroup: "quads", equipment: "barbell" },
  "Bulgarian Split Squat": { muscleGroup: "quads", equipment: "dumbbell" },
  "Seated Leg Curl": { muscleGroup: "hamstrings", equipment: "machine" },
  "Standing Calf Raise": { muscleGroup: "calves", equipment: "machine" },
  "Weighted Hanging Leg Raise": { muscleGroup: "abs", equipment: "pull-up-bar" },
  "Chest-Supported Smith Row": { muscleGroup: "back", equipment: "smith" },
  "One-Arm Lat Pulldown": { muscleGroup: "back", equipment: "cable" },
  "Reverse Pec Deck": { muscleGroup: "rear-delts", equipment: "machine" },
  "Overhead Cable Triceps Extension": { muscleGroup: "triceps", equipment: "cable" },
  "Preacher Curl": { muscleGroup: "biceps", equipment: "machine" },
  "Close-Grip Bench Press": { muscleGroup: "triceps", equipment: "barbell" },
  "Incline DB Curl": { muscleGroup: "biceps", equipment: "dumbbell" },
  "Romanian Deadlift": { muscleGroup: "hamstrings", equipment: "barbell" },
  "Hack Squat": { muscleGroup: "quads", equipment: "machine" },
  "Leg Extension": { muscleGroup: "quads", equipment: "machine" },
  "Weighted Cable Crunch": { muscleGroup: "abs", equipment: "cable" },
};

// Resolve catalog ids for every target exercise (creating any missing). The
// exercises table is a shared global catalog, so this runs once regardless of
// how many users we then converge.
export async function resolveTargetExerciseIds(): Promise<Map<string, string>> {
  const exId = new Map<string, string>();
  for (const items of Object.values(TARGET)) {
    for (const it of items) if (!exId.has(it.name)) exId.set(it.name, await ensureExercise(it.name));
  }
  return exId;
}

async function ensureExercise(name: string): Promise<string> {
  const [existing] = await db.select().from(exercises).where(eq(exercises.name, name)).limit(1);
  if (existing) return existing.id;
  const meta = CATALOG[name] ?? { muscleGroup: "back", equipment: null };
  const [row] = await db
    .insert(exercises)
    .values({ name, muscleGroup: meta.muscleGroup, equipment: meta.equipment, isMainLift: false })
    .returning({ id: exercises.id });
  console.log(`  + created exercise in catalog: ${name}`);
  return row.id;
}

async function unstartedDaysOfType(userId: string, sessionType: SessionType) {
  const started = await db
    .selectDistinct({ programDayId: workoutSessions.programDayId })
    .from(workoutSessions)
    .where(and(eq(workoutSessions.userId, userId), isNotNull(workoutSessions.programDayId)));
  const startedIds = started.map((s) => s.programDayId).filter((x): x is string => x != null);
  const base = and(eq(programDays.sessionType, sessionType), eq(programDays.userId, userId));
  const where = startedIds.length > 0 ? and(base, notInArray(programDays.id, startedIds)) : base;
  return db
    .select({ id: programDays.id, weekNumber: programDays.weekNumber })
    .from(programDays)
    .where(where);
}

// Converge ONE user's future (un-started) program days to the TARGET plan,
// idempotently. Pass the shared catalog id map from resolveTargetExerciseIds().
export async function applyAccessoryPlanForUser(
  userId: string,
  exId: Map<string, string>,
): Promise<{ updated: number; inserted: number; deleted: number; days: number }> {
  // Tracked-lift ids for fresh inserts of main lifts.
  const liftRows = await db
    .select({ id: lifts.id, name: lifts.name })
    .from(lifts)
    .where(eq(lifts.userId, userId));
  const liftId = new Map(liftRows.map((l) => [l.name as LiftName, l.id]));

  let totUpdated = 0;
  let totInserted = 0;
  let totDeleted = 0;
  let totDays = 0;

  for (const st of Object.keys(TARGET) as SessionType[]) {
    const items = TARGET[st];
    const isUpper = st.startsWith("upper");
    const days = await unstartedDaysOfType(userId, st);
    totDays += days.length;

    for (const d of days) {
      const rows = await db
        .select({
          id: programExercises.id,
          exerciseId: programExercises.exerciseId,
          name: exercises.name,
        })
        .from(programExercises)
        .innerJoin(exercises, eq(exercises.id, programExercises.exerciseId))
        .where(eq(programExercises.programDayId, d.id));

      const targetIds = new Set(items.map((it) => exId.get(it.name)!));

      // Upsert each target item in order (bench occupies order 1 on upper days).
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const id = exId.get(it.name)!;
        const orderIndex = isUpper ? i + 2 : i + 1;
        const existing = rows.find((r) => r.exerciseId === id);
        if (existing) {
          await db
            .update(programExercises)
            .set({ sets: it.sets, reps: it.reps, rirTarget: it.rir, orderIndex })
            .where(eq(programExercises.id, existing.id));
          totUpdated += 1;
        } else {
          await db.insert(programExercises).values({
            userId,
            programDayId: d.id,
            orderIndex,
            exerciseId: id,
            prescriptionType: "rir_target",
            sets: it.sets,
            reps: it.reps,
            rirTarget: it.rir,
            isAmrapTopSet: false,
            liftId: it.liftName ? liftId.get(it.liftName) ?? null : null,
          });
          totInserted += 1;
        }
      }

      // Delete anything not in the target — except the bench wave row(s).
      for (const r of rows) {
        if (r.name.startsWith("Bench Press")) continue;
        if (!targetIds.has(r.exerciseId)) {
          await db.delete(programExercises).where(eq(programExercises.id, r.id));
          totDeleted += 1;
        }
      }
    }
  }

  return { updated: totUpdated, inserted: totInserted, deleted: totDeleted, days: totDays };
}

async function main() {
  console.log(`Setting accessory plan for user ${TARGET_USER_ID} (future weeks only, idempotent)…`);

  const exId = await resolveTargetExerciseIds();
  const stats = await applyAccessoryPlanForUser(TARGET_USER_ID, exId);
  console.log(
    `  ${stats.days} future day(s) — ${stats.updated} updated, ${stats.inserted} inserted, ${stats.deleted} deleted`,
  );

  console.log("Done.");
  process.exit(0);
}

// Only run when invoked directly (tsx lib/db/set-accessory-plan.ts), NOT when
// imported by the all-users runner, which reuses the exported helpers above.
if (process.argv[1] && /set-accessory-plan\.ts$/.test(process.argv[1])) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
