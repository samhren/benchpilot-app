import "dotenv/config";
import { and, eq, isNotNull } from "drizzle-orm";
import {
  lifts,
  programDays,
  programExercises,
  programs,
  settings,
  tmHistory,
  users,
  workoutSessions,
} from "./schema";
import { resolveScriptTarget } from "./script-target";
import { roundForUnits, type Units } from "@/lib/programming/training-max";

const { db, client, announce } = resolveScriptTarget("RESTART_TARGET");

// Restart a user's 14-week program from week 1 after a training layoff, and cut
// their training maxes to account for detraining.
//
// Why this can't just move `programs.start_date`: the program week is derived
// from the calendar (`computeProgramWeek`), so moving the start date does
// re-point week 1 at today — but every `program_days` row of the old program
// still has the user's completed `workout_sessions` attached to it. The
// schedule query treats a day with a completed session as done
// (`lib/queries.ts` → `if (r.sess) return false`), so a restarted week 1 would
// render as already finished and the dashboard would offer nothing to train.
//
// So instead we CLONE the plan: a new `programs` row (start date = today) with
// its own `program_days` / `program_exercises` copied verbatim from the old
// one, and the old program flipped to `completed`. That keeps the important
// property that the plan being cloned is the user's real, tuned plan as it
// exists in the DB — not whatever `seed-program.ts` currently generates (see
// CLAUDE.md and the `converge-plan-all-users` migration).
//
// Guarantees, matching the other `db:*` migrations in this directory:
//   - Idempotent: re-running it is a no-op once the restart has been applied.
//   - Never destructive: no session, set, or historical row is deleted or
//     rewritten. Old sessions stay attached to the OLD program's days, so all
//     history and per-lift stats are preserved intact.
//   - `day_status` is deliberately NOT copied, so stale `skipped` /
//     `rescheduled` flags from the abandoned run don't suppress days in the
//     fresh one.

export interface RestartOptions {
  /** `users.name` of the account to restart. */
  userName: string;
  /** New program start date, `YYYY-MM-DD`. Should be a Monday (day_of_week 1). */
  startDate: string;
  /** Name for the new program row. */
  programName: string;
  /** Fraction to cut each training max by, e.g. 0.1 for 10%. 0 disables. */
  tmCutFraction: number;
  /** Marker recorded on the TM history rows; also makes the cut idempotent. */
  tmCutMarker: string;
}

