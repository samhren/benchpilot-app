import "dotenv/config";
import { db } from "./index";
import {
  bodyWeightLogs,
  dayStatus,
  exercises,
  lifts,
  programDays,
  programExercises,
  programs,
  sessionExercises,
  settings,
  tmHistory,
  users,
  workoutSessions,
  workoutSets,
} from "./schema";
import { buildExerciseLibrary, buildProgramDays } from "../programming/seed-program";
import { resolveTrainingMax } from "../programming/training-max";
import { hashPin, LEGACY_USER_ID } from "../auth-core";
import { eq } from "drizzle-orm";

function nextMonday(): string {
  const d = new Date();
  const day = d.getUTCDay(); // 0 Sun ... 6 Sat
  const diff = (8 - (day === 0 ? 7 : day)) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

async function main() {
  console.log("Seeding BenchPilot…");

  // Full reset — wipe every table, FK-safe order (children before parents).
  await db.delete(workoutSets);
  await db.delete(sessionExercises);
  await db.delete(workoutSessions);
  await db.delete(dayStatus);
  await db.delete(bodyWeightLogs);
  await db.delete(programExercises);
  await db.delete(programDays);
  await db.delete(programs);
  await db.delete(exercises);
  await db.delete(tmHistory);
  await db.delete(lifts);
  await db.delete(settings);
  await db.delete(users);

  // Legacy user — mirrors the production migration so a fresh local DB behaves
  // like prod. Signs in with the APP_PASSWORD value as their PIN.
  const pin = process.env.APP_PASSWORD ?? "5829";
  await db.insert(users).values({
    id: LEGACY_USER_ID,
    pinHash: hashPin(pin),
    name: "Sam",
  });
  const userId = LEGACY_USER_ID;

  // Settings
  await db.insert(settings).values({ userId });

  // Lifts (no current_1rm yet — user enters in onboarding/settings)
  const liftRows = await db
    .insert(lifts)
    .values([
      { userId, name: "bench_press" },
      { userId, name: "back_squat" },
    ])
    .returning();
  const liftByName = new Map(liftRows.map((l) => [l.name, l.id]));

  // Exercises (shared library — not user-scoped)
  const lib = buildExerciseLibrary();
  const exRows = await db.insert(exercises).values(lib.map((e) => ({
    name: e.name,
    muscleGroup: e.muscleGroup,
    defaultSets: e.defaultSets,
    isMainLift: e.isMainLift,
    notes: e.notes,
  }))).returning();
  const exByName = new Map(exRows.map((e) => [e.name, e.id]));

  // Program
  const [program] = await db.insert(programs).values({
    userId,
    name: "Summer 2026 — Bench-Focused Recomp",
    startDate: nextMonday(),
    totalWeeks: 14,
    currentWeek: 1,
    currentBlock: "1",
    status: "active",
  }).returning();

  // Program days + exercises
  const planned = buildProgramDays();
  for (const d of planned) {
    const [pd] = await db.insert(programDays).values({
      userId,
      programId: program.id,
      weekNumber: d.weekNumber,
      dayOfWeek: d.dayOfWeek,
      sessionType: d.sessionType,
      displayName: d.displayName,
    }).returning();

    if (d.exercises.length === 0) continue;

    await db.insert(programExercises).values(d.exercises.map((e) => {
      const exerciseId = exByName.get(e.exerciseName);
      if (!exerciseId) throw new Error(`Missing exercise: ${e.exerciseName}`);
      return {
        userId,
        programDayId: pd.id,
        orderIndex: e.orderIndex,
        exerciseId,
        prescriptionType: e.prescriptionType,
        sets: e.sets,
        reps: e.reps,
        percentageOfTm: e.percentageOfTm ?? undefined,
        rirTarget: e.rirTarget ?? undefined,
        isAmrapTopSet: e.isAmrapTopSet,
        notes: e.notes,
        liftId: e.liftName ? liftByName.get(e.liftName) : undefined,
        wavePlan: e.wavePlan ?? undefined,
      };
    }));
  }

  // Initial TM history (zero baseline)
  for (const l of liftRows) {
    await db.insert(tmHistory).values({
      userId,
      liftId: l.id,
      trainingMax: 0,
      reason: "initial",
      notes: "Initial — set 1RM in Settings to populate.",
    });
  }

  // Demo: optional touch — leave bench TM null until user enters 1RM
  void resolveTrainingMax;
  void eq;

  console.log(`Seeded ${planned.length} program days, ${lib.length} exercises.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
