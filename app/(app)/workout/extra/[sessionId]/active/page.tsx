export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { workoutSessions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  getAllExercises,
  getAllLifts,
  getLastSetForExercise,
  getSessionExercises,
  getSettings,
} from "@/lib/queries";
import ActiveWorkout, { type SetRow } from "../../../[id]/active/active-client";

interface Params { sessionId: string }

export default async function ExtraActivePage({ params }: { params: Promise<Params> }) {
  const { sessionId } = await params;

  const [sess] = await db
    .select()
    .from(workoutSessions)
    .where(eq(workoutSessions.id, sessionId))
    .limit(1);
  if (!sess || !sess.isExtra) notFound();

  const exs = await getSessionExercises(sessionId);
  const lifts = await getAllLifts();
  const settings = await getSettings();
  const allExercises = await getAllExercises();
  const benchTm = lifts.find((l) => l.name === "bench_press")?.trainingMax ?? null;

  const rows: SetRow[] = [];
  for (const e of exs) {
    const lastSet = await getLastSetForExercise(e.ex.id);
    const last = lastSet
      ? { reps: lastSet.repsCompleted ?? 0, weight: lastSet.weightUsed ?? 0 }
      : null;
    const totalSets = e.se.sets;
    for (let s = 0; s < e.se.sets; s++) {
      rows.push({
        kind: "accessory",
        sessionExerciseId: e.se.id,
        exerciseId: e.ex.id,
        exerciseName: e.ex.name,
        setNumber: s + 1,
        totalSets,
        repsPrescribed: e.se.reps,
        weightPrescribed: e.se.weightPrescribed,
        percentage: e.se.percentageOfTm,
        isAmrap: false,
        rirTarget: e.se.rirTarget,
        sessionLabel: "Extra session",
        last,
      });
    }
  }

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
      programDayId={null}
      sessionLabel={"Extra — Off-schedule"}
      rows={rows}
      isBenchAmrapDay={false}
      benchTm={benchTm}
      restMainSec={settings?.defaultRestMainSec ?? 180}
      restAccessorySec={settings?.defaultRestAccessorySec ?? 90}
      sessionExercises={sessionExerciseList}
      library={library}
    />
  );
}
