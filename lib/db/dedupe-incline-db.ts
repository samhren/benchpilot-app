import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "./index";
import {
  exercises,
  programExercises,
  sessionExercises,
  workoutSets,
} from "./schema";

// One-off: merges "Incline DB Bench" into "Incline DB Press" so history rolls
// up. Idempotent — safe to run repeatedly.
const DUPLICATE_NAME = "Incline DB Bench";
const CANONICAL_NAME = "Incline DB Press";

async function main() {
  const rows = await db.select().from(exercises);
  const canonical = rows.find((e) => e.name === CANONICAL_NAME);
  const duplicate = rows.find((e) => e.name === DUPLICATE_NAME);

  if (!duplicate) {
    console.log(`No "${DUPLICATE_NAME}" row found — nothing to merge.`);
    process.exit(0);
  }
  if (!canonical) {
    console.log(`No "${CANONICAL_NAME}" row found — renaming duplicate instead.`);
    await db
      .update(exercises)
      .set({ name: CANONICAL_NAME })
      .where(eq(exercises.id, duplicate.id));
    console.log("Renamed.");
    process.exit(0);
  }
  if (canonical.id === duplicate.id) {
    console.log("Same row — nothing to do.");
    process.exit(0);
  }

  console.log(`Merging ${duplicate.id} → ${canonical.id}`);

  const pe = await db
    .update(programExercises)
    .set({ exerciseId: canonical.id })
    .where(eq(programExercises.exerciseId, duplicate.id))
    .returning({ id: programExercises.id });
  console.log(`  program_exercises: ${pe.length} row(s) repointed`);

  const se = await db
    .update(sessionExercises)
    .set({ exerciseId: canonical.id })
    .where(eq(sessionExercises.exerciseId, duplicate.id))
    .returning({ id: sessionExercises.id });
  console.log(`  session_exercises: ${se.length} row(s) repointed`);

  const seSwap = await db
    .update(sessionExercises)
    .set({ swappedFromExerciseId: canonical.id })
    .where(eq(sessionExercises.swappedFromExerciseId, duplicate.id))
    .returning({ id: sessionExercises.id });
  console.log(`  session_exercises.swappedFrom: ${seSwap.length} row(s) repointed`);

  const ws = await db
    .update(workoutSets)
    .set({ exerciseId: canonical.id })
    .where(eq(workoutSets.exerciseId, duplicate.id))
    .returning({ id: workoutSets.id });
  console.log(`  workout_sets: ${ws.length} row(s) repointed`);

  await db.delete(exercises).where(eq(exercises.id, duplicate.id));
  console.log(`Deleted duplicate "${DUPLICATE_NAME}" row.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
