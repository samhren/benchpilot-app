import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getActiveProgram,
  getAllLifts,
  getBodyWeightsSinceDays,
  getNextScheduledDay,
  getProgramExercises,
} from "@/lib/queries";
import { computeProgramWeek, dayOfWeekFromJs } from "@/lib/program-state";
import { resolveBenchPrescription } from "@/lib/programming/training-max";
import { BP, Eyebrow, Mono, Pill, BigButton, Card, Sparkline, StatCard } from "@/components/ui/primitives";
import { LogWeightButton } from "@/components/log-weight-button";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SHORT_MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function Dashboard() {
  const program = await getActiveProgram();
  if (!program) redirect("/settings");

  const today = new Date();
  const week = computeProgramWeek(program.startDate, today);
  const dow = dayOfWeekFromJs(today);

  const next = await getNextScheduledDay(program.id);
  const lifts = await getAllLifts();
  const bench = lifts.find((l) => l.name === "bench_press") ?? null;
  const squat = lifts.find((l) => l.name === "back_squat") ?? null;
  const dl = lifts.find((l) => l.name === "deadlift") ?? null;

  const benchTm = bench?.trainingMax ?? null;
  const bw = await getBodyWeightsSinceDays(28);
  const bwSeries = bw.map((b) => b.weightLb);
  const latestBw = bwSeries.length ? bwSeries[bwSeries.length - 1] : null;
  const bwDelta = bwSeries.length >= 2 ? bwSeries[bwSeries.length - 1] - bwSeries[0] : null;

  // Resolve a brief preview of bench top-set weight if applicable
  let nextPreview: { weight: number | null; reps: number; sets: number; pct: number | null } | null = null;
  let nextDayLabel = "Rest day";
  if (next) {
    nextDayLabel = next.displayName;
    const exs = await getProgramExercises(next.id);
    const benchEx = exs.find((e) => e.ex.name === "Bench Press" && e.pe.percentageOfTm != null);
    if (benchEx && benchEx.pe.percentageOfTm != null && benchTm != null) {
      nextPreview = {
        weight: resolveBenchPrescription(benchEx.pe.percentageOfTm, benchTm),
        reps: benchEx.pe.reps,
        sets: benchEx.pe.sets,
        pct: benchEx.pe.percentageOfTm,
      };
    } else if (benchEx) {
      nextPreview = {
        weight: null,
        reps: benchEx.pe.reps,
        sets: benchEx.pe.sets,
        pct: benchEx.pe.percentageOfTm,
      };
    }
  }

  const dateLine = `${DAYS[today.getDay()]}, ${SHORT_MONTH[today.getMonth()]} ${today.getDate()}`;

  return (
    <div style={{ padding: "12px 20px 110px" }}>
      <div className="flex items-start justify-between pt-1">
        <div>
          <Eyebrow>
            Week {week} · Day {dow} · {DAYS[dow === 7 ? 0 : dow]}
          </Eyebrow>
          <div className="mt-1.5 text-[28px] font-bold tracking-[-0.03em]">{dateLine}</div>
        </div>
        <div
          className="w-10 h-10 rounded-full font-mono text-xs font-semibold flex items-center justify-center"
          style={{ background: BP.surface, border: `1px solid ${BP.borderSoft}`, color: BP.textMuted }}
        >
          BP
        </div>
      </div>

      {/* Today's session card */}
      <div
        style={{
          marginTop: 22,
          background: BP.surface,
          borderRadius: 22,
          border: `1px solid ${BP.borderSoft}`,
          padding: 20,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -40,
            right: -40,
            width: 160,
            height: 160,
            background: "radial-gradient(circle, rgba(255,47,47,0.12), transparent 70%)",
          }}
        />
        <div style={{ position: "relative" }}>
          <div className="flex items-center gap-2">
            {next ? <Pill>Today</Pill> : <Pill color={BP.textMuted}>Rest</Pill>}
            <span className="text-xs" style={{ color: BP.textMuted }}>
              {next ? "≈ 48 min" : "no session"}
            </span>
          </div>
          <div className="mt-3.5 text-[26px] font-bold tracking-[-0.025em] leading-tight">
            {nextDayLabel.split("—")[0].trim()}
          </div>
          <div className="mt-1 text-sm" style={{ color: BP.textMuted }}>
            {nextDayLabel.includes("—") ? nextDayLabel.split("—")[1].trim() : "Recovery & running"}
          </div>

          {nextPreview ? (
            <div className="mt-4 flex items-center gap-4">
              <ExerciseChip
                label="Bench"
                main={nextPreview.weight != null ? String(nextPreview.weight) : "—"}
                sub={nextPreview.weight != null ? `× ${nextPreview.reps} × ${nextPreview.sets}` : "set 1RM"}
              />
            </div>
          ) : null}

          <div className="mt-5">
            {next ? (
              <Link href={`/workout/${next.id}`} data-testid="start-workout">
                <BigButton
                  kind="primary"
                  height={64}
                  icon={
                    <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
                      <path d="M3 2l11 6-11 6V2z" fill="#fff" />
                    </svg>
                  }
                >
                  Start workout
                </BigButton>
              </Link>
            ) : (
              <BigButton kind="dark">Rest day</BigButton>
            )}
          </div>
        </div>
      </div>

      {/* Lifts row */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3 px-0.5">
          <Eyebrow>Training maxes</Eyebrow>
          <span className="text-[11px]" style={{ color: BP.textDim }}>
            tap to see history
          </span>
        </div>
        <div className="grid gap-2" style={{ gridTemplateColumns: "1.4fr 1fr 1fr" }}>
          <Link href="/lifts?l=bench_press" style={{ textDecoration: "none" }}>
            <StatCard
              testId="bench-tm-card"
              label="Bench"
              value={benchTm ?? "—"}
              sub={benchTm ? "current TM" : "set 1RM in Settings"}
            />
          </Link>
          <Link href="/lifts?l=back_squat" style={{ textDecoration: "none" }}>
            <StatCard label="Squat" value={squat?.currentOneRm ?? "—"} sub="1RM" />
          </Link>
          <Link href="/lifts?l=deadlift" style={{ textDecoration: "none" }}>
            <StatCard label="Deadlift" value={dl?.currentOneRm ?? "—"} sub="1RM" />
          </Link>
        </div>
      </div>

      {/* Bodyweight */}
      <div className="mt-4">
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <Eyebrow>Bodyweight · 4 wk</Eyebrow>
              <div className="flex items-baseline gap-1.5 mt-2">
                <Mono style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em" }}>
                  {latestBw != null ? latestBw.toFixed(1) : "—"}
                </Mono>
                <Mono style={{ fontSize: 12, color: BP.textDim }}>lb</Mono>
                {bwDelta != null ? (
                  <Mono
                    style={{
                      fontSize: 12,
                      color: bwDelta < 0 ? BP.green : BP.amber,
                      marginLeft: 8,
                    }}
                  >
                    {bwDelta > 0 ? "+" : ""}
                    {bwDelta.toFixed(1)}
                  </Mono>
                ) : null}
              </div>
            </div>
            {bwSeries.length >= 2 ? (
              <Sparkline data={bwSeries} width={150} height={48} />
            ) : null}
          </div>
          <div className="mt-3.5">
            <LogWeightButton />
          </div>
        </Card>
      </div>
    </div>
  );
}

function ExerciseChip({ label, main, sub }: { label: string; main: string; sub: string }) {
  return (
    <div className="flex flex-col gap-px">
      <div
        style={{
          fontSize: 11,
          color: BP.textDim,
          fontWeight: 600,
          letterSpacing: 0.4,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <Mono style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em" }}>{main}</Mono>
        <Mono style={{ fontSize: 11, color: BP.textDim }}>{sub}</Mono>
      </div>
    </div>
  );
}
