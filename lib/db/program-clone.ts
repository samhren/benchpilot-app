import { and, eq, inArray } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { programDays, programExercises, programs } from "./schema";
import type * as schema from "./schema";

type Db = PostgresJsDatabase<typeof schema>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

// Clone a user's program into a fresh `programs` row, copying every
// `program_days` / `program_exercises` row verbatim, and archive the source as
// 'completed'. Old sessions stay attached to the OLD program's days, so logged
// history and lift stats are untouched; the new program's days start with no
// sessions, so every week of it reads as not-yet-trained.
//
// Cloning (rather than generating from seed-program.ts) keeps the user's real,
// tuned plan. `day_status` is deliberately not copied.
export async function cloneProgram(
  tx: Tx,
  source: typeof programs.$inferSelect,
  opts: { startDate: string; programName?: string },
) {
  const userId = source.userId!;
  const oldDays = await tx
    .select()
    .from(programDays)
    .where(eq(programDays.programId, source.id))
    .orderBy(programDays.weekNumber, programDays.dayOfWeek);
  if (oldDays.length === 0) {
    throw new Error(`Program ${source.id} has no program_days to clone`);
  }
  const oldExercises = await tx
    .select()
    .from(programExercises)
    .where(
      and(
        eq(programExercises.userId, userId),
        inArray(
          programExercises.programDayId,
          oldDays.map((d) => d.id),
        ),
      ),
    );
  const exByDay = new Map<string, typeof oldExercises>();
  for (const pe of oldExercises) {
    const list = exByDay.get(pe.programDayId) ?? [];
    list.push(pe);
    exByDay.set(pe.programDayId, list);
  }

  const [created] = await tx
    .insert(programs)
    .values({
      userId,
      name: opts.programName ?? source.name,
      startDate: opts.startDate,
      totalWeeks: source.totalWeeks,
      currentWeek: 1,
      currentBlock: "1",
      status: "active",
    })
    .returning();

  // Old day id → new day id, so callers can carry per-day state across.
  const dayMap = new Map<string, typeof programDays.$inferSelect>();
  let clonedExercises = 0;
  for (const d of oldDays) {
    const [pd] = await tx
      .insert(programDays)
      .values({
        userId,
        programId: created.id,
        weekNumber: d.weekNumber,
        dayOfWeek: d.dayOfWeek,
        sessionType: d.sessionType,
        displayName: d.displayName,
      })
      .returning();
    dayMap.set(d.id, pd);

    const src = exByDay.get(d.id) ?? [];
    if (src.length === 0) continue;
    await tx.insert(programExercises).values(
      src.map((e) => ({
        userId,
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

  await tx
    .update(programs)
    .set({ status: "completed" })
    .where(and(eq(programs.id, source.id), eq(programs.userId, userId)));

  return { program: created, dayMap, clonedDays: oldDays.length, clonedExercises };
}
