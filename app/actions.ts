"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  bodyWeightLogs,
  dayStatus,
  exercises,
  lifts,
  programExercises,
  programs,
  sessionExercises,
  settings,
  tmHistory,
  workoutSessions,
  workoutSets,
} from "@/lib/db/schema";
import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { resolveTrainingMax, resolveBenchPrescription } from "@/lib/programming/training-max";
import { applyAmrapBump } from "@/lib/programming/amrap";
import { isoDate } from "@/lib/program-state";

async function getTimezone(): Promise<string> {
  const [s] = await db.select().from(settings).limit(1);
  return s?.timezone ?? "UTC";
}

export async function logBodyWeightAction(weightLb: number) {
  const v = z.number().positive().parse(weightLb);
  const tz = await getTimezone();
  const today = isoDate(new Date(), tz);
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

  revalidatePath("/", "layout");
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

  revalidatePath("/", "layout");
  return { ok: true as const };
}

const StartSessionSchema = z.object({
  programDayId: z.string().uuid(),
  deloadFactor: z.number().min(0.3).max(1).optional(),
});

export async function startSessionAction(
  programDayIdOrInput: string | z.infer<typeof StartSessionSchema>,
) {
  const input =
    typeof programDayIdOrInput === "string"
      ? { programDayId: programDayIdOrInput }
      : StartSessionSchema.parse(programDayIdOrInput);
  const { programDayId, deloadFactor } = input;

  // Find an existing in-flight session for this day, or start new.
  // If deloadFactor differs from the existing session, scrap the snapshot and rebuild it
  // (only safe when no sets have been logged yet).
  const [existing] = await db
    .select()
    .from(workoutSessions)
    .where(and(eq(workoutSessions.programDayId, programDayId), isNull(workoutSessions.completedAt)))
    .orderBy(desc(workoutSessions.startedAt))
    .limit(1);
  if (existing) {
    const wantsDifferentFactor =
      deloadFactor != null && Math.abs((existing.deloadFactor ?? 1) - deloadFactor) > 0.001;
    if (!wantsDifferentFactor) {
      return { ok: true as const, sessionId: existing.id };
    }
    const [hasSets] = await db
      .select()
      .from(workoutSets)
      .where(eq(workoutSets.sessionId, existing.id))
      .limit(1);
    if (hasSets) {
      return { ok: true as const, sessionId: existing.id };
    }
    // Rebuild: drop snapshot, update factor, recreate snapshot below.
    await db.delete(sessionExercises).where(eq(sessionExercises.sessionId, existing.id));
    await db
      .update(workoutSessions)
      .set({ deloadFactor: deloadFactor ?? 1 })
      .where(eq(workoutSessions.id, existing.id));
    await rebuildSnapshot(existing.id, programDayId, deloadFactor ?? 1);
    return { ok: true as const, sessionId: existing.id };
  }

  const [created] = await db
    .insert(workoutSessions)
    .values({
      programDayId,
      status: "in_progress",
      deloadFactor: deloadFactor ?? 1,
    })
    .returning();

  await rebuildSnapshot(created.id, programDayId, deloadFactor ?? 1);
  return { ok: true as const, sessionId: created.id };
}

async function rebuildSnapshot(sessionId: string, programDayId: string, factor: number) {
  const tmplRows = await db
    .select()
    .from(programExercises)
    .where(eq(programExercises.programDayId, programDayId))
    .orderBy(programExercises.orderIndex);

  const benchLift = await db
    .select()
    .from(lifts)
    .where(eq(lifts.name, "bench_press"))
    .limit(1);
  const benchTm = benchLift[0]?.trainingMax ?? null;

  if (!tmplRows.length) return;

  await db.insert(sessionExercises).values(
    tmplRows.map((pe) => {
      let weightPrescribed: number | null = null;
      if (pe.percentageOfTm != null && benchTm != null) {
        weightPrescribed = resolveBenchPrescription(pe.percentageOfTm * factor, benchTm);
      }
      let wavePlan: unknown = pe.wavePlan;
      if (Array.isArray(pe.wavePlan) && factor !== 1) {
        wavePlan = (pe.wavePlan as Array<{ percentage: number; sets: number; reps: number; isAmrap?: boolean }>).map(
          (w) => ({ ...w, percentage: w.percentage * factor }),
        );
      }
      return {
        sessionId,
        programExerciseId: pe.id,
        exerciseId: pe.exerciseId,
        orderIndex: pe.orderIndex,
        prescriptionType: pe.prescriptionType,
        sets: pe.sets,
        reps: pe.reps,
        percentageOfTm: pe.percentageOfTm != null ? pe.percentageOfTm * factor : null,
        weightPrescribed,
        rirTarget: pe.rirTarget,
        liftId: pe.liftId,
        wavePlan: wavePlan as never,
        isAmrapTopSet: pe.isAmrapTopSet,
        notes: pe.notes,
      };
    }),
  );
}

