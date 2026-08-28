import "dotenv/config";
import { and, eq, isNotNull } from "drizzle-orm";
import {
  exercises,
  programDays,
  programExercises,
  programs,
  users,
  workoutSessions,
} from "./schema";
import { resolveScriptTarget } from "./script-target";

// Read-only. Compares every user's ACTIVE program against a reference user's
// (default "Sam") so plan drift between accounts is visible before deciding what
// to migrate.
//
// Only days that have NOT been started are compared. A day with a workout
// session attached is frozen history — it legitimately still shows whatever plan
// was in force when it was trained, so including it would drown the real drift
// in noise. That is also exactly the set of days a migration is allowed to
// rewrite, so this diff is the preview of what `sync-plan-to-reference` will do.
//
//   npm run db:diff-plans        (dev)
//   npm run db:diff-plans:prod   (production, read-only)

const { db, client, announce } = resolveScriptTarget("DIFF_TARGET");

interface Slot {
  order: number;
  name: string;
  sets: number;
  reps: number;
  rir: number | null;
  pct: number | null;
}

/** `w3-d1` → the ordered exercise list on that day, for one user. */
type PlanByDay = Map<string, Slot[]>;

function formatSlot(s: Slot): string {
  const load = s.pct != null ? `@${Math.round(s.pct)}%` : s.rir != null ? `rir${s.rir}` : "";
  return `${s.name} ${s.sets}x${s.reps}${load ? " " + load : ""}`;
}

function formatDay(slots: Slot[] | undefined): string {
  if (!slots || slots.length === 0) return "<no exercises>";
  return slots.map(formatSlot).join(" | ");
}

/** Program days the user has already started; these are frozen and off-limits. */
async function startedDayIds(userId: string): Promise<Set<string>> {
  const rows = await db
    .selectDistinct({ programDayId: workoutSessions.programDayId })
    .from(workoutSessions)
    .where(and(eq(workoutSessions.userId, userId), isNotNull(workoutSessions.programDayId)));
  return new Set(rows.map((r) => r.programDayId).filter((x): x is string => x != null));
}

async function futurePlanFor(userId: string): Promise<PlanByDay> {
  const started = await startedDayIds(userId);

  const rows = await db
    .select({
      dayId: programDays.id,
      week: programDays.weekNumber,
      dow: programDays.dayOfWeek,
      sessionType: programDays.sessionType,
      order: programExercises.orderIndex,
      name: exercises.name,
      sets: programExercises.sets,
      reps: programExercises.reps,
      rir: programExercises.rirTarget,
      pct: programExercises.percentageOfTm,
    })
    .from(programExercises)
    .innerJoin(programDays, eq(programDays.id, programExercises.programDayId))
    .innerJoin(programs, eq(programs.id, programDays.programId))
    .innerJoin(exercises, eq(exercises.id, programExercises.exerciseId))
    .where(and(eq(programExercises.userId, userId), eq(programs.status, "active")));

  const byDay: PlanByDay = new Map();
  for (const r of rows) {
    if (started.has(r.dayId)) continue;
    const key = `w${r.week}-d${r.dow} (${r.sessionType})`;
    const list = byDay.get(key) ?? [];
    list.push({ order: r.order, name: r.name, sets: r.sets, reps: r.reps, rir: r.rir, pct: r.pct });
    byDay.set(key, list);
  }
  for (const list of byDay.values()) list.sort((a, b) => a.order - b.order);
  return byDay;
}

function dayKeySort(a: string, b: string): number {
  const pa = a.match(/w(\d+)-d(\d+)/)!;
  const pb = b.match(/w(\d+)-d(\d+)/)!;
  return Number(pa[1]) - Number(pb[1]) || Number(pa[2]) - Number(pb[2]);
}

/** Full dump of one user's active-program days, wave plans included. */
async function dumpPlan(userId: string) {
  const started = await startedDayIds(userId);
  const rows = await db
    .select({
      dayId: programDays.id,
      week: programDays.weekNumber,
      dow: programDays.dayOfWeek,
      sessionType: programDays.sessionType,
      order: programExercises.orderIndex,
      name: exercises.name,
      prescription: programExercises.prescriptionType,
      sets: programExercises.sets,
      reps: programExercises.reps,
      rir: programExercises.rirTarget,
      pct: programExercises.percentageOfTm,
      wavePlan: programExercises.wavePlan,
    })
    .from(programExercises)
    .innerJoin(programDays, eq(programDays.id, programExercises.programDayId))
    .innerJoin(programs, eq(programs.id, programDays.programId))
    .innerJoin(exercises, eq(exercises.id, programExercises.exerciseId))
    .where(and(eq(programExercises.userId, userId), eq(programs.status, "active")));

  rows.sort((a, b) => a.week - b.week || a.dow - b.dow || a.order - b.order);
  let lastDay = "";
  for (const r of rows) {
    const key = `w${r.week}-d${r.dow} ${r.sessionType}${started.has(r.dayId) ? " [STARTED]" : ""}`;
    if (key !== lastDay) {
      console.log(`\n  ${key}`);
      lastDay = key;
    }
    const wave = r.wavePlan ? `  wave=${JSON.stringify(r.wavePlan)}` : "";
    console.log(
      `    ${String(r.order).padStart(2)}. ${r.name} ${r.sets}x${r.reps}` +
        `${r.pct != null ? ` @${r.pct}%` : ""}${r.rir != null ? ` rir${r.rir}` : ""}` +
        ` (${r.prescription})${wave}`,
    );
  }
}

