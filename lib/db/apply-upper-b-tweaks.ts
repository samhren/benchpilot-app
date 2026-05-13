import "dotenv/config";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "./index";
import {
  exercises,
  programDays,
  programExercises,
} from "./schema";

// One-off, idempotent: applies the Upper B program tweaks to existing prod data.
//   1. Renames "Chest-Supported T-Bar Row" → "Chest-Supported Smith Row" and
//      sets the per-day form-cue note for every Upper B prescription.
//   2. Swaps Upper B "Cable Triceps Pushdown" for "Overhead Cable Triceps
//      Extension" so the overhead variant runs twice a week. Past sets stay
//      pointed at the original pushdown exercise — only future prescriptions
//      change.
//
// Safe to run repeatedly: each step checks for already-applied state.

const SMITH_NOTE = "1.5x shoulder-width grip; pull to bottom of pec";

async function findByName(name: string) {
  const [row] = await db.select().from(exercises).where(eq(exercises.name, name)).limit(1);
  return row ?? null;
}

async function main() {
  // Step 1 — rename T-Bar → Smith Row, update catalog note.
  {
    const old = await findByName("Chest-Supported T-Bar Row");
    const already = await findByName("Chest-Supported Smith Row");
    if (already && old && already.id !== old.id) {
      throw new Error(
        "Both 'Chest-Supported Smith Row' and 'Chest-Supported T-Bar Row' exist as separate rows. Resolve manually.",
      );
    }
    if (old) {
      await db
        .update(exercises)
        .set({ name: "Chest-Supported Smith Row", notes: SMITH_NOTE })
        .where(eq(exercises.id, old.id));
      console.log("Renamed exercise: T-Bar → Smith Row");
    } else if (already) {
      // Make sure notes are current even if rename ran previously.
      await db.update(exercises).set({ notes: SMITH_NOTE }).where(eq(exercises.id, already.id));
      console.log("Smith Row already present — refreshed catalog note.");
    } else {
      console.log("No T-Bar or Smith Row found — skipping rename.");
    }
  }

  // Push the form-cue note onto every Upper B program_exercises row pointing
  // at Smith Row (covers all 14 weeks).
  {
    const smith = await findByName("Chest-Supported Smith Row");
    if (smith) {
      const upperBDays = await db
        .select({ id: programDays.id })
        .from(programDays)
        .where(eq(programDays.sessionType, "upper_b"));
      const dayIds = upperBDays.map((d) => d.id);
      if (dayIds.length > 0) {
        const updated = await db
          .update(programExercises)
          .set({ notes: SMITH_NOTE })
          .where(
            and(
              inArray(programExercises.programDayId, dayIds),
              eq(programExercises.exerciseId, smith.id),
            ),
          )
          .returning({ id: programExercises.id });
        console.log(`Updated Smith Row per-day notes on Upper B (${updated.length} rows).`);
      }
    }
  }

  // Step 2 — swap Upper B pushdown → overhead extension on every Upper B day.
  {
    const pushdown = await findByName("Cable Triceps Pushdown");
    const overhead = await findByName("Overhead Cable Triceps Extension");
    if (!overhead) {
      console.log("Overhead Cable Triceps Extension not found — skipping swap.");
    } else if (!pushdown) {
      console.log("No Cable Triceps Pushdown rows to swap — already migrated.");
    } else {
      const upperBDays = await db
        .select({ id: programDays.id })
        .from(programDays)
        .where(eq(programDays.sessionType, "upper_b"));
      const dayIds = upperBDays.map((d) => d.id);
      if (dayIds.length === 0) {
        console.log("No Upper B program days found — nothing to swap.");
      } else {
        const result = await db
          .update(programExercises)
          .set({ exerciseId: overhead.id, notes: "Rope", rirTarget: 0 })
          .where(
            and(
              inArray(programExercises.programDayId, dayIds),
              eq(programExercises.exerciseId, pushdown.id),
            ),
          )
          .returning({ id: programExercises.id });
        console.log(`Swapped pushdown → overhead extension on Upper B (${result.length} rows).`);
      }
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
