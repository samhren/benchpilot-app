import { getActiveProgram, getAllLifts, getSettings } from "@/lib/queries";
import SettingsClient from "./settings-client";

export default async function SettingsPage() {
  const [program, lifts, s] = await Promise.all([getActiveProgram(), getAllLifts(), getSettings()]);
  const safe = lifts.map((l) => ({
    name: l.name,
    currentOneRm: l.currentOneRm,
    trainingMax: l.trainingMax,
  }));
  return (
    <SettingsClient
      lifts={safe}
      currentWeek={program?.currentWeek ?? 1}
      units={(s?.units as "lb" | "kg") ?? "lb"}
    />
  );
}
