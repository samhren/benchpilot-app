"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  bodyWeightLogs,
  lifts,
  programs,
  settings,
  tmHistory,
  workoutSessions,
  workoutSets,
} from "@/lib/db/schema";
import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { resolveTrainingMax } from "@/lib/programming/training-max";
import { applyAmrapBump } from "@/lib/programming/amrap";

export async function logBodyWeightAction(weightLb: number) {
  const v = z.number().positive().parse(weightLb);
  const today = new Date().toISOString().slice(0, 10);
  const [existing] = await db
    .select()
    .from(bodyWeightLogs)
    .where(eq(bodyWeightLogs.date, today))
    .limit(1);
  if (existing) {
    await db.update(bodyWeightLogs).set({ weightLb: v }).where(eq(bodyWeightLogs.id, existing.id));
  } else {
    await db.insert(bodyWeightLogs).values({ date: today, weightLb: v });
  }
  revalidatePath("/");
  revalidatePath("/settings");
  return { ok: true };
}

const SetOneRmSchema = z.object({
  liftName: z.enum(["bench_press", "back_squat", "deadlift", "overhead_press"]),
  oneRm: z.number().positive(),
});

export async function setLiftOneRmAction(input: z.infer<typeof SetOneRmSchema>) {
  const { liftName, oneRm } = SetOneRmSchema.parse(input);
  const [lift] = await db.select().from(lifts).where(eq(lifts.name, liftName)).limit(1);
  if (!lift) return { ok: false as const, error: "Lift not found" };

  const tm = resolveTrainingMax(oneRm);
  await db
    .update(lifts)
    .set({ currentOneRm: oneRm, trainingMax: tm, updatedAt: new Date() })
    .where(eq(lifts.id, lift.id));

  await db.insert(tmHistory).values({
    liftId: lift.id,
    trainingMax: tm,
    reason: "initial",
    notes: `Set 1RM = ${oneRm} lb → TM = ${tm} lb`,
  });

  revalidatePath("/");
  revalidatePath("/lifts");
  revalidatePath("/settings");
  return { ok: true as const, tm };
}

const ManualTmSchema = z.object({
  liftName: z.enum(["bench_press", "back_squat", "deadlift", "overhead_press"]),
  trainingMax: z.number().positive(),
});

export async function manualSetTmAction(input: z.infer<typeof ManualTmSchema>) {
  const { liftName, trainingMax } = ManualTmSchema.parse(input);
  const [lift] = await db.select().from(lifts).where(eq(lifts.name, liftName)).limit(1);
  if (!lift) return { ok: false as const };

  await db
    .update(lifts)
    .set({ trainingMax, lastTmBumpAt: new Date(), updatedAt: new Date() })
    .where(eq(lifts.id, lift.id));

  await db.insert(tmHistory).values({
    liftId: lift.id,
    trainingMax,
    reason: "manual",
    notes: "Manual override",
  });

  revalidatePath("/lifts");
  revalidatePath("/");
  return { ok: true as const };
}

export async function startSessionAction(programDayId: string) {
  // Find an existing in-flight session for this day, or start new
  const [existing] = await db
    .select()
    .from(workoutSessions)
    .where(and(eq(workoutSessions.programDayId, programDayId), isNull(workoutSessions.completedAt)))
    .orderBy(desc(workoutSessions.startedAt))
    .limit(1);
  if (existing) return { ok: true as const, sessionId: existing.id };
  const [created] = await db
    .insert(workoutSessions)
    .values({ programDayId })
    .returning();
  return { ok: true as const, sessionId: created.id };
}

const LogSetSchema = z.object({
  sessionId: z.string().uuid(),
  programExerciseId: z.string().uuid(),
  exerciseId: z.string().uuid(),
  setNumber: z.number().int().positive(),
  repsPrescribed: z.number().int().nullable(),
  repsCompleted: z.number().int().min(0),
  weightPrescribed: z.number().nullable(),
  weightUsed: z.number(),
  rir: z.number().int().min(0).max(10).nullable(),
  isAmrap: z.boolean(),
  isWarmup: z.boolean().default(false),
});

export async function logSetAction(input: z.infer<typeof LogSetSchema>) {
  const data = LogSetSchema.parse(input);
  const [row] = await db.insert(workoutSets).values(data).returning();
  return { ok: true as const, set: row };
}

export async function completeSessionAction(sessionId: string) {
  await db
    .update(workoutSessions)
    .set({ completedAt: new Date() })
    .where(eq(workoutSessions.id, sessionId));
  revalidatePath("/");
  revalidatePath("/history");
  return { ok: true as const };
}

const AmrapApplySchema = z.object({
  liftName: z.enum(["bench_press", "back_squat", "deadlift", "overhead_press"]),
  amrapReps: z.number().int().nonnegative(),
});

export async function applyAmrapBumpAction(input: z.infer<typeof AmrapApplySchema>) {
  const { liftName, amrapReps } = AmrapApplySchema.parse(input);
  const [lift] = await db.select().from(lifts).where(eq(lifts.name, liftName)).limit(1);
  if (!lift || lift.trainingMax == null) return { ok: false as const, error: "TM not set" };
  const result = applyAmrapBump(lift.trainingMax, amrapReps);
  if (result.bumpAmount === 0) {
    return { ok: true as const, applied: false, ...result };
  }
  await db
    .update(lifts)
    .set({ trainingMax: result.newTm, lastTmBumpAt: new Date(), updatedAt: new Date() })
    .where(eq(lifts.id, lift.id));
  await db.insert(tmHistory).values({
    liftId: lift.id,
    trainingMax: result.newTm,
    reason: "amrap_bump",
    amrapReps,
    notes: result.reason,
  });
  revalidatePath("/lifts");
  revalidatePath("/");
  return { ok: true as const, applied: true, ...result };
}

export async function setUnitsAction(units: "lb" | "kg") {
  const [s] = await db.select().from(settings).limit(1);
  if (s) {
    await db.update(settings).set({ units, updatedAt: new Date() }).where(eq(settings.id, s.id));
  } else {
    await db.insert(settings).values({ units });
  }
  revalidatePath("/settings");
  return { ok: true as const };
}

export async function resetProgramAction() {
  // Delete all sessions and sets, reset week to 1
  await db.delete(workoutSets);
  await db.delete(workoutSessions);
  const [p] = await db.select().from(programs).limit(1);
  if (p) {
    await db
      .update(programs)
      .set({ currentWeek: 1, status: "active", startDate: new Date().toISOString().slice(0, 10) })
      .where(eq(programs.id, p.id));
  }
  revalidatePath("/");
  revalidatePath("/program");
  return { ok: true as const };
}

// Diagnostic: count completed sessions
export async function _diag() {
  const r = await db
    .select({ c: sql<number>`count(*)` })
    .from(workoutSessions)
    .where(isNotNull(workoutSessions.completedAt));
  return { count: Number(r[0]?.c ?? 0) };
}
