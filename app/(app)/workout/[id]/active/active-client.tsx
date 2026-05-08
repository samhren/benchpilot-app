"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BP, BigButton, Eyebrow, Mono, Pill, StepDots, calcPlates, platesSummary } from "@/components/ui/primitives";
import {
  applyAmrapBumpAction,
  completeSessionAction,
  logSetAction,
  startSessionAction,
} from "@/app/actions";
import { offlineQueue } from "@/lib/offline";

export interface SetRow {
  kind: "main" | "accessory";
  programExerciseId: string;
  exerciseId: string;
  exerciseName: string;
  setNumber: number;
  totalSets: number;
  repsPrescribed: number;
  weightPrescribed: number | null;
  percentage: number | null;
  isAmrap: boolean;
  rirTarget: number | null;
  sessionLabel: string;
  last: { reps: number; weight: number } | null;
}

interface Props {
  programDayId: string;
  sessionLabel: string;
  rows: SetRow[];
  isBenchAmrapDay: boolean;
  benchTm: number | null;
  restMainSec: number;
  restAccessorySec: number;
}

export default function ActiveWorkout({
  programDayId,
  sessionLabel,
  rows,
  benchTm,
  restMainSec,
  restAccessorySec,
}: Props) {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [reps, setReps] = useState<number | null>(null);
  const [rir, setRir] = useState<number | null>(2);
  const [weightOverride, setWeightOverride] = useState<number | null>(null);
  const [restRemaining, setRestRemaining] = useState<number>(0);
  const [restTotal, setRestTotal] = useState<number>(0);
  const [restRunning, setRestRunning] = useState(false);
  const [showFullTimer, setShowFullTimer] = useState(false);
  const [showPlates, setShowPlates] = useState(false);
  const [bumpData, setBumpData] = useState<{ amrapReps: number; oldTm: number; newTm: number; bump: number; reason: string } | null>(null);
  const [completed, setCompleted] = useState<Record<number, { reps: number; weight: number }>>({});
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(Date.now());
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const current = rows[idx];

  useEffect(() => {
    void startSessionAction(programDayId).then((r) => {
      if (r.ok) setSessionId(r.sessionId);
    });
  }, [programDayId]);

  useEffect(() => {
    setReps(current?.isAmrap ? null : current?.repsPrescribed ?? null);
    setRir(current?.kind === "main" ? 2 : 1);
    setWeightOverride(null);
    setShowPlates(false);
  }, [idx, current?.isAmrap, current?.kind, current?.repsPrescribed]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!restRunning) return;
    const t = setInterval(() => {
      setRestRemaining((r) => {
        if (r <= 1) {
          setRestRunning(false);
          beep();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [restRunning]);

  useEffect(() => {
    // Acquire wake lock during workout
    let cancelled = false;
    if ("wakeLock" in navigator) {
      navigator.wakeLock
        .request("screen")
        .then((s) => {
          if (cancelled) {
            void s.release();
            return;
          }
          wakeLockRef.current = s;
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
      void wakeLockRef.current?.release();
      wakeLockRef.current = null;
    };
  }, []);

  function beep() {
    try {
      const ctx = audioCtxRef.current ?? new AudioContext();
      audioCtxRef.current = ctx;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      o.type = "sine";
      o.connect(g);
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.6, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
      o.start();
      o.stop(ctx.currentTime + 0.6);
    } catch {}
  }

  const elapsedMin = Math.floor((now - startedAt) / 60000);
  const elapsedSec = Math.floor(((now - startedAt) % 60000) / 1000);
  const elapsedDisplay = `${elapsedMin}:${String(elapsedSec).padStart(2, "0")}`;

  const weightDisplay = weightOverride ?? current?.weightPrescribed ?? null;
  const plates = useMemo(() => (weightDisplay ? calcPlates(weightDisplay) : []), [weightDisplay]);

  // Group sets by exercise for the dot progress: dots reflect sets within current exercise group
  const groupRange = useMemo(() => {
    if (!current) return { from: 0, to: 0 };
    let from = idx;
    while (from > 0 && rows[from - 1].programExerciseId === current.programExerciseId) from--;
    let to = idx;
    while (to < rows.length - 1 && rows[to + 1].programExerciseId === current.programExerciseId) to++;
    return { from, to };
  }, [idx, rows, current]);

  const totalInGroup = groupRange.to - groupRange.from + 1;
  const doneInGroup = idx - groupRange.from;

  if (!current) {
    return (
      <main className="min-h-dvh flex items-center justify-center" style={{ background: BP.bg }}>
        <div className="text-center">
          <Mono style={{ fontSize: 22 }}>No sets to log</Mono>
          <BigButton kind="dark" style={{ marginTop: 16, width: 200 }} onClick={() => router.push("/")}>
            Done
          </BigButton>
        </div>
      </main>
    );
  }

  async function logCurrentSet() {
    if (!sessionId) return toast.error("Session not ready");
    if (reps == null || !Number.isFinite(reps)) return toast.error("Enter reps");
    const weight = weightOverride ?? current.weightPrescribed ?? 0;

    const payload = {
      sessionId,
      programExerciseId: current.programExerciseId,
      exerciseId: current.exerciseId,
      setNumber: current.setNumber,
      repsPrescribed: current.repsPrescribed,
      repsCompleted: reps,
      weightPrescribed: current.weightPrescribed,
      weightUsed: weight,
      rir: current.isAmrap ? 0 : rir,
      isAmrap: current.isAmrap,
      isWarmup: false,
    };

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      await offlineQueue.enqueue({ kind: "log_set", payload });
      toast.success("Queued offline");
    } else {
      const r = await logSetAction(payload).catch(async () => {
        await offlineQueue.enqueue({ kind: "log_set", payload });
        return { ok: true as const, queued: true };
      });
      if (!r.ok) toast.error("Failed to log");
    }

    setCompleted((m) => ({ ...m, [idx]: { reps, weight } }));

    // Bench AMRAP → bump modal
    if (current.isAmrap && current.exerciseName === "Bench Press" && benchTm != null) {
      const projected = (() => {
        const prev = benchTm;
        if (reps < 8) return { newTm: prev, bump: 0, reason: "Hold TM (AMRAP under 8 reps)" };
        if (reps === 8)
          return { newTm: prev, bump: 0, reason: "Hold TM (AMRAP at 8 — borderline, holding for safety)" };
        if (reps <= 11) return { newTm: prev + 5, bump: 5, reason: "Standard +5 lb (9–11 AMRAP reps)" };
        return { newTm: prev + 10, bump: 10, reason: "Aggressive +10 lb (12+ AMRAP reps)" };
      })();
      setBumpData({
        amrapReps: reps,
        oldTm: benchTm,
        newTm: projected.newTm,
        bump: projected.bump,
        reason: projected.reason,
      });
      return; // Modal handles advance
    }

    advanceAfterLog();
  }

  function advanceAfterLog() {
    const nextRow = rows[idx + 1];
    if (nextRow) {
      const sec =
        nextRow.kind === "main" || (current && current.kind === "main") ? restMainSec : restAccessorySec;
      setRestTotal(sec);
      setRestRemaining(sec);
      setRestRunning(true);
      setIdx(idx + 1);
    } else {
      finish();
    }
  }

  async function finish() {
    if (sessionId) await completeSessionAction(sessionId);
    toast.success("Session complete");
    router.push("/");
    router.refresh();
  }

  return (
    <main style={{ background: BP.bg, minHeight: "100dvh" }} className="relative pb-44">
      <Header session={sessionLabel} elapsed={elapsedDisplay} onClose={() => router.push("/program")} />

      <div className="px-5 flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          {current.isAmrap ? <Pill>AMRAP</Pill> : null}
          <span className="text-[13px]" style={{ color: BP.textMuted }}>
            {current.exerciseName} · Set {current.setNumber} of {current.totalSets}
          </span>
        </div>
        <StepDots total={totalInGroup} done={doneInGroup} />
      </div>

      <div className="px-5 text-center">
        <Eyebrow>
          {current.percentage ? `${current.kind === "main" ? "Top" : "Working"} set · ${current.percentage}% TM` : "Working set"}
        </Eyebrow>
        <div className="flex items-baseline justify-center gap-2.5 mt-2" style={{ lineHeight: 0.85 }}>
          <Mono
            data-testid="prescribed-weight"
            style={{
              fontSize: current.isAmrap ? 148 : 132,
              fontWeight: 800,
              letterSpacing: "-0.06em",
              color: BP.text,
              textShadow: current.isAmrap ? "0 0 60px rgba(255,47,47,0.18)" : undefined,
            }}
          >
            {weightDisplay ?? "—"}
          </Mono>
          <Mono style={{ fontSize: 26, fontWeight: 600, color: BP.textDim, marginBottom: 12 }}>lb</Mono>
        </div>
        <div className="mt-2.5 text-sm" style={{ color: BP.textMuted }}>
          {current.isAmrap ? (
            <>Top set · 1 × max reps</>
          ) : (
            <>
              Prescribed: <Mono style={{ color: BP.text, fontWeight: 600 }}>{current.repsPrescribed} reps</Mono>
              {current.rirTarget != null ? <> · RIR {current.rirTarget}</> : null}
            </>
          )}
        </div>
        {current.last ? (
          <div className="mt-2 text-[13px]" style={{ color: BP.textMuted }} data-testid="last-time">
            Last: <Mono style={{ color: BP.text, fontWeight: 600 }}>{current.last.reps} reps</Mono> @{" "}
            <Mono>{current.last.weight}</Mono> lb
          </div>
        ) : null}
      </div>

      {/* Plate calc */}
      {weightDisplay ? (
        <div className="px-5 pt-6">
          <button
            onClick={() => setShowPlates((s) => !s)}
            className="w-full"
            data-testid="plate-chip"
            style={{
              background: BP.surface,
              borderRadius: 14,
              padding: "12px 14px",
              border: `1px solid ${BP.borderSoft}`,
              color: BP.text,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: BP.surface2 }}
              >
                <svg width={16} height={16} viewBox="0 0 16 16">
                  <rect x="1" y="3" width="2" height="10" rx="0.5" fill="#888" />
                  <rect x="13" y="3" width="2" height="10" rx="0.5" fill="#888" />
                  <rect x="3.5" y="6" width="9" height="4" rx="0.5" fill="#888" />
                </svg>
              </div>
              <div className="flex-1">
                <Eyebrow>Plates · 45 lb bar</Eyebrow>
                <Mono style={{ fontSize: 13, fontWeight: 600, color: BP.text, marginTop: 2 }} data-testid="plate-summary">
                  {platesSummary(plates)}
                </Mono>
              </div>
            </div>
            {showPlates ? (
              <div
                className="mt-3 pt-3 flex items-center justify-center"
                style={{ borderTop: `1px solid ${BP.borderSoft}` }}
              >
                <PlateStack plates={plates} />
              </div>
            ) : null}
          </button>
        </div>
      ) : null}

      {/* Reps input */}
      <div className="px-5 pt-4">
        <div
          className="mb-2 ml-1"
          style={{
            fontSize: 12,
            color: BP.textDim,
            fontWeight: 600,
            letterSpacing: 0.5,
            textTransform: "uppercase",
          }}
        >
          Reps performed
        </div>
        <RepsStepper value={reps} onChange={setReps} />
      </div>

      {/* RIR if not AMRAP */}
      {!current.isAmrap ? (
        <div className="px-5 pt-3">
          <RIRPicker value={rir ?? 2} onChange={setRir} />
        </div>
      ) : null}

      {/* Weight override row */}
      <div className="px-5 pt-3 flex items-center justify-between">
        <span className="text-[13px]" style={{ color: BP.textMuted }}>
          Weight: <Mono style={{ color: BP.text, fontWeight: 600 }}>{weightDisplay ?? "—"} lb</Mono>
        </span>
        <WeightOverride value={weightOverride} fallback={current.weightPrescribed} onChange={setWeightOverride} />
      </div>

      <div className="px-5 pt-5">
        <BigButton
          kind="primary"
          height={64}
          onClick={logCurrentSet}
          data-testid="log-set"
          icon={
            <svg width={18} height={18} viewBox="0 0 18 18" fill="none">
              <path d="M3 9l4 4 8-9" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        >
          {current.isAmrap ? "Log AMRAP set" : "Log set"}
        </BigButton>

        <button
          onClick={() => {
            if (!confirm("Skip this set?")) return;
            setIdx((i) => Math.min(rows.length - 1, i + 1));
          }}
          className="mt-2 w-full text-sm"
          style={{
            height: 44,
            background: "transparent",
            color: BP.textMuted,
            border: "none",
            cursor: "pointer",
          }}
          data-testid="skip-set"
        >
          Skip this set
        </button>
      </div>

      {/* Rest banner */}
      {restRunning && !showFullTimer ? (
        <RestBanner
          remaining={restRemaining}
          total={restTotal}
          onSkip={() => {
            setRestRunning(false);
            setRestRemaining(0);
          }}
          onTap={() => setShowFullTimer(true)}
        />
      ) : null}
      {showFullTimer ? (
        <FullTimerOverlay
          remaining={restRemaining}
          total={restTotal}
          nextRow={rows[idx]}
          onClose={() => setShowFullTimer(false)}
          onAdd30={() => {
            setRestRemaining((r) => r + 30);
            setRestTotal((t) => t + 30);
          }}
          onSkip={() => {
            setRestRunning(false);
            setRestRemaining(0);
            setShowFullTimer(false);
          }}
        />
      ) : null}

      {/* AMRAP bump modal */}
      {bumpData ? (
        <AMRAPBumpModal
          amrapReps={bumpData.amrapReps}
          oldTm={bumpData.oldTm}
          newTm={bumpData.newTm}
          bump={bumpData.bump}
          reason={bumpData.reason}
          onApply={async () => {
            const r = await applyAmrapBumpAction({
              liftName: "bench_press",
              amrapReps: bumpData.amrapReps,
            });
            if (r.ok) {
              toast.success(r.applied ? `Bench TM → ${bumpData.newTm} lb` : "TM held");
              setBumpData(null);
              advanceAfterLog();
            } else {
              toast.error("Failed");
            }
          }}
          onHold={() => {
            setBumpData(null);
            advanceAfterLog();
          }}
        />
      ) : null}

      {/* End of workout button */}
      <div className="px-5 pt-2 mt-4">
        <BigButton
          kind="ghost"
          height={48}
          onClick={async () => {
            if (!confirm("Finish workout now?")) return;
            await finish();
          }}
          data-testid="finish-workout"
        >
          Finish workout
        </BigButton>
      </div>
    </main>
  );
}

function Header({
  session,
  elapsed,
  onClose,
}: {
  session: string;
  elapsed: string;
  onClose: () => void;
}) {
  const [head, ...rest] = session.split("—");
  return (
    <div className="px-5 py-2 pb-3.5 flex items-center gap-3.5 pt-3">
      <button
        onClick={onClose}
        data-testid="close-active"
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          border: `1px solid ${BP.borderSoft}`,
          background: BP.surface,
          color: BP.textMuted,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width={14} height={14} viewBox="0 0 14 14">
          <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
        </svg>
      </button>
      <div className="flex-1 text-center">
        <Eyebrow>{head.trim()}</Eyebrow>
        <div className="text-sm font-semibold mt-px">{(rest.join("—") || "").trim()}</div>
      </div>
      <Mono
        style={{
          fontSize: 12,
          color: BP.textMuted,
          fontWeight: 600,
          background: BP.surface,
          padding: "6px 10px",
          borderRadius: 8,
          border: `1px solid ${BP.borderSoft}`,
        }}
      >
        {elapsed}
      </Mono>
    </div>
  );
}

function RepsStepper({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        gap: 0,
        background: BP.surface,
        borderRadius: 18,
        border: `1px solid ${BP.borderSoft}`,
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => onChange(Math.max(0, (value ?? 0) - 1))}
        data-testid="reps-minus"
        style={{
          width: 64,
          background: "transparent",
          border: "none",
          color: BP.text,
          fontSize: 28,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        −
      </button>
      <div className="flex-1 flex items-baseline justify-center gap-1.5 py-3.5">
        <Mono
          style={{
            fontSize: 44,
            fontWeight: 800,
            letterSpacing: "-0.04em",
            color: value == null ? BP.textFaint : BP.text,
          }}
          data-testid="reps-value"
        >
          {value == null ? "—" : value}
        </Mono>
        <Mono style={{ fontSize: 14, fontWeight: 500, color: BP.textDim }}>reps</Mono>
      </div>
      <button
        onClick={() => onChange((value ?? 0) + 1)}
        data-testid="reps-plus"
        style={{
          width: 64,
          background: "transparent",
          border: "none",
          color: BP.text,
          fontSize: 28,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        ＋
      </button>
    </div>
  );
}

function RIRPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div
      style={{
        background: BP.surface,
        borderRadius: 14,
        padding: "12px 14px 14px",
        border: `1px solid ${BP.borderSoft}`,
      }}
    >
      <div className="flex justify-between items-baseline mb-2.5">
        <div
          style={{
            fontSize: 12,
            color: BP.textDim,
            fontWeight: 600,
            letterSpacing: 0.5,
            textTransform: "uppercase",
          }}
        >
          RIR · reps in reserve
        </div>
        <Mono style={{ fontSize: 14, color: BP.text, fontWeight: 700 }}>{value}</Mono>
      </div>
      <div className="flex gap-1.5">
        {[0, 1, 2, 3, 4].map((n) => {
          const active = n === value;
          return (
            <button
              key={n}
              onClick={() => onChange(n)}
              style={{
                flex: 1,
                height: 46,
                borderRadius: 10,
                border: "none",
                background: active ? BP.accent : BP.surface2,
                color: active ? "#fff" : BP.textMuted,
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <Mono>{n}</Mono>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WeightOverride({
  value,
  fallback,
  onChange,
}: {
  value: number | null;
  fallback: number | null;
  onChange: (n: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(String(value ?? fallback ?? ""));
  if (!editing) {
    return (
      <button
        onClick={() => {
          setV(String(value ?? fallback ?? ""));
          setEditing(true);
        }}
        style={{
          background: "transparent",
          border: "none",
          color: BP.accent,
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
        }}
        data-testid="weight-override"
      >
        Override
      </button>
    );
  }
  return (
    <div className="flex gap-1">
      <input
        type="number"
        value={v}
        onChange={(e) => setV(e.target.value)}
        className="font-mono text-sm"
        style={{
          width: 80,
          height: 32,
          padding: "0 8px",
          background: BP.surface2,
          border: `1px solid ${BP.border}`,
          borderRadius: 8,
          color: BP.text,
          outline: "none",
        }}
      />
      <button
        onClick={() => {
          const n = parseFloat(v);
          onChange(Number.isFinite(n) ? n : null);
          setEditing(false);
        }}
        style={{
          height: 32,
          padding: "0 10px",
          background: BP.accent,
          color: "#fff",
          border: "none",
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Set
      </button>
    </div>
  );
}

function PlateStack({ plates }: { plates: number[] }) {
  const colors: Record<number, string> = { 45: "#3a4960", 35: "#5a3030", 25: "#3a3a3a", 10: "#2d2d2d", 5: "#202020", 2.5: "#1a1a1a" };
  const sizes: Record<number, number> = { 45: 56, 35: 48, 25: 42, 10: 32, 5: 26, 2.5: 22 };
  const widths: Record<number, number> = { 45: 8, 35: 8, 25: 7, 10: 6, 5: 5, 2.5: 4 };
  const left = [...plates].reverse();
  const right = plates;
  const Plate = ({ p }: { p: number }) => (
    <div
      style={{
        width: widths[p],
        height: sizes[p],
        background: colors[p],
        borderRadius: 2,
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    />
  );
  return (
    <div className="flex items-center gap-0">
      <div style={{ width: 18, height: 6, background: "#3a3a3a", borderRadius: "2px 0 0 2px" }} />
      {left.map((p, i) => (
        <div key={"l" + i} style={{ marginLeft: 1 }}>
          <Plate p={p} />
        </div>
      ))}
      <div style={{ width: 36, height: 4, background: "#444" }} />
      {right.map((p, i) => (
        <div key={"r" + i} style={{ marginRight: 1 }}>
          <Plate p={p} />
        </div>
      ))}
      <div style={{ width: 18, height: 6, background: "#3a3a3a", borderRadius: "0 2px 2px 0" }} />
    </div>
  );
}

function fmt(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.max(0, t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function RestBanner({
  remaining,
  total,
  onSkip,
  onTap,
}: {
  remaining: number;
  total: number;
  onSkip: () => void;
  onTap: () => void;
}) {
  const pct = total ? Math.max(0, Math.min(1, (total - remaining) / total)) : 0;
  const r = 25;
  const c = 2 * Math.PI * r;
  return (
    <div
      onClick={onTap}
      data-testid="rest-banner"
      className="fixed left-4 right-4 z-30"
      style={{
        bottom: "max(env(safe-area-inset-bottom, 0px), 24px)",
        maxWidth: 388,
        margin: "0 auto",
        background: "#181818",
        borderRadius: 18,
        padding: 14,
        border: `1px solid ${BP.border}`,
        boxShadow: "0 -8px 32px rgba(0,0,0,0.5)",
        cursor: "pointer",
      }}
    >
      <div className="flex items-center gap-3.5">
        <svg width={56} height={56} viewBox="0 0 56 56">
          <circle cx={28} cy={28} r={r} stroke={BP.border} strokeWidth={3} fill="none" />
          <circle
            cx={28}
            cy={28}
            r={r}
            stroke={BP.accent}
            strokeWidth={3}
            fill="none"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct)}
            strokeLinecap="round"
            transform="rotate(-90 28 28)"
          />
        </svg>
        <div className="flex-1 min-w-0">
          <Eyebrow>Rest</Eyebrow>
          <Mono style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em" }}>{fmt(remaining)}</Mono>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSkip();
          }}
          data-testid="rest-skip"
          style={{
            height: 40,
            padding: "0 14px",
            borderRadius: 10,
            background: BP.surface2,
            border: `1px solid ${BP.border}`,
            color: BP.text,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Skip
        </button>
      </div>
    </div>
  );
}

function FullTimerOverlay({
  remaining,
  total,
  nextRow,
  onClose,
  onAdd30,
  onSkip,
}: {
  remaining: number;
  total: number;
  nextRow: SetRow;
  onClose: () => void;
  onAdd30: () => void;
  onSkip: () => void;
}) {
  const pct = total ? Math.max(0, Math.min(1, (total - remaining) / total)) : 0;
  const r = 143;
  const c = 2 * Math.PI * r;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: BP.bg,
      }}
    >
      <div className="px-5 pt-12 flex justify-between items-center">
        <div>
          <Eyebrow>Resting</Eyebrow>
          <div className="text-[13px] mt-0.5" style={{ color: BP.textMuted }}>
            {nextRow?.exerciseName}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            border: `1px solid ${BP.borderSoft}`,
            background: BP.surface,
            color: BP.textMuted,
            cursor: "pointer",
          }}
        >
          ↩
        </button>
      </div>

      <div className="flex items-center justify-center" style={{ height: "60vh" }}>
        <div className="relative">
          <svg width={300} height={300}>
            <circle cx={150} cy={150} r={r} stroke={BP.border} strokeWidth={14} fill="none" />
            <circle
              cx={150}
              cy={150}
              r={r}
              stroke={BP.accent}
              strokeWidth={14}
              fill="none"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - pct)}
              strokeLinecap="round"
              transform="rotate(-90 150 150)"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Mono style={{ fontSize: 80, fontWeight: 800, letterSpacing: "-0.05em" }}>{fmt(remaining)}</Mono>
            <div className="mt-2 text-[13px]" style={{ color: BP.textDim, fontWeight: 500 }}>
              of {fmt(total)}
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 mt-2">
        <div
          style={{
            background: BP.surface,
            borderRadius: 18,
            padding: 18,
            border: `1px solid ${BP.borderSoft}`,
          }}
        >
          <Eyebrow>Up next</Eyebrow>
          <div className="flex items-baseline gap-3 mt-2">
            <Mono style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.03em" }}>
              {nextRow?.weightPrescribed ?? "—"}
            </Mono>
            <Mono style={{ fontSize: 16, color: BP.textDim }}>lb</Mono>
            <Mono style={{ fontSize: 16, color: BP.textMuted, marginLeft: "auto" }}>
              × {nextRow?.repsPrescribed ?? "—"}
            </Mono>
          </div>
        </div>
      </div>

      <div className="px-5 pt-4 flex gap-2.5">
        <BigButton kind="dark" height={56} style={{ flex: 1 }} onClick={onAdd30}>
          +30s
        </BigButton>
        <BigButton kind="primary" height={56} style={{ flex: 1.6 }} onClick={onSkip}>
          Skip rest
        </BigButton>
      </div>
    </div>
  );
}

function AMRAPBumpModal({
  amrapReps,
  oldTm,
  newTm,
  bump,
  reason,
  onApply,
  onHold,
}: {
  amrapReps: number;
  oldTm: number;
  newTm: number;
  bump: number;
  reason: string;
  onApply: () => void;
  onHold: () => void;
}) {
  const isHold = bump === 0;
  return (
    <div
      data-testid="amrap-bump-modal"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(10px)",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 12,
          right: 12,
          bottom: 28,
          maxWidth: 396,
          margin: "0 auto",
          background: "linear-gradient(180deg, #1a1a1a 0%, #141414 100%)",
          borderRadius: 28,
          padding: "20px 22px 22px",
          border: `1px solid ${BP.border}`,
          boxShadow: "0 -30px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,47,47,0.15)",
        }}
      >
        <div style={{ width: 40, height: 4, borderRadius: 2, background: "#3a3a3a", margin: "0 auto 14px" }} />
        <div className="flex items-center gap-2 mb-3.5">
          <Pill data-testid="bump-pill">{isHold ? "Hold TM" : `+${bump} lb bump`}</Pill>
          <Eyebrow>Bench TM</Eyebrow>
        </div>
        <div className="text-[24px] font-bold tracking-[-0.025em] leading-tight">
          You hit <Mono style={{ color: BP.accent }}>{amrapReps} reps</Mono> at 80% TM
        </div>
        <div className="text-sm mt-2 leading-snug" style={{ color: BP.textMuted }}>
          {reason}
        </div>

        <div
          className="flex items-center gap-3 mt-5 p-4"
          style={{ background: "#0d0d0d", border: `1px solid ${BP.borderSoft}`, borderRadius: 18 }}
        >
          <div className="flex-1 text-center">
            <Eyebrow>Was</Eyebrow>
            <Mono
              style={{ fontSize: 30, fontWeight: 700, color: BP.textMuted, marginTop: 4, display: "block", letterSpacing: "-0.02em" }}
            >
              {oldTm}
            </Mono>
            <Mono style={{ fontSize: 11, color: BP.textDim }}>lb</Mono>
          </div>
          <div className="flex items-center justify-center" style={{ width: 40 }}>
            <svg width={24} height={20} viewBox="0 0 24 20" fill="none">
              <path d="M3 10h17m0 0l-6-6m6 6l-6 6" stroke={BP.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="flex-1 text-center">
            <Eyebrow style={{ color: BP.accent, opacity: 0.9 }}>New</Eyebrow>
            <Mono
              data-testid="new-tm"
              style={{ fontSize: 38, fontWeight: 800, color: BP.text, marginTop: 4, display: "block", letterSpacing: "-0.03em" }}
            >
              {newTm}
            </Mono>
            <Mono style={{ fontSize: 11, color: BP.textDim }}>lb</Mono>
          </div>
        </div>

        <div className="flex flex-col gap-2 mt-4">
          <BigButton kind="primary" height={60} onClick={onApply} data-testid="apply-bump">
            {isHold ? "OK" : "Apply new TM"}
          </BigButton>
          {!isHold ? (
            <BigButton kind="dark" height={52} onClick={onHold}>
              Hold for now
            </BigButton>
          ) : null}
        </div>
      </div>
    </div>
  );
}
