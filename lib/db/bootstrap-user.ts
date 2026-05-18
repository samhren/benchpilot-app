// Bootstraps a fresh account's data: lifts, settings, and a full 14-week
// program. Called when a new PIN signs up. Purely additive — never deletes.
// The `exercises` table is a shared global library; this only inserts library
// rows that don't already exist.
import { db } from "@/lib/db";
import {
  exercises,
  lifts,
  programDays,
  programExercises,
  programs,
  settings,
  tmHistory,
} from "@/lib/db/schema";
import { buildExerciseLibrary, buildProgramDays } from "@/lib/programming/seed-program";

function nextMonday(): string {
  const d = new Date();
  const day = d.getUTCDay(); // 0 Sun ... 6 Sat
  const diff = (8 - (day === 0 ? 7 : day)) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

export async function bootstrapUserData(userId: string): Promise<void> {
  // 1. Shared exercise library — ensure every exercise the program references
  //    exists in the global table, inserting only the missing ones.
  const lib = buildExerciseLibrary();
  const existing = await db
    .select({ id: exercises.id, name: exercises.name })
    .from(exercises);
  const exByName = new Map(existing.map((e) => [e.name, e.id]));
  const missing = lib.filter((e) => !exByName.has(e.name));
  if (missing.length > 0) {
    const inserted = await db
      .insert(exercises)
      .values(
        missing.map((e) => ({
          name: e.name,
          muscleGroup: e.muscleGroup,
          defaultSets: e.defaultSets,
          isMainLift: e.isMainLift,
          notes: e.notes,
        })),
      )
      .returning({ id: exercises.id, name: exercises.name });
    for (const r of inserted) exByName.set(r.name, r.id);
  }

  // 2. Lifts (no 1RM yet — user enters in Settings)
  const liftRows = await db
    .insert(lifts)
    .values([
      { userId, name: "bench_press" },
      { userId, name: "back_squat" },
      { userId, name: "deadlift" },
      { userId, name: "overhead_press" },
    ])
    .returning();
  const liftByName = new Map(liftRows.map((l) => [l.name, l.id]));

  // 3. Settings (one row per user)
  await db.insert(settings).values({ userId });

  // 4. Program + days + exercises
  const [program] = await db
    .insert(programs)
    .values({
      userId,
      name: "Bench-Focused Recomp",
      startDate: nextMonday(),
      totalWeeks: 14,
      currentWeek: 1,
      currentBlock: "1",
      status: "active",
    })
    .returning();

  const planned = buildProgramDays();
  for (const d of planned) {
    const [pd] = await db
      .insert(programDays)
      .values({
        userId,
        programId: program.id,
        weekNumber: d.weekNumber,
        dayOfWeek: d.dayOfWeek,
        sessionType: d.sessionType,
        displayName: d.displayName,
      })
      .returning();

    if (d.exercises.length === 0) continue;

    await db.insert(programExercises).values(
      d.exercises.map((e) => {
        const exerciseId = exByName.get(e.exerciseName);
        if (!exerciseId) throw new Error(`bootstrap: missing exercise "${e.exerciseName}"`);
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
      }),
    );
  }

  // 5. Zero-baseline TM history per lift
  for (const l of liftRows) {
    await db.insert(tmHistory).values({
      userId,
      liftId: l.id,
      trainingMax: 0,
      reason: "initial",
      notes: "Initial — set 1RM in Settings to populate.",
    });
  }
}
