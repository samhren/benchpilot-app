export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { workoutSessions, workoutSets } from "@/lib/db/schema";
import {
  getAllExercises,
  getAllLifts,
  getLastSessionSetsForExercise,
  getProgramDay,
  getSessionExercises,
  getSettings,
} from "@/lib/queries";
import { startSessionAction } from "@/app/actions";
import { getTempoForBenchSet } from "@/lib/programming/tempo";
import { requireUserId } from "@/lib/auth";
import ActiveWorkout, { type SetRow } from "./active-client";

interface Params { id: string }

export default async function ActivePage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams?: Promise<{ deload?: string }>;
}) {
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const userId = await requireUserId();
  const day = await getProgramDay(id);
  if (!day) notFound();
  if (day.sessionType === "rest") redirect("/program");

  const deloadFactor = sp.deload ? Math.max(0.3, Math.min(1, parseFloat(sp.deload))) : undefined;

  // If this program day already has a completed session and no live in-progress
  // session, don't auto-create another one. Send the user back to the dashboard
  // instead — this is the guard that prevents the "phantom resume banner"
  // race when the URL is reloaded immediately after submit.
  const [priorCompleted] = await db
    .select({ id: workoutSessions.id })
    .from(workoutSessions)
    .where(
      and(
        eq(workoutSessions.userId, userId),
        eq(workoutSessions.programDayId, id),
        isNotNull(workoutSessions.completedAt),
      ),
    )
    .limit(1);
  if (priorCompleted) {
    const [stillInFlight] = await db
      .select({ id: workoutSessions.id })
      .from(workoutSessions)
      .where(
        and(
          eq(workoutSessions.userId, userId),
          eq(workoutSessions.programDayId, id),
          isNull(workoutSessions.completedAt),
        ),
      )
      .limit(1);
    if (!stillInFlight) {
      redirect("/");
    }
  }

  // Ensure a session exists (snapshots template into session_exercises on first call).
  const startResult = await startSessionAction({ programDayId: id, deloadFactor });
  if (!startResult.ok) notFound();
  const sessionId = startResult.sessionId;

  const exs = await getSessionExercises(sessionId);
  const [sessionRow] = await db
    .select()
    .from(workoutSessions)
    .where(and(eq(workoutSessions.id, sessionId), eq(workoutSessions.userId, userId)))
    .limit(1);
  const sessionStartedAt = sessionRow?.startedAt
    ? new Date(sessionRow.startedAt).getTime()
    : Date.now();
  const sessionFirstSetAt = sessionRow?.firstSetAt
    ? new Date(sessionRow.firstSetAt).getTime()
    : null;
  const loggedSets = await db
    .select()
    .from(workoutSets)
    .where(and(eq(workoutSets.sessionId, sessionId), eq(workoutSets.userId, userId)));
  const initialIdx = loggedSets.length;
  const loggedMap = new Map<string, (typeof loggedSets)[number]>();
  for (const s of loggedSets) {
    if (!s.sessionExerciseId) continue;
    loggedMap.set(`${s.sessionExerciseId}:${s.setNumber}`, s);
  }
  const lifts = await getAllLifts();
  const settings = await getSettings();
  const allExercises = await getAllExercises();
  const benchTm = lifts.find((l) => l.name === "bench_press")?.trainingMax ?? null;

  // Flatten session_exercises into ordered SetRow[]. Weights are already snapshotted
  // into session_exercises.weightPrescribed (with deloadFactor applied at start).
  const rows: SetRow[] = [];
  for (const e of exs) {
    const lastSession = await getLastSessionSetsForExercise(e.ex.id, sessionId);
    const lastSet = lastSession?.sets[lastSession.sets.length - 1] ?? null;
    const last = lastSet ? { reps: lastSet.reps, weight: lastSet.weight } : null;
    const lastSessionRow = lastSession
      ? {
          date: lastSession.date,
          sets: lastSession.sets.map((s) => ({
            setNumber: s.setNumber,
            reps: s.reps,
            weight: s.weight,
          })),
        }
      : null;

    if (e.se.wavePlan) {
      const plan = e.se.wavePlan as Array<{
        percentage: number;
        sets: number;
        reps: number;
        isAmrap?: boolean;
      }>;
      let setNumber = 1;
      const totalSets = plan.reduce((acc, p) => acc + p.sets, 0);
      for (const p of plan) {
        for (let s = 0; s < p.sets; s++) {
          const isMainLift = e.se.liftId != null;
          const isAmrap = !!p.isAmrap;
          const tempo =
            day.sessionType === "upper_a" ||
            day.sessionType === "upper_b" ||
            day.sessionType === "upper_c"
              ? getTempoForBenchSet({
                  sessionType: day.sessionType,
                  percentage: p.percentage,
                  isAmrap,
                  isMainLift,
                })
              : "controlled";
          const wp =
            benchTm != null ? Math.round((benchTm * p.percentage) / 100 / 5) * 5 : null;
          const setNum = setNumber++;
          const loggedRow = loggedMap.get(`${e.se.id}:${setNum}`);
          rows.push({
            kind: "main",
            isMainLift,
            sessionExerciseId: e.se.id,
            exerciseId: e.ex.id,
            exerciseName: e.ex.name,
            equipment: e.ex.equipment ?? null,
            setNumber: setNum,
            totalSets,
            repsPrescribed: p.reps,
            weightPrescribed: wp,
            percentage: p.percentage,
            isAmrap,
            rirTarget: null,
            sessionLabel: day.displayName,
            tempo,
            requiresWeightInput: wp == null,
            last,
            lastSession: lastSessionRow,
            logged: loggedRow
              ? {
                  id: loggedRow.id,
                  repsCompleted: loggedRow.repsCompleted ?? 0,
                  weightUsed: loggedRow.weightUsed ?? 0,
                  rir: loggedRow.rir,
                }
              : null,
          });
        }
      }
    } else {
      const totalSets = e.se.sets;
      for (let s = 0; s < e.se.sets; s++) {
        const isAmrap = e.se.isAmrapTopSet && s === e.se.sets - 1;
        const isMainLift = e.se.liftId != null;
        const tempo =
          (day.sessionType === "upper_a" ||
            day.sessionType === "upper_b" ||
            day.sessionType === "upper_c") &&
          e.se.percentageOfTm != null
            ? getTempoForBenchSet({
                sessionType: day.sessionType,
                percentage: e.se.percentageOfTm,
                isAmrap,
                isMainLift,
              })
            : "controlled";
        const setNum = s + 1;
        const loggedRow = loggedMap.get(`${e.se.id}:${setNum}`);
        rows.push({
          kind: isMainLift ? "main" : "accessory",
          isMainLift,
          sessionExerciseId: e.se.id,
          exerciseId: e.ex.id,
          exerciseName: e.ex.name,
          equipment: e.ex.equipment ?? null,
          setNumber: setNum,
          totalSets,
          repsPrescribed: e.se.reps,
          weightPrescribed: e.se.weightPrescribed,
          percentage: e.se.percentageOfTm,
          isAmrap,
          rirTarget: e.se.rirTarget,
          sessionLabel: day.displayName,
          tempo,
          requiresWeightInput: e.se.weightPrescribed == null,
          last,
          lastSession: lastSessionRow,
          logged: loggedRow
            ? {
                id: loggedRow.id,
                repsCompleted: loggedRow.repsCompleted ?? 0,
                weightUsed: loggedRow.weightUsed ?? 0,
                rir: loggedRow.rir,
              }
            : null,
        });
      }
    }
  }

  const isBenchAmrapDay = rows.some((r) => r.isAmrap && r.exerciseName === "Bench Press");

  const sessionExerciseList = exs.map((e) => ({
    id: e.se.id,
    exerciseId: e.ex.id,
    name: e.ex.name,
    muscleGroup: e.ex.muscleGroup,
    orderIndex: e.se.orderIndex,
    status: e.se.status,
    swappedFromExerciseId: e.se.swappedFromExerciseId,
    isMainLift: e.se.liftId != null,
    notes: e.se.notes ?? null,
  }));
  const library = allExercises.map((e) => ({
    id: e.id,
    name: e.name,
    muscleGroup: e.muscleGroup,
    equipment: e.equipment,
  }));

  const units: "lb" | "kg" = settings?.units === "kg" ? "kg" : "lb";

  return (
    <ActiveWorkout
      sessionId={sessionId}
      programDayId={id}
      sessionLabel={day.displayName}
      sessionType={day.sessionType}
      sessionStartedAt={sessionStartedAt}
      sessionFirstSetAt={sessionFirstSetAt}
      initialIdx={initialIdx}
      rows={rows}
      isBenchAmrapDay={isBenchAmrapDay}
      benchTm={benchTm}
      units={units}
      restMainSec={settings?.defaultRestMainSec ?? 180}
      restAccessorySec={settings?.defaultRestAccessorySec ?? 90}
      enableWarmup={settings?.enableWarmup ?? false}
      showTempo={settings?.showTempo ?? true}
      sessionExercises={sessionExerciseList}
      library={library}
    />
  );
}
