export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  getAllLifts,
  getLastSetForExercise,
  getProgramDay,
  getProgramExercises,
} from "@/lib/queries";
import { resolveBenchPrescription } from "@/lib/programming/training-max";
import { BP, Eyebrow, Mono, Pill } from "@/components/ui/primitives";
import { StartWorkoutButton } from "@/components/start-workout-button";

interface Params { id: string }

export default async function PreviewPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const day = await getProgramDay(id);
  if (!day) notFound();
  if (day.sessionType === "rest") redirect("/program");

  const exs = await getProgramExercises(id);
  const lifts = await getAllLifts();
  const benchTm = lifts.find((l) => l.name === "bench_press")?.trainingMax ?? null;

  const top = exs.find((e) => e.pe.percentageOfTm != null && e.pe.liftId);
  const topWeight = top?.pe.percentageOfTm != null && benchTm != null
    ? resolveBenchPrescription(top.pe.percentageOfTm, benchTm)
    : null;

  const totalVolume = exs.reduce((acc, e) => {
    if (e.pe.percentageOfTm != null && benchTm != null) {
      const w = resolveBenchPrescription(e.pe.percentageOfTm, benchTm);
      return acc + w * e.pe.sets * e.pe.reps;
    }
    return acc;
  }, 0);

  const last = await Promise.all(exs.map((e) => getLastSetForExercise(e.ex.id)));

  return (
    <div style={{ padding: "12px 20px 130px" }}>
      <Link href="/program" className="flex items-center gap-2 mt-1" style={{ color: BP.textMuted }}>
        <svg width={14} height={14} viewBox="0 0 14 14">
          <path d="M9 3l-4 4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
        <span className="text-[13px] font-medium">Program</span>
      </Link>

      <Eyebrow style={{ paddingTop: 18 }}>
        Wk {day.weekNumber} · Day {day.dayOfWeek}
      </Eyebrow>
      <div className="flex items-baseline gap-3 mt-1.5">
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em" }}>
          {day.displayName.split("—")[0].trim()}
        </div>
        <Pill bg={BP.surface} color={BP.accent} style={{ background: BP.accentSoft }}>
          {day.sessionType.replace("_", "-").toUpperCase()}
        </Pill>
      </div>
      <div className="text-sm mt-1" style={{ color: BP.textMuted }}>
        {day.displayName.includes("—") ? day.displayName.split("—")[1].trim() : ""}
      </div>

      {topWeight != null ? (
        <div
          className="mt-4 p-4 flex items-center gap-4"
          style={{ background: BP.surface, border: `1px solid ${BP.borderSoft}`, borderRadius: 16 }}
        >
          <div>
            <Eyebrow>Top set</Eyebrow>
            <div className="flex items-baseline gap-1.5 mt-1.5">
              <Mono style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.03em" }}>{topWeight}</Mono>
              <Mono style={{ fontSize: 14, color: BP.textDim }}>lb</Mono>
            </div>
            <Mono style={{ fontSize: 11, color: BP.textDim, marginTop: 4 }}>
              = {top?.pe.percentageOfTm}% × {benchTm} TM
            </Mono>
          </div>
          <div
            className="flex-1 pl-4"
            style={{ borderLeft: `1px solid ${BP.borderSoft}`, height: 56 }}
          >
            <Eyebrow>Volume (bench)</Eyebrow>
            <Mono style={{ fontSize: 18, fontWeight: 700, marginTop: 6, display: "block" }}>
              {totalVolume.toLocaleString()} lb
            </Mono>
          </div>
        </div>
      ) : null}

      <div className="mt-5">
        <Eyebrow style={{ marginLeft: 4, marginBottom: 10 }}>Exercises · {exs.length}</Eyebrow>
        <div className="flex flex-col gap-2">
          {exs.map((e, i) => {
            const lastSet = last[i];
            const isMain = e.pe.percentageOfTm != null && e.pe.liftId;
            const w = isMain && benchTm != null ? resolveBenchPrescription(e.pe.percentageOfTm!, benchTm) : null;
            return (
              <div
                key={e.pe.id}
                style={{
                  background: BP.surface,
                  borderRadius: 14,
                  border: `1px solid ${BP.borderSoft}`,
                  padding: "14px 16px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: isMain ? BP.accentSoft : BP.surface2,
                    color: isMain ? BP.accent : BP.textMuted,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 12,
                    flexShrink: 0,
                  }}
                >
                  <Mono>{i + 1}</Mono>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="text-[15px] font-semibold">{e.ex.name}</div>
                    <Mono style={{ fontSize: 13, fontWeight: 700, color: isMain ? BP.text : BP.textMuted, whiteSpace: "nowrap" }}>
                      {w != null ? `${w} lb` : e.pe.rirTarget != null ? `RIR ${e.pe.rirTarget}` : "—"}
                    </Mono>
                  </div>
                  <div className="flex items-center justify-between mt-1 gap-2">
                    <div className="text-[12px]" style={{ color: BP.textDim }}>
                      {e.ex.muscleGroup}
                    </div>
                    <Mono style={{ fontSize: 12, color: BP.textMuted }}>
                      {(() => {
                        if (e.pe.isAmrapTopSet) return "AMRAP";
                        const plan = Array.isArray(e.pe.wavePlan)
                          ? (e.pe.wavePlan as Array<{ sets: number; reps: number }>)
                          : null;
                        if (plan && plan.length > 0) {
                          const totalSets = plan.reduce((a, s) => a + s.sets, 0);
                          const reps = plan.every((s) => s.reps === plan[0].reps) ? `${plan[0].reps}` : "varies";
                          return `${totalSets} × ${reps}`;
                        }
                        return `${e.pe.sets} × ${e.pe.reps}`;
                      })()}
                    </Mono>
                  </div>
                  {lastSet ? (
                    <div className="text-[11px] mt-1.5" style={{ color: BP.textFaint }}>
                      Last: <Mono>{lastSet.repsCompleted}</Mono> reps @ <Mono>{lastSet.weightUsed}</Mono> lb
                    </div>
                  ) : e.pe.notes ? (
                    <div className="text-[11px] mt-1.5 italic" style={{ color: BP.textFaint }}>
                      {e.pe.notes}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div
        className="fixed left-0 right-0 bottom-0"
        style={{
          padding: "14px 20px 36px",
          background: "linear-gradient(to top, #0a0a0a 70%, rgba(10,10,10,0))",
          maxWidth: 420,
          margin: "0 auto",
        }}
      >
        <StartWorkoutButton programDayId={id} />
      </div>
    </div>
  );
}