async function main() {
  const referenceName = process.env.DIFF_REFERENCE ?? "Sam";
  const verbose = process.env.DIFF_VERBOSE === "1";

  announce();

  // DIFF_SHOW=<user id prefix> dumps that one user's plan instead of diffing.
  const show = process.env.DIFF_SHOW;
  if (show) {
    const all = await db.select({ id: users.id, name: users.name }).from(users);
    const u = all.find((x) => x.id.startsWith(show) || x.name === show);
    if (!u) throw new Error(`No user matching ${JSON.stringify(show)}`);
    console.log(`\nPlan for ${u.name ?? "(unnamed)"} ${u.id}:`);
    await dumpPlan(u.id);
    await client.end();
    process.exit(0);
  }

  const allUsers = await db.select({ id: users.id, name: users.name }).from(users);
  const reference = allUsers.find((u) => u.name === referenceName);
  if (!reference) {
    throw new Error(
      `No user named ${JSON.stringify(referenceName)}. Users: ${allUsers
        .map((u) => `${u.id}=${JSON.stringify(u.name)}`)
        .join(", ")}`,
    );
  }

  // Program-level context first: week numbers only line up between two users if
  // their active programs have the same shape and start date.
  const progRows = await db
    .select({
      userId: programs.userId,
      id: programs.id,
      name: programs.name,
      startDate: programs.startDate,
      totalWeeks: programs.totalWeeks,
      currentWeek: programs.currentWeek,
      status: programs.status,
    })
    .from(programs);
  console.log("\nPrograms:");
  for (const u of allUsers) {
    for (const p of progRows.filter((p) => p.userId === u.id)) {
      const started = await startedDayIds(u.id);
      const days = await db
        .select({ id: programDays.id })
        .from(programDays)
        .where(eq(programDays.programId, p.id));
      const startedHere = days.filter((d) => started.has(d.id)).length;
      console.log(
        `  ${u.id.slice(0, 8)} ${(u.name ?? "(unnamed)").padEnd(10)} ` +
          `${p.status.padEnd(9)} "${p.name}" start=${p.startDate} weeks=${p.totalWeeks} ` +
          `currentWeek=${p.currentWeek} days=${days.length} started=${startedHere}`,
      );
    }
  }

  const refPlan = await futurePlanFor(reference.id);
  console.log(`\nReference: ${referenceName} — ${refPlan.size} un-started day(s).\n`);

  for (const u of allUsers) {
    if (u.id === reference.id) continue;
    const plan = await futurePlanFor(u.id);
    const keys = [...new Set([...refPlan.keys(), ...plan.keys()])].sort(dayKeySort);
    const comparable = keys.filter((k) => refPlan.has(k) && plan.has(k));
    const differing = comparable.filter((k) => formatDay(refPlan.get(k)) !== formatDay(plan.get(k)));

    console.log(
      `===== ${u.name ?? "(unnamed)"} ${u.id} — ${plan.size} un-started day(s), ` +
        `${comparable.length} comparable, ${differing.length} differ =====`,
    );

    // Roll the per-day noise up into "which exercises differ", which is what a
    // swap-style migration actually keys on.
    const onlyRef = new Map<string, number>();
    const onlyUser = new Map<string, number>();
    for (const k of differing) {
      const r = new Set(refPlan.get(k)!.map(formatSlot));
      const m = new Set(plan.get(k)!.map(formatSlot));
      for (const s of r) if (!m.has(s)) onlyRef.set(s, (onlyRef.get(s) ?? 0) + 1);
      for (const s of m) if (!r.has(s)) onlyUser.set(s, (onlyUser.get(s) ?? 0) + 1);
    }
    const fmtCounts = (m: Map<string, number>) =>
      [...m.entries()].sort((a, b) => b[1] - a[1]).map(([s, n]) => `      ${n}x  ${s}`);
    console.log(`  only in ${referenceName}:`);
    for (const l of fmtCounts(onlyRef)) console.log(l);
    console.log(`  only in ${u.name ?? "(unnamed)"}:`);
    for (const l of fmtCounts(onlyUser)) console.log(l);

    if (verbose) {
      for (const k of differing) {
        console.log(`  ${k}`);
        console.log(`    ${referenceName}: ${formatDay(refPlan.get(k))}`);
        console.log(`    them: ${formatDay(plan.get(k))}`);
      }
    }
    console.log("");
  }

  await client.end();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
