export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import {
  getAllExercises,
  getAllLifts,
  getLastSetForExercise,
  getProgramDay,
  getSessionExercises,
  getSettings,
} from "@/lib/queries";
import { startSessionAction } from "@/app/actions";
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
  const day = await getProgramDay(id);
  if (!day) notFound();
  if (day.sessionType === "rest") redirect("/program");

  const deloadFactor = sp.deload ? Math.max(0.3, Math.min(1, parseFloat(sp.deload))) : undefined;

  // Ensure a session exists (snapshots template into session_exercises on first call).
  const startResult = await startSessionAction({ programDayId: id, deloadFactor });
  if (!startResult.ok) notFound();
  const sessionId = startResult.sessionId;

  const exs = await getSessionExercises(sessionId);
  const lifts = await getAllLifts();
  const settings = await getSettings();
  const allExercises = await getAllExercises();
  const benchTm = lifts.find((l) => l.name === "bench_press")?.trainingMax ?? null;

  // Flatten session_exercises into ordered SetRow[]. Weights are already snapshotted
  // into session_exercises.weightPrescribed (with deloadFactor applied at start).
  const rows: SetRow[] = [];
  for (const e of exs) {
    const lastSet = await getLastSetForExercise(e.ex.id);
    const last = lastSet
      ? { reps: lastSet.repsCompleted ?? 0, weight: lastSet.weightUsed ?? 0 }
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
          rows.push({
            kind: "main",
            sessionExerciseId: e.se.id,
            exerciseId: e.ex.id,
            exerciseName: e.ex.name,
            setNumber: setNumber++,
            totalSets,
            repsPrescribed: p.reps,
            weightPrescribed:
              benchTm != null ? Math.round((benchTm * p.percentage) / 100 / 5) * 5 : null,
            percentage: p.percentage,
            isAmrap: !!p.isAmrap,
            rirTarget: null,
            sessionLabel: day.displayName,
            last,
          });
        }
      }
    } else {
      const totalSets = e.se.sets;
      for (let s = 0; s < e.se.sets; s++) {
        rows.push({
          kind: e.se.percentageOfTm != null ? "main" : "accessory",
          sessionExerciseId: e.se.id,
          exerciseId: e.ex.id,
          exerciseName: e.ex.name,
          setNumber: s + 1,
          totalSets,
          repsPrescribed: e.se.reps,
          weightPrescribed: e.se.weightPrescribed,
          percentage: e.se.percentageOfTm,
          isAmrap: e.se.isAmrapTopSet && s === e.se.sets - 1,
          rirTarget: e.se.rirTarget,
          sessionLabel: day.displayName,
          last,
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
  }));
  const library = allExercises.map((e) => ({
    id: e.id,
    name: e.name,
    muscleGroup: e.muscleGroup,
    equipment: e.equipment,
  }));

  return (
    <ActiveWorkout
      sessionId={sessionId}
      programDayId={id}
      sessionLabel={day.displayName}
      rows={rows}
      isBenchAmrapDay={isBenchAmrapDay}
      benchTm={benchTm}
      restMainSec={settings?.defaultRestMainSec ?? 180}
      restAccessorySec={settings?.defaultRestAccessorySec ?? 90}
      sessionExercises={sessionExerciseList}
      library={library}
    />
  );
}
