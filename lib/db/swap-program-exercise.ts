import "dotenv/config";
import { and, eq, inArray } from "drizzle-orm";
import {
  exercises,
  programDays,
  programExercises,
  programs,
  users,
  workoutSessions,
} from "./schema";
import { resolveScriptTarget } from "./script-target";

// Swap one or more exercises for a different exercise across a user's ACTIVE
// program — e.g. when they change gyms and the old equipment isn't available.
//
// Follows the same rules as the other plan migrations in this directory (see
// CLAUDE.md and `converge-plan-all-users.ts`):
//   - Idempotent: once swapped, re-running matches nothing and reports 0.
//   - Future-only: any program day that already has a workout session attached
//     is skipped, so logged history keeps referring to what was actually done.
//     Sessions already in progress keep their own `session_exercises` snapshot
//     and are unaffected by definition.
//   - Scoped to the ACTIVE program, so archived runs (and the history hanging
//     off them) are never rewritten.
//
// The `exercises` table is a shared global library, so the target exercise is
// inserted there only if no row with that name exists yet — the same
// insert-if-missing approach `bootstrap-user.ts` uses.

const { db, client, announce } = resolveScriptTarget("SWAP_TARGET");

export interface SwapOptions {
  userName: string;
  /** Exercise names to replace. */
  fromNames: string[];
  /** Exercise name to replace them with; created in the library if missing. */
  toName: string;
  toMuscleGroup: string;
  toDefaultSets: number;
  /** When set, overwrites the per-slot coaching note on every swapped row. */
  notes?: string | null;
}

export async function swapProgramExercise(opts: SwapOptions) {
  const { userName, fromNames, toName, toMuscleGroup, toDefaultSets, notes } = opts;

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.name, userName))
    .limit(1);
  if (!user) throw new Error(`No user named ${JSON.stringify(userName)}`);

  const [program] = await db
    .select({ id: programs.id, name: programs.name })
    .from(programs)
    .where(and(eq(programs.userId, user.id), eq(programs.status, "active")))
    .limit(1);
  if (!program) throw new Error(`${userName} has no active program`);

  // Resolve (or create) the replacement exercise in the shared library.
  let [target] = await db
    .select({ id: exercises.id, name: exercises.name })
    .from(exercises)
    .where(eq(exercises.name, toName))
    .limit(1);
  if (!target) {
    [target] = await db
      .insert(exercises)
      .values({
        name: toName,
        muscleGroup: toMuscleGroup as never,
        defaultSets: toDefaultSets,
        isMainLift: false,
      })
      .returning({ id: exercises.id, name: exercises.name });
    console.log(`  library: created exercise "${toName}"`);
  } else {
    console.log(`  library: reusing existing exercise "${toName}"`);
  }

  const sources = await db
    .select({ id: exercises.id, name: exercises.name })
    .from(exercises)
    .where(inArray(exercises.name, fromNames));
  const missing = fromNames.filter((n) => !sources.some((s) => s.name === n));
  for (const n of missing) console.log(`  warn: no exercise named "${n}" in the library`);
  if (sources.length === 0) {
    return { swapped: 0, skippedLogged: 0, targetId: target.id, byDay: [] as string[] };
  }

  // Program days that already have a session are off-limits (future-only).
  const loggedDayRows = await db
    .selectDistinct({ programDayId: workoutSessions.programDayId })
    .from(workoutSessions)
    .where(eq(workoutSessions.userId, user.id));
  const loggedDayIds = new Set(
    loggedDayRows.map((r) => r.programDayId).filter((x): x is string => !!x),
  );

  const candidates = await db
    .select({
      peId: programExercises.id,
      programDayId: programExercises.programDayId,
      exerciseId: programExercises.exerciseId,
      weekNumber: programDays.weekNumber,
      dayOfWeek: programDays.dayOfWeek,
      displayName: programDays.displayName,
    })
    .from(programExercises)
    .innerJoin(programDays, eq(programDays.id, programExercises.programDayId))
    .where(
      and(
        eq(programExercises.userId, user.id),
        eq(programDays.programId, program.id),
        inArray(
          programExercises.exerciseId,
          sources.map((s) => s.id),
        ),
      ),
    )
    .orderBy(programDays.weekNumber, programDays.dayOfWeek);

  const doable = candidates.filter((c) => !loggedDayIds.has(c.programDayId));
  const skippedLogged = candidates.length - doable.length;

  // One bulk UPDATE rather than a row-by-row loop: this runs against a remote
  // database over Railway's public proxy, where a few dozen sequential round
  // trips inside a transaction are both slow and an easy target for a dropped
  // connection mid-flight.
  if (doable.length > 0) {
    await db
      .update(programExercises)
      .set({
        exerciseId: target.id,
        ...(notes !== undefined ? { notes } : {}),
      })
      .where(
        and(
          eq(programExercises.userId, user.id),
          inArray(
            programExercises.id,
            doable.map((c) => c.peId),
          ),
        ),
      );
  }

  const byDay = [
    ...new Set(doable.map((c) => `dow${c.dayOfWeek} (${c.displayName})`)),
  ];

  console.log(
    `  swapped ${doable.length} slot(s) → "${toName}" in "${program.name}"` +
      (skippedLogged > 0 ? `; skipped ${skippedLogged} on already-logged days` : ""),
  );
  for (const d of byDay) console.log(`    on ${d}`);

  return { swapped: doable.length, skippedLogged, targetId: target.id, byDay };
}

async function main() {
  const userName = process.env.SWAP_USER ?? "Sam";
  const fromRaw = process.env.SWAP_FROM;
  const toName = process.env.SWAP_TO;
  if (!fromRaw || !toName) {
    throw new Error("SWAP_FROM (comma-separated) and SWAP_TO are required");
  }
  const fromNames = fromRaw.split(",").map((s) => s.trim()).filter(Boolean);
  const toMuscleGroup = process.env.SWAP_TO_MUSCLE_GROUP ?? "back";
  const toDefaultSets = Number(process.env.SWAP_TO_DEFAULT_SETS ?? "3");
  const notes = process.env.SWAP_NOTES;

  announce();
  console.log(
    `Swapping [${fromNames.join(", ")}] → "${toName}" for ${userName} (active program, future days only)…`,
  );
  const r = await swapProgramExercise({
    userName,
    fromNames,
    toName,
    toMuscleGroup,
    toDefaultSets,
    notes,
  });
  console.log("Done.", JSON.stringify(r, null, 2));
  await client.end();
  process.exit(0);
}

if (process.argv[1]?.includes("swap-program-exercise")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
