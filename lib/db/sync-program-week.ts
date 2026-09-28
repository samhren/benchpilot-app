import "dotenv/config";
import { and, eq, inArray, isNotNull, ne } from "drizzle-orm";
import {
  dayStatus,
  lifts,
  programDays,
  programs,
  tmHistory,
  users,
  workoutSessions,
} from "./schema";
import { resolveScriptTarget } from "./script-target";
import { cloneProgram } from "./program-clone";
import { LEGACY_USER_ID } from "../auth-core";

const { db, client, announce } = resolveScriptTarget("SYNC_TARGET");

// Put Sam and his training partner on the same program week.
//
// The program week is calendar-derived from `programs.start_date`
// (`computeProgramWeek`), so "put everyone on week N" means "give everyone the
// same start date". For each user this script:
//
//   1. Moves the active program so SYNC_START_DATE is week 1 day 1. If any
//      workout is logged on a day at or after the target week, moving the date
//      would render those days as already done — so the plan is instead cloned
//      into a fresh program (see program-clone.ts) and the old run archived.
//      Logged sessions are never edited or deleted.
//   2. Marks every untrained day before the target week `skipped` (or `done`
//      when the cloned-from day was trained), so the dashboard doesn't bury the
//      user under "missed" banners for weeks they're deliberately past.
//   3. Clears stale day_status flags (skipped / rescheduled) from the target
//      week onward, so the fresh weeks aren't suppressed.
//   4. Sets the bench training max, recording a tm_history row.
//
// Idempotent, and DRY-RUN BY DEFAULT: nothing is written unless SYNC_APPLY=1.
//
//   SYNC_TARGET=prod SYNC_START_DATE=2026-08-31 SYNC_WEEK=5 \
//     SYNC_SAM_TM=265 SYNC_PARTNER_TM=260 tsx lib/db/sync-program-week.ts
//
// The partner is found as the only non-Sam account with a 200+ lb bench
// (training max or 1RM); override with SYNC_PARTNER_ID.

