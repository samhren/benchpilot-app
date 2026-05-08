export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import {
  getAllLifts,
  getLastSetForExercise,
  getProgramDay,
  getProgramExercises,
  getSettings,
} from "@/lib/queries";
import { resolveBenchPrescription } from "@/lib/programming/training-max";
import ActiveWorkout, { type SetRow } from "./active-client";

interface Params { id: string }

export default async function ActivePage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const day = await getProgramDay(id);
  if (!day) notFound();
  if (day.sessionType === "rest") redirect("/program");

  const exs = await getProgramExercises(id);
  const lifts = await getAllLifts();
  const settings = await getSettings();
  const benchTm = lifts.find((l) => l.name === "bench_press")?.trainingMax ?? null;

  // Flatten the workout into ordered SetRow[] — including wavePlan expansion for bench.
  const rows: SetRow[] = [];
  for (const e of exs) {
    const lastSet = await getLastSetForExercise(e.ex.id);
    const last = lastSet
      ? { reps: lastSet.repsCompleted ?? 0, weight: lastSet.weightUsed ?? 0 }
      : null;

    if (e.pe.wavePlan) {
      // wavePlan is array of {percentage, sets, reps, isAmrap}
      const plan = e.pe.wavePlan as Array<{
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
            programExerciseId: e.pe.id,
            exerciseId: e.ex.id,
            exerciseName: e.ex.name,
            setNumber: setNumber++,
            totalSets,
            repsPrescribed: p.reps,
            weightPrescribed:
              benchTm != null ? resolveBenchPrescription(p.percentage, benchTm) : null,
            percentage: p.percentage,
            isAmrap: !!p.isAmrap,
            rirTarget: null,
            sessionLabel: day.displayName,
            last,
          });
        }
      }
    } else {
      const totalSets = e.pe.sets;
      for (let s = 0; s < e.pe.sets; s++) {
        const w = e.pe.percentageOfTm != null && benchTm != null
          ? resolveBenchPrescription(e.pe.percentageOfTm, benchTm)
          : null;
        rows.push({
          kind: e.pe.percentageOfTm != null ? "main" : "accessory",
          programExerciseId: e.pe.id,
          exerciseId: e.ex.id,
          exerciseName: e.ex.name,
          setNumber: s + 1,
          totalSets,
          repsPrescribed: e.pe.reps,
          weightPrescribed: w,
          percentage: e.pe.percentageOfTm,
          isAmrap: e.pe.isAmrapTopSet && s === e.pe.sets - 1,
          rirTarget: e.pe.rirTarget,
          sessionLabel: day.displayName,
          last,
        });
      }
    }
  }

  const isBenchAmrapDay = rows.some((r) => r.isAmrap && r.exerciseName === "Bench Press");

  return (
    <ActiveWorkout
      programDayId={id}
      sessionLabel={day.displayName}
      rows={rows}
      isBenchAmrapDay={isBenchAmrapDay}
      benchTm={benchTm}
      restMainSec={settings?.defaultRestMainSec ?? 180}
      restAccessorySec={settings?.defaultRestAccessorySec ?? 90}
    />
  );
}
