import "dotenv/config";
import { and, eq, inArray, isNotNull, notInArray, or } from "drizzle-orm";
import { resolveScriptTarget } from "./script-target";
import {
  exercises,
  lifts,
  programDays,
  programExercises,
  programs,
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

// PLAN_TARGET=dev|prod. Named explicitly rather than relying on the older
// `DATABASE_URL=$PROD_DATABASE_URL` npm-script trick: that expands to an EMPTY
// string whenever PROD_DATABASE_URL lives in .env but was never exported into
// the shell, and lib/db/index.ts then quietly connects somewhere other than
// production while reporting success. See script-target.ts.
const { db, client, announce } = resolveScriptTarget("PLAN_TARGET");
export { db, client, announce };

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
    { name: "T-Bar Row", sets: 2, reps: 11, rir: 1 },
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
    { name: "T-Bar Row", sets: 4, reps: 9, rir: 1 },
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
  "T-Bar Row": { muscleGroup: "back", equipment: "t-bar" },
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

// Deload weeks keep the same weekly shape (Mon upper A / Tue lower A / Wed
// upper B / Fri upper C / Sat lower B) and the same accessory work — only the
// bench percentages drop. But their `program_days.session_type` is the single
// value "deload", so keying the accessory plan off session type alone silently
// skipped the entire deload week and left it on whatever plan it was seeded
// with. Map those days back onto their profile by day-of-week.
//
// `test` week is deliberately NOT mapped: it is bench-only by design (a 1RM
// attempt with no accessory work), so applying an accessory list there would
// invent a day that was never meant to exist.
const DELOAD_PROFILE_BY_DOW: Record<number, SessionType> = {
  1: "upper_a",
  2: "lower_a",
  3: "upper_b",
  5: "upper_c",
  6: "lower_b",
};

async function unstartedDaysOfType(userId: string, sessionType: SessionType) {
  const started = await db
    .selectDistinct({ programDayId: workoutSessions.programDayId })
    .from(workoutSessions)
    .where(and(eq(workoutSessions.userId, userId), isNotNull(workoutSessions.programDayId)));
  const startedIds = started.map((s) => s.programDayId).filter((x): x is string => x != null);
  // Scoped to the ACTIVE program. Without this, a user who has restarted their
  // program (restart-program.ts archives the old one as `completed`) would also
  // have the archived run's un-started days rewritten — silently editing the
  // record of a program they already finished with.
  const deloadDows = Object.entries(DELOAD_PROFILE_BY_DOW)
    .filter(([, st]) => st === sessionType)
    .map(([dow]) => Number(dow));

  const matchesProfile = or(
    eq(programDays.sessionType, sessionType),
    deloadDows.length > 0
      ? and(
          eq(programDays.sessionType, "deload"),
          inArray(programDays.dayOfWeek, deloadDows),
        )
      : undefined,
  );
  const base = and(matchesProfile, eq(programDays.userId, userId), eq(programs.status, "active"));
  const where = startedIds.length > 0 ? and(base, notInArray(programDays.id, startedIds)) : base;
  return db
    .select({
      id: programDays.id,
      weekNumber: programDays.weekNumber,
      dayOfWeek: programDays.dayOfWeek,
    })
    .from(programDays)
    .innerJoin(programs, eq(programs.id, programDays.programId))
    .where(where)
    .orderBy(programDays.weekNumber, programDays.dayOfWeek);
}

// DRY_RUN=1 reports exactly what would change without writing anything. These
// migrations are normally run straight at production, so being able to read the
// diff first is the difference between a reviewed change and a hoped-for one.
export const DRY_RUN = process.env.DRY_RUN === "1";

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
          sets: programExercises.sets,
          reps: programExercises.reps,
          rirTarget: programExercises.rirTarget,
          orderIndex: programExercises.orderIndex,
        })
        .from(programExercises)
        .innerJoin(exercises, eq(exercises.id, programExercises.exerciseId))
        .where(eq(programExercises.programDayId, d.id));

      const targetIds = new Set(items.map((it) => exId.get(it.name)!));
      const where = `w${d.weekNumber}-d${d.dayOfWeek} ${st}`;

      // Upsert each target item in order (bench occupies order 1 on upper days).
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const id = exId.get(it.name)!;
        const orderIndex = isUpper ? i + 2 : i + 1;
        const existing = rows.find((r) => r.exerciseId === id);
        if (existing) {
          // Only count and write a row that actually differs, so the reported
          // numbers mean "what changed" rather than "what was visited" — that
          // is what makes a re-run visibly a no-op.
          const same =
            existing.sets === it.sets &&
            existing.reps === it.reps &&
            existing.rirTarget === it.rir &&
            existing.orderIndex === orderIndex;
          if (same) continue;
          console.log(
            `    ~ ${where}: ${it.name} ${existing.sets}x${existing.reps} rir${existing.rirTarget} ` +
              `(#${existing.orderIndex}) → ${it.sets}x${it.reps} rir${it.rir} (#${orderIndex})`,
          );
          if (!DRY_RUN) {
            await db
              .update(programExercises)
              .set({ sets: it.sets, reps: it.reps, rirTarget: it.rir, orderIndex })
              .where(eq(programExercises.id, existing.id));
          }
          totUpdated += 1;
        } else {
          console.log(`    + ${where}: ${it.name} ${it.sets}x${it.reps} rir${it.rir} (#${orderIndex})`);
          if (!DRY_RUN) {
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
          }
          totInserted += 1;
        }
      }

      // Delete anything not in the target — except the bench wave row(s), which
      // carry the bench prescription and are never touched by this migration.
      for (const r of rows) {
        if (r.name.startsWith("Bench Press")) continue;
        if (!targetIds.has(r.exerciseId)) {
          console.log(`    - ${where}: ${r.name} ${r.sets}x${r.reps}`);
          if (!DRY_RUN) {
            await db.delete(programExercises).where(eq(programExercises.id, r.id));
          }
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