const LogSetSchema = z.object({
  sessionId: z.string().uuid(),
  sessionExerciseId: z.string().uuid().optional(),
  programExerciseId: z.string().uuid().optional(),
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

const UpdateSetSchema = z.object({
  id: z.string().uuid(),
  repsCompleted: z.number().int().min(0),
  weightUsed: z.number(),
  rir: z.number().int().min(0).max(10).nullable(),
});

const SaveSessionSetsSchema = z.object({
  sessionId: z.string().uuid(),
  sets: z.array(LogSetSchema.omit({ sessionId: true })),
});

export async function saveSessionSetsAction(
  input: z.infer<typeof SaveSessionSetsSchema>,
) {
  const { sessionId, sets } = SaveSessionSetsSchema.parse(input);
  // Replace any prior workout_sets for this session with the buffered ones,
  // so re-saving (or saving after edits) is idempotent.
  await db.delete(workoutSets).where(eq(workoutSets.sessionId, sessionId));
  if (sets.length > 0) {
    await db
      .insert(workoutSets)
      .values(sets.map((s) => ({ ...s, sessionId })));
  }
  return { ok: true as const, count: sets.length };
}

export async function updateSetAction(input: z.infer<typeof UpdateSetSchema>) {
  const data = UpdateSetSchema.parse(input);
  const [row] = await db
    .update(workoutSets)
    .set({
      repsCompleted: data.repsCompleted,
      weightUsed: data.weightUsed,
      rir: data.rir,
    })
    .where(eq(workoutSets.id, data.id))
    .returning();
  return { ok: true as const, set: row };
}

export async function completeSessionAction(sessionId: string) {
  // Mark any still-pending session_exercises as skipped, but only set status=completed on the session.
  await db
    .update(workoutSessions)
    .set({ completedAt: new Date(), status: "completed" })
    .where(eq(workoutSessions.id, sessionId));
  await db
    .update(sessionExercises)
    .set({ status: "skipped" })
    .where(and(eq(sessionExercises.sessionId, sessionId), eq(sessionExercises.status, "pending")));
  revalidatePath("/");
  revalidatePath("/history");
  return { ok: true as const };
}

export async function discardSessionAction(sessionId: string) {
  // Hard delete — FK cascades drop workout_sets and session_exercises rows.
  await db.delete(workoutSessions).where(eq(workoutSessions.id, sessionId));
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function endSessionEarlyAction(sessionId: string) {
  await db
    .update(workoutSessions)
    .set({ completedAt: new Date(), status: "partial" })
    .where(eq(workoutSessions.id, sessionId));
  await db
    .update(sessionExercises)
    .set({ status: "skipped" })
    .where(and(eq(sessionExercises.sessionId, sessionId), eq(sessionExercises.status, "pending")));
  revalidatePath("/");
  revalidatePath("/history");
  return { ok: true as const };
}

const SetSessionExerciseNotesSchema = z.object({
  sessionExerciseId: z.string().uuid(),
  notes: z.string().max(2000).nullable(),
});

export async function setSessionExerciseNotesAction(
  input: z.infer<typeof SetSessionExerciseNotesSchema>,
) {
  const { sessionExerciseId, notes } = SetSessionExerciseNotesSchema.parse(input);
  const trimmed = notes?.trim();
  await db
    .update(sessionExercises)
    .set({ notes: trimmed && trimmed.length > 0 ? trimmed : null })
    .where(eq(sessionExercises.id, sessionExerciseId));
  return { ok: true as const };
}

const SwapSchema = z.object({
  sessionExerciseId: z.string().uuid(),
  newExerciseId: z.string().uuid(),
});

export async function swapSessionExerciseAction(input: z.infer<typeof SwapSchema>) {
  const { sessionExerciseId, newExerciseId } = SwapSchema.parse(input);

  const [se] = await db
    .select()
    .from(sessionExercises)
    .where(eq(sessionExercises.id, sessionExerciseId))
    .limit(1);
  if (!se) return { ok: false as const, error: "Session exercise not found" };

  const [setLogged] = await db
    .select()
    .from(workoutSets)
    .where(eq(workoutSets.sessionExerciseId, sessionExerciseId))
    .limit(1);
  if (setLogged) return { ok: false as const, error: "Cannot swap — sets already logged" };

  const [newEx] = await db
    .select()
    .from(exercises)
    .where(eq(exercises.id, newExerciseId))
    .limit(1);
  if (!newEx) return { ok: false as const, error: "Exercise not found" };

  // If swapping a main lift (had a liftId), null it so AMRAP bump logic doesn't fire on the substitute.
  await db
    .update(sessionExercises)
    .set({
      exerciseId: newExerciseId,
      swappedFromExerciseId: se.swappedFromExerciseId ?? se.exerciseId,
      liftId: null,
    })
    .where(eq(sessionExercises.id, sessionExerciseId));

  revalidatePath("/");
  return { ok: true as const, wasMainLift: se.liftId != null };
}

const ReorderSchema = z.object({
  sessionId: z.string().uuid(),
  orderedIds: z.array(z.string().uuid()).min(1),
});

export async function reorderSessionExercisesAction(input: z.infer<typeof ReorderSchema>) {
  const { sessionId, orderedIds } = ReorderSchema.parse(input);
  // Sequential updates (drizzle's transaction API varies by driver). For dev DB this is fine.
  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .update(sessionExercises)
      .set({ orderIndex: i })
      .where(
        and(
          eq(sessionExercises.id, orderedIds[i]),
          eq(sessionExercises.sessionId, sessionId),
        ),
      );
  }
  revalidatePath("/");
  return { ok: true as const };
}

const ExtraSessionExerciseSchema = z.object({
  exerciseId: z.string().uuid(),
  sets: z.number().int().positive(),
  reps: z.number().int().positive(),
  rirTarget: z.number().int().min(0).max(5).nullable().optional(),
});

const StartExtraSchema = z.object({
  exercises: z.array(ExtraSessionExerciseSchema).min(1),
});

export async function startExtraSessionAction(input: z.infer<typeof StartExtraSchema>) {
  const { exercises: exs } = StartExtraSchema.parse(input);

  const [created] = await db
    .insert(workoutSessions)
    .values({
      programDayId: null,
      isExtra: true,
      status: "in_progress",
      deloadFactor: 1,
    })
    .returning();

  await db.insert(sessionExercises).values(
    exs.map((e, i) => ({
      sessionId: created.id,
      programExerciseId: null,
      exerciseId: e.exerciseId,
      orderIndex: i,
      prescriptionType: "rir_target" as const,
      sets: e.sets,
      reps: e.reps,
      rirTarget: e.rirTarget ?? 1,
      isAmrapTopSet: false,
    })),
  );

  return { ok: true as const, sessionId: created.id };
}

const MarkDayStatusSchema = z.object({
  programDayId: z.string().uuid(),
  state: z.enum(["done", "missed", "rescheduled", "skipped"]),
  rescheduledTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export async function markDayStatusAction(input: z.infer<typeof MarkDayStatusSchema>) {
  const data = MarkDayStatusSchema.parse(input);
  const [existing] = await db
    .select()
    .from(dayStatus)
    .where(eq(dayStatus.programDayId, data.programDayId))
    .limit(1);
  if (existing) {
    await db
      .update(dayStatus)
      .set({
        state: data.state,
        rescheduledTo: data.rescheduledTo ?? null,
        updatedAt: new Date(),
      })
      .where(eq(dayStatus.id, existing.id));
  } else {
    await db.insert(dayStatus).values({
      programDayId: data.programDayId,
      state: data.state,
      rescheduledTo: data.rescheduledTo ?? null,
    });
  }
  revalidatePath("/");
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
  revalidatePath("/", "layout");
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

export async function setTimezoneAction(timezone: string) {
  // Validate against the runtime's IANA list to avoid storing junk.
  const valid = z
    .string()
    .min(1)
    .max(100)
    .refine(
      (v) => {
        try {
          new Intl.DateTimeFormat("en-US", { timeZone: v });
          return true;
        } catch {
          return false;
        }
      },
      { message: "Invalid IANA timezone" },
    )
    .safeParse(timezone);
  if (!valid.success) return { ok: false as const, error: valid.error.message };
  const tz = valid.data;
  const [s] = await db.select().from(settings).limit(1);
  if (s) {
    await db.update(settings).set({ timezone: tz, updatedAt: new Date() }).where(eq(settings.id, s.id));
  } else {
    await db.insert(settings).values({ timezone: tz });
  }
  revalidatePath("/", "layout");
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
      .set({ currentWeek: 1, status: "active", startDate: isoDate(new Date(), await getTimezone()) })
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