export async function restartProgramForUser(opts: RestartOptions) {
  const { userName, startDate, programName, tmCutFraction, tmCutMarker } = opts;

  const [user] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.name, userName))
    .limit(1);
  if (!user) throw new Error(`No user named ${JSON.stringify(userName)}`);

  const [setting] = await db
    .select({ units: settings.units })
    .from(settings)
    .where(eq(settings.userId, user.id))
    .limit(1);
  const units = (setting?.units === "kg" ? "kg" : "lb") as Units;

  const [active] = await db
    .select()
    .from(programs)
    .where(and(eq(programs.userId, user.id), eq(programs.status, "active")))
    .limit(1);
  if (!active) throw new Error(`${userName} has no active program`);

  // ---- Idempotency -------------------------------------------------------
  // The restart is already applied if the active program starts on the target
  // date and has no completed session attached to any of its days.
  const completedOnActive = await db
    .select({ id: workoutSessions.id })
    .from(workoutSessions)
    .innerJoin(programDays, eq(programDays.id, workoutSessions.programDayId))
    .where(
      and(
        eq(workoutSessions.userId, user.id),
        isNotNull(workoutSessions.completedAt),
        eq(programDays.programId, active.id),
      ),
    )
    .limit(1);

  const alreadyRestarted =
    active.startDate === startDate && completedOnActive.length === 0;

  let newProgramId = active.id;
  let clonedDays = 0;
  let clonedExercises = 0;

  if (alreadyRestarted) {
    console.log(
      `  program: already restarted (active program starts ${startDate} with no logged days) — skipping clone`,
    );
  } else {
    const oldDays = await db
      .select()
      .from(programDays)
      .where(eq(programDays.programId, active.id))
      .orderBy(programDays.weekNumber, programDays.dayOfWeek);
    if (oldDays.length === 0) {
      throw new Error(`Active program ${active.id} has no program_days to clone`);
    }
    const oldDayIds = oldDays.map((d) => d.id);
    const oldExercises = await db
      .select()
      .from(programExercises)
      .where(eq(programExercises.userId, user.id));
    const exByDay = new Map<string, typeof oldExercises>();
    for (const pe of oldExercises) {
      if (!oldDayIds.includes(pe.programDayId)) continue;
      const list = exByDay.get(pe.programDayId) ?? [];
      list.push(pe);
      exByDay.set(pe.programDayId, list);
    }

    await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(programs)
        .values({
          userId: user.id,
          name: programName,
          startDate,
          totalWeeks: active.totalWeeks,
          currentWeek: 1,
          currentBlock: "1",
          status: "active",
        })
        .returning();
      newProgramId = created.id;

      for (const d of oldDays) {
        const [pd] = await tx
          .insert(programDays)
          .values({
            userId: user.id,
            programId: created.id,
            weekNumber: d.weekNumber,
            dayOfWeek: d.dayOfWeek,
            sessionType: d.sessionType,
            displayName: d.displayName,
          })
          .returning();
        clonedDays += 1;

        const src = exByDay.get(d.id) ?? [];
        if (src.length === 0) continue;
        await tx.insert(programExercises).values(
          src.map((e) => ({
            userId: user.id,
            programDayId: pd.id,
            orderIndex: e.orderIndex,
            exerciseId: e.exerciseId,
            prescriptionType: e.prescriptionType,
            sets: e.sets,
            reps: e.reps,
            percentageOfTm: e.percentageOfTm,
            rirTarget: e.rirTarget,
            isAmrapTopSet: e.isAmrapTopSet,
            notes: e.notes,
            liftId: e.liftId,
            wavePlan: e.wavePlan,
          })),
        );
        clonedExercises += src.length;
      }

      // Archive the old run. Its days keep every logged session, so all
      // history and lift stats stay exactly as they were.
      await tx
        .update(programs)
        .set({ status: "completed" })
        .where(and(eq(programs.id, active.id), eq(programs.userId, user.id)));
    });

    console.log(
      `  program: cloned ${clonedDays} days / ${clonedExercises} exercises into new program ${newProgramId} starting ${startDate}`,
    );
    console.log(`  program: archived previous program ${active.id} as 'completed'`);
  }

  // ---- Training-max cut --------------------------------------------------
  const tmChanges: { lift: string; from: number; to: number }[] = [];
  if (tmCutFraction > 0) {
    const userLifts = await db.select().from(lifts).where(eq(lifts.userId, user.id));
    for (const l of userLifts) {
      if (l.trainingMax == null) continue;

      const priorCut = await db
        .select({ id: tmHistory.id })
        .from(tmHistory)
        .where(and(eq(tmHistory.liftId, l.id), eq(tmHistory.notes, tmCutMarker)))
        .limit(1);
      if (priorCut.length > 0) {
        console.log(`  tm: ${l.name} already cut for ${tmCutMarker} — skipping`);
        continue;
      }

      const next = roundForUnits(l.trainingMax * (1 - tmCutFraction), units);
      if (next === l.trainingMax) continue;

      await db.transaction(async (tx) => {
        await tx
          .update(lifts)
          .set({ trainingMax: next })
          .where(and(eq(lifts.id, l.id), eq(lifts.userId, user.id)));
        await tx.insert(tmHistory).values({
          userId: user.id,
          liftId: l.id,
          trainingMax: next,
          reason: "reset",
          notes: tmCutMarker,
        });
      });
      tmChanges.push({ lift: l.name, from: l.trainingMax, to: next });
      console.log(`  tm: ${l.name} ${l.trainingMax} → ${next} ${units}`);
    }
  }

  return { userId: user.id, newProgramId, clonedDays, clonedExercises, tmChanges };
}

async function main() {
  const userName = process.env.RESTART_USER ?? "Sam";
  const startDate = process.env.RESTART_START_DATE;
  if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    throw new Error("RESTART_START_DATE=YYYY-MM-DD is required");
  }
  const programName = process.env.RESTART_PROGRAM_NAME ?? "Bench-Focused Recomp";
  const tmCutFraction = Number(process.env.RESTART_TM_CUT ?? "0.1");
  const tmCutMarker = process.env.RESTART_TM_MARKER ?? `layoff-restart ${startDate}`;

  announce();
  console.log(
    `Restarting program for ${userName} at week 1 on ${startDate} (TM cut ${Math.round(
      tmCutFraction * 100,
    )}%)…`,
  );
  const r = await restartProgramForUser({
    userName,
    startDate,
    programName,
    tmCutFraction,
    tmCutMarker,
  });
  console.log("Done.", JSON.stringify(r, null, 2));
  await client.end();
  process.exit(0);
}

if (process.argv[1]?.includes("restart-program")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