const APPLY = process.env.SYNC_APPLY === "1";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required`);
  return v;
}

type Plan = { userId: string; label: string; benchTm: number };

async function findPartnerId(): Promise<string> {
  if (process.env.SYNC_PARTNER_ID) return process.env.SYNC_PARTNER_ID;
  const rows = await db
    .select({ userId: lifts.userId, tm: lifts.trainingMax, oneRm: lifts.currentOneRm })
    .from(lifts)
    .where(and(eq(lifts.name, "bench_press"), ne(lifts.userId, LEGACY_USER_ID)));
  const strong = rows.filter((r) => Math.max(r.tm ?? 0, r.oneRm ?? 0) >= 200);
  if (strong.length !== 1) {
    throw new Error(
      `Expected exactly one non-Sam user with a 200+ bench, found ${strong.length}: ` +
        JSON.stringify(strong) +
        ". Set SYNC_PARTNER_ID.",
    );
  }
  return strong[0].userId!;
}

async function syncUser(plan: Plan, startDate: string, targetWeek: number) {
  const { userId, label } = plan;
  console.log(`\n== ${label} (${userId})`);

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error(`No user ${userId}`);

  const [active] = await db
    .select()
    .from(programs)
    .where(and(eq(programs.userId, userId), eq(programs.status, "active")))
    .limit(1);
  if (!active) throw new Error(`${label} has no active program`);

  const days = await db
    .select()
    .from(programDays)
    .where(eq(programDays.programId, active.id));
  const completed = await db
    .select({ programDayId: workoutSessions.programDayId })
    .from(workoutSessions)
    .where(
      and(
        eq(workoutSessions.userId, userId),
        isNotNull(workoutSessions.completedAt),
        inArray(
          workoutSessions.programDayId,
          days.map((d) => d.id),
        ),
      ),
    );
  const trainedDayIds = new Set(completed.map((c) => c.programDayId!));
  const trainedAtOrAfterTarget = days.filter(
    (d) => d.weekNumber >= targetWeek && trainedDayIds.has(d.id),
  );

  console.log(
    `  active program ${active.id}: start ${active.startDate}, ${trainedDayIds.size} trained day(s), ` +
      `${trainedAtOrAfterTarget.length} of them in week >= ${targetWeek}`,
  );

  const needsClone = trainedAtOrAfterTarget.length > 0;
  if (active.startDate === startDate && !needsClone) {
    console.log(`  program: already starts ${startDate}`);
  } else if (needsClone) {
    console.log(`  program: CLONE into a new program starting ${startDate}; archive ${active.id}`);
  } else {
    console.log(`  program: move start_date ${active.startDate} → ${startDate}`);
  }

  const [bench] = await db
    .select()
    .from(lifts)
    .where(and(eq(lifts.userId, userId), eq(lifts.name, "bench_press")))
    .limit(1);
  if (!bench) throw new Error(`${label} has no bench_press lift`);
  const tmChange = bench.trainingMax !== plan.benchTm;
  console.log(
    tmChange
      ? `  bench TM: ${bench.trainingMax} → ${plan.benchTm}`
      : `  bench TM: already ${plan.benchTm}`,
  );

  if (!APPLY) return;

  await db.transaction(async (tx) => {
    // ---- Program start ----------------------------------------------------
    let programId = active.id;
    // For each day of the (possibly new) program: was it trained?
    let wasTrained = (dayId: string) => trainedDayIds.has(dayId);
    if (needsClone) {
      const r = await cloneProgram(tx, active, { startDate });
      programId = r.program.id;
      const trainedNew = new Set(
        [...r.dayMap].filter(([oldId]) => trainedDayIds.has(oldId)).map(([, pd]) => pd.id),
      );
      wasTrained = (dayId) => trainedNew.has(dayId);
      // An unsubmitted workout on the archived run would keep resurfacing.
      await tx
        .update(workoutSessions)
        .set({ status: "abandoned" })
        .where(
          and(
            eq(workoutSessions.userId, userId),
            eq(workoutSessions.status, "in_progress"),
            inArray(workoutSessions.programDayId, [...r.dayMap.keys()]),
          ),
        );
      console.log(`  ✓ cloned ${r.clonedDays} days / ${r.clonedExercises} exercises → ${programId}`);
    } else if (active.startDate !== startDate) {
      await tx
        .update(programs)
        .set({ startDate })
        .where(and(eq(programs.id, active.id), eq(programs.userId, userId)));
      console.log(`  ✓ start_date → ${startDate}`);
    }

    // ---- Day status -------------------------------------------------------
    const newDays = await tx
      .select()
      .from(programDays)
      .where(eq(programDays.programId, programId));
    const existing = await tx
      .select()
      .from(dayStatus)
      .where(
        inArray(
          dayStatus.programDayId,
          newDays.map((d) => d.id),
        ),
      );
    const statusByDay = new Map(existing.map((s) => [s.programDayId, s]));

    let marked = 0;
    let cleared = 0;
    for (const d of newDays) {
      if (d.sessionType === "rest") continue;
      const cur = statusByDay.get(d.id);
      if (d.weekNumber < targetWeek) {
        // A day with its own completed session needs no flag.
        if (!needsClone && trainedDayIds.has(d.id)) continue;
        const state = wasTrained(d.id) ? "done" : "skipped";
        // Never downgrade "done": on a re-run the cloned days have no sessions
        // of their own, so `done` can only come from the first run.
        if (cur?.state === state || cur?.state === "done") continue;
        if (cur) {
          await tx
            .update(dayStatus)
            .set({ state, rescheduledTo: null, updatedAt: new Date() })
            .where(eq(dayStatus.id, cur.id));
        } else {
          await tx.insert(dayStatus).values({ userId, programDayId: d.id, state });
        }
        marked += 1;
      } else if (cur && cur.state !== "done") {
        await tx.delete(dayStatus).where(eq(dayStatus.id, cur.id));
        cleared += 1;
      }
    }
    console.log(`  ✓ day_status: ${marked} pre-week-${targetWeek} day(s) marked, ${cleared} stale flag(s) cleared`);

    // ---- Bench TM -----------------------------------------------------------
    if (tmChange) {
      await tx
        .update(lifts)
        .set({ trainingMax: plan.benchTm, lastTmBumpAt: new Date(), updatedAt: new Date() })
        .where(and(eq(lifts.id, bench.id), eq(lifts.userId, userId)));
      await tx.insert(tmHistory).values({
        userId,
        liftId: bench.id,
        trainingMax: plan.benchTm,
        reason: "manual",
        notes: `Week sync ${startDate}: bench TM set to ${plan.benchTm}`,
      });
      console.log(`  ✓ bench TM → ${plan.benchTm}`);
    }
  });
}

async function main() {
  const startDate = env("SYNC_START_DATE");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) throw new Error("SYNC_START_DATE must be YYYY-MM-DD");
  if (new Date(startDate + "T00:00:00Z").getUTCDay() !== 1) {
    throw new Error("SYNC_START_DATE must be a Monday (program day 1)");
  }
  const targetWeek = Number(env("SYNC_WEEK"));
  const plans: Plan[] = [
    { userId: LEGACY_USER_ID, label: "Sam", benchTm: Number(env("SYNC_SAM_TM")) },
    { userId: await findPartnerId(), label: "Partner", benchTm: Number(env("SYNC_PARTNER_TM")) },
  ];

  announce();
  console.log(APPLY ? "APPLYING changes." : "DRY RUN — set SYNC_APPLY=1 to write.");
  for (const p of plans) await syncUser(p, startDate, targetWeek);
  await client.end();
}

main().catch(async (e) => {
  console.error(e);
  await client.end();
  process.exit(1);
});
