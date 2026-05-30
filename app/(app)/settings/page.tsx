export const dynamic = "force-dynamic";

import { getActiveProgram, getAllLifts, getSettings } from "@/lib/queries";
import { getProgramProgress } from "@/lib/program-state";
import SettingsClient from "./settings-client";

export default async function SettingsPage() {
  const [program, lifts, s] = await Promise.all([getActiveProgram(), getAllLifts(), getSettings()]);
  const progress = program
    ? getProgramProgress(program.startDate, new Date(), s?.timezone ?? "UTC", program.totalWeeks)
    : null;
  const shown = ["bench_press", "back_squat"];
  const safe = lifts
    .filter((l) => shown.includes(l.name))
    .sort((a, b) => shown.indexOf(a.name) - shown.indexOf(b.name))
    .map((l) => ({
      name: l.name,
      currentOneRm: l.currentOneRm,
      trainingMax: l.trainingMax,
    }));
  return (
    <SettingsClient
      lifts={safe}
      currentWeek={progress?.week ?? 1}
      currentBlock={progress?.blockLabel ?? "Block 1"}
      startDate={program?.startDate ?? ""}
      units={(s?.units as "lb" | "kg") ?? "lb"}
      timezone={s?.timezone ?? "UTC"}
      age={s?.age ?? null}
      comparisonBodyWeightLb={s?.comparisonBodyWeightLb ?? null}
      restMainSec={s?.defaultRestMainSec ?? 180}
      restAccessorySec={s?.defaultRestAccessorySec ?? 90}
      enableWarmup={s?.enableWarmup ?? false}
    />
  );
}
