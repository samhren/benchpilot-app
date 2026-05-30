export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getActiveProgram, getScheduledDayCandidate, getSettings } from "@/lib/queries";

export default async function WorkoutIndex() {
  const program = await getActiveProgram();
  if (!program) redirect("/settings");
  const settings = await getSettings();
  const next = await getScheduledDayCandidate(program.id, new Date(), settings?.timezone ?? "UTC");
  if (next) redirect(`/workout/${next.pd.id}`);
  redirect("/program");
}
