export const dynamic = "force-dynamic";

import { getAllExercises } from "@/lib/queries";
import { ExtraSessionBuilder } from "./builder";

export default async function ExtraSessionPage() {
  const exercises = await getAllExercises();
  return (
    <ExtraSessionBuilder
      library={exercises.map((e) => ({
        id: e.id,
        name: e.name,
        muscleGroup: e.muscleGroup,
        equipment: e.equipment,
      }))}
    />
  );
}
