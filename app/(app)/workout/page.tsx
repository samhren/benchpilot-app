import { redirect } from "next/navigation";
import { getActiveProgram, getNextScheduledDay } from "@/lib/queries";

export default async function WorkoutIndex() {
  const program = await getActiveProgram();
  if (!program) redirect("/settings");
  const next = await getNextScheduledDay(program.id);
  if (next) redirect(`/workout/${next.id}`);
  redirect("/program");
}
