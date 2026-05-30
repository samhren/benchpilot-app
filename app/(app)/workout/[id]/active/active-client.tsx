"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BP, BigButton, Eyebrow, Mono, Pill, StepDots, calcPlates, platesSummary } from "@/components/ui/primitives";
import { barWeight } from "@/lib/plates";
import {
  applyAmrapBumpAction,
  completeSessionAction,
  discardSessionAction,
  endSessionEarlyAction,
  stampFirstSetAction,
  saveSessionSetsAction,
  setSessionExerciseNotesAction,
  swapSessionExerciseAction,
} from "@/app/actions";
import {
  ExerciseLibraryPicker,
  type LibraryExercise,
} from "@/components/exercise-library-picker";
import { getSessionTempoSummary, type Tempo } from "@/lib/programming/tempo";
import { restSecondsFor } from "@/lib/programming/rest";
import { applyAmrapBump } from "@/lib/programming/amrap";
import { getWarmupRoutine } from "@/lib/warmup";
import WarmupScreen from "./warmup-screen";
import type {
  BufferedSet,
  PendingBump,
  SessionExerciseEntry,
  SetRow,
} from "./types";
import { Header } from "./_components/Header";
import { RepsStepper } from "./_components/RepsStepper";
import { RIRPicker } from "./_components/RIRPicker";
import { WeightInput, WeightOverride } from "./_components/WeightInput";
import { PlateStack } from "./_components/PlateStack";
import { LastSessionModal } from "./_components/LastSessionModal";
import { AmrapTmPreview } from "./_components/AmrapTmPreview";
import { RestBanner, FullTimerOverlay } from "./_components/RestTimer";
import { PlanSheet } from "./_components/PlanSheet";
import { AMRAPBumpModal } from "./_components/AMRAPBumpModal";
import { TempoChip, TempoSheet } from "./_components/Tempo";
import { NoteSheet } from "./_components/NoteSheet";
import { ReviewSheet } from "./_components/ReviewSheet";
import { useRestTimer } from "./_hooks/useRestTimer";

export type { SetRow, SessionExerciseEntry };

interface Props {
  sessionId: string;
  programDayId?: string | null;
  sessionLabel: string;
  sessionType: string;
  sessionStartedAt: number;
  sessionFirstSetAt: number | null;
  initialIdx: number;
  rows: SetRow[];
  isBenchAmrapDay: boolean;
  benchTm: number | null;
  units: "lb" | "kg";
  restMainSec: number;
  restAccessorySec: number;
  enableWarmup: boolean;
  showTempo: boolean;
  sessionExercises: SessionExerciseEntry[];
  library: LibraryExercise[];
}

export default function ActiveWorkout({
  sessionId,
  sessionLabel,
  sessionType,
  sessionStartedAt,
  sessionFirstSetAt,
  initialIdx,
  rows,
  benchTm,
  units,
  restMainSec,
  restAccessorySec,
  enableWarmup,
  showTempo,
  sessionExercises,
  library,
}: Props) {
  const router = useRouter();
  // Guided warm-up runs before logging, only on a fresh session (nothing logged
  // yet) and only when the user enabled it. Tracked in component state — see
  // CLAUDE.md: localStorage isn't durable on this home-screen PWA, and the
  // server (firstSetAt / logged sets) is the source of truth on resume.
  const [showWarmup, setShowWarmup] = useState(
    () => enableWarmup && sessionFirstSetAt == null && initialIdx === 0,
  );
  const [warmupStartedAt, setWarmupStartedAt] = useState<number | null>(null);
  useEffect(() => {
    if (showWarmup && warmupStartedAt == null) setWarmupStartedAt(Date.now());
  }, [showWarmup, warmupStartedAt]);
  const [idx, setIdx] = useState(() => Math.min(initialIdx, Math.max(0, rows.length - 1)));
  const [showPlan, setShowPlan] = useState(false);
  const [showLast, setShowLast] = useState(false);
  const [swapTarget, setSwapTarget] = useState<SessionExerciseEntry | null>(null);
  const [reps, setReps] = useState<number | null>(null);
  const [rir, setRir] = useState<number | null>(2);
  const [weightOverride, setWeightOverride] = useState<number | null>(null);
  const [showPlates, setShowPlates] = useState(false);
  const [bumpData, setBumpData] = useState<{ amrapReps: number; amrapPercentage: number; oldTm: number; newTm: number; bump: number; reason: string } | null>(null);
  const [completed, setCompleted] = useState<Record<number, { reps: number; weight: number }>>({});
  const firstSetStorageKey = `bp:firstset:${sessionId}`;
  const [firstSetAt, setFirstSetAt] = useState<number | null>(sessionFirstSetAt);
  const [now, setNow] = useState(Date.now());
  const [showReview, setShowReview] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const {
    restStorageKey,
    restTotal,
    restRunning,
    restRemaining,
    showFullTimer,
    setShowFullTimer,
    setRestEndsAt,
    startRest,
    addRest,
    clearRest,
  } = useRestTimer({ sessionId, now, beep });
  const setLogStorageKey = `bp:setlog:${sessionId}`;
  const [setLog, setSetLog] = useState<Record<string, BufferedSet>>({});
  const [pendingBump, setPendingBump] = useState<PendingBump | null>(null);
  const [setLogHydrated, setSetLogHydrated] = useState(false);
  const [tempoSheet, setTempoSheet] = useState<Tempo | null>(null);
  const sessionTempoSummary =
    sessionType === "upper_a" || sessionType === "upper_b" || sessionType === "upper_c"
      ? getSessionTempoSummary(sessionType)
      : null;

  const current = rows[idx];
  const currentEntry = sessionExercises.find((e) => e.id === current?.sessionExerciseId) ?? null;
  const [noteEditing, setNoteEditing] = useState(false);
  const [localNotes, setLocalNotes] = useState<Record<string, string | null>>({});
  const currentNote = current
    ? localNotes[current.sessionExerciseId] ?? currentEntry?.notes ?? null
    : null;
  const showTempoChip =
    showTempo &&
    current?.exerciseName === "Bench Press" &&
    !!current?.tempo &&
    current.tempo !== "controlled";

  useEffect(() => {
    const logged = current ? getLogged(current) : null;
    if (logged) {
      setReps(logged.repsCompleted);
      setRir(logged.rir);
      setWeightOverride(
        current?.requiresWeightInput
          ? logged.weightUsed
          : current?.weightPrescribed != null && logged.weightUsed === current.weightPrescribed
            ? null
            : logged.weightUsed,
      );
    } else {
      setReps(current?.isAmrap ? null : current?.repsPrescribed ?? null);
      setRir(current?.kind === "main" ? 2 : 1);
      // For non-bench rows the user must enter weight each set; pre-fill with last
      // session's weight if available so they only have to adjust.
      setWeightOverride(current?.requiresWeightInput ? current?.last?.weight ?? null : null);
    }
    setShowPlates(false);
    // setLog is in the deps so navigating to a freshly-logged set picks it up.
  }, [
    idx,
    current?.isAmrap,
    current?.kind,
    current?.repsPrescribed,
    current?.requiresWeightInput,
    current?.last?.weight,
    setLog,
  ]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    // Hydrate the set buffer from localStorage. The server-loaded `logged` on
    // each row is only used as a fallback (e.g., a previously-saved partial).
    try {
      const raw = localStorage.getItem(setLogStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          setLog?: Record<string, BufferedSet>;
          pendingBump?: PendingBump | null;
        };
        if (parsed.setLog) setSetLog(parsed.setLog);
        if (parsed.pendingBump) setPendingBump(parsed.pendingBump);
      }
    } catch {}
    // Server is source of truth. If the server has no first_set_at yet,
    // fall back to the local cache (used while offline) and then to a
    // best-effort anchor if there are server-persisted logged sets.
    if (sessionFirstSetAt == null) {
      try {
        const raw = localStorage.getItem(firstSetStorageKey);
        if (raw) {
          const t = parseInt(raw, 10);
          if (Number.isFinite(t)) setFirstSetAt(t);
        } else {
          const hasPriorLogged = rows.some((r) => r.logged != null);
          if (hasPriorLogged) {
            setFirstSetAt(sessionStartedAt);
          }
        }
      } catch {}
    }
    setSetLogHydrated(true);
  }, [setLogStorageKey, firstSetStorageKey, rows, sessionStartedAt, sessionFirstSetAt]);

  useEffect(() => {
    if (!setLogHydrated) return;
    try {
      localStorage.setItem(
        setLogStorageKey,
        JSON.stringify({ setLog, pendingBump }),
      );
    } catch {}
  }, [setLog, pendingBump, setLogStorageKey, setLogHydrated]);

  const jumpedAfterHydrationRef = useRef(false);
  useEffect(() => {
    if (!setLogHydrated || jumpedAfterHydrationRef.current) return;
    const firstUnlogged = rows.findIndex(
      (r) => !setLog[`${r.sessionExerciseId}:${r.setNumber}`] && !r.logged,
    );
    jumpedAfterHydrationRef.current = true;
    if (firstUnlogged >= 0 && firstUnlogged !== idx) setIdx(firstUnlogged);
  }, [setLog, rows, idx, setLogHydrated]);

  function logKey(row: { sessionExerciseId: string; setNumber: number }) {
    return `${row.sessionExerciseId}:${row.setNumber}`;
  }
  function getLogged(row: SetRow): BufferedSet | null {
    const fromBuffer = setLog[logKey(row)];
    if (fromBuffer) return fromBuffer;
    // Fall back to server-loaded logged data (e.g., partial workout pre-buffer).
    return row.logged
      ? {
          repsCompleted: row.logged.repsCompleted,
          weightUsed: row.logged.weightUsed,
          rir: row.logged.rir,
        }
      : null;
  }

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

  const elapsedDisplay = (() => {
    // Prefer the first working set; fall back to when the warm-up began so the
    // session clock starts ticking at warm-up, per the workout timer behaviour.
    const anchor = firstSetAt ?? warmupStartedAt;
    if (anchor == null) return "0:00";
    const dt = Math.max(0, now - anchor);
    const m = Math.floor(dt / 60000);
    const s = Math.floor((dt % 60000) / 1000);
    return `${m}:${String(s).padStart(2, "0")}`;
  })();

  const weightDisplay = current?.requiresWeightInput
    ? weightOverride
    : weightOverride ?? current?.weightPrescribed ?? null;
  const isBarbellRow =
    current?.equipment === "barbell" ||
    // Seed library doesn't carry equipment yet, so fall back to "bench is barbell".
    (current != null && !current.requiresWeightInput && current.exerciseName === "Bench Press");
  const showPlateCalc = isBarbellRow && weightDisplay != null;
  const plates = useMemo(
    () => (showPlateCalc && weightDisplay ? calcPlates(weightDisplay, units) : []),
    [showPlateCalc, weightDisplay, units],
  );

  // Group sets by exercise for the dot progress: dots reflect sets within current exercise group
  const groupRange = useMemo(() => {
    if (!current) return { from: 0, to: 0 };
    let from = idx;
    while (from > 0 && rows[from - 1].sessionExerciseId === current.sessionExerciseId) from--;
    let to = idx;
    while (to < rows.length - 1 && rows[to + 1].sessionExerciseId === current.sessionExerciseId) to++;
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

  if (showWarmup) {
    return (
      <WarmupScreen
        routine={getWarmupRoutine(sessionType)}
        sessionLabel={sessionLabel}
        startedAt={warmupStartedAt ?? now}
        beep={beep}
        onComplete={() => setShowWarmup(false)}
        onSkip={() => setShowWarmup(false)}
      />
    );
  }

  async function logCurrentSet() {
    if (reps == null || !Number.isFinite(reps)) return toast.error("Enter reps");
    if (current.requiresWeightInput && (weightOverride == null || !Number.isFinite(weightOverride))) {
      return toast.error("Enter weight");
    }
    const weight = current.requiresWeightInput
      ? weightOverride ?? 0
      : weightOverride ?? current.weightPrescribed ?? 0;

    const wasLoggedAlready = !!getLogged(current);
    const buffered: BufferedSet = {
      repsCompleted: reps,
      weightUsed: weight,
      rir: current.isAmrap ? 0 : rir,
    };
    setSetLog((m) => ({ ...m, [logKey(current)]: buffered }));
    setCompleted((m) => ({ ...m, [idx]: { reps, weight } }));
    if (firstSetAt == null && !wasLoggedAlready) {
      const t = Date.now();
      setFirstSetAt(t);
      try { localStorage.setItem(firstSetStorageKey, String(t)); } catch {}
      // Fire-and-forget server stamp. Idempotent and authoritative.
      stampFirstSetAction(sessionId).catch(() => null);
    }

    // Editing an already-logged set: don't re-trigger AMRAP modal, don't advance.
    if (wasLoggedAlready) {
      toast.success("Set updated");
      return;
    }

    // Bench AMRAP → bump modal (intent only; applied at session save)
    if (current.isAmrap && current.exerciseName === "Bench Press" && benchTm != null) {
      const amrapPercentage = current.percentage ?? 80;
      const projected = applyAmrapBump(benchTm, reps, { units, amrapPercentage });
      setBumpData({
        amrapReps: reps,
        amrapPercentage,
        oldTm: benchTm,
        newTm: projected.newTm,
        bump: projected.bumpAmount,
        reason: projected.reason,
      });
      return; // Modal handles advance
    }

    advanceAfterLog();
  }

  function advanceAfterLog() {
    const nextRow = rows[idx + 1];
    if (nextRow) {
      const currentSec = current ? restSecondsFor(current) : 0;
      const nextSec = restSecondsFor(nextRow);
      startRest(Math.max(currentSec, nextSec));
      setIdx(idx + 1);
    } else {
      // Last set logged — surface review screen instead of auto-submitting.
      // Also stop any rest timer; the workout is functionally done.
      setRestEndsAt(null);
      try { localStorage.removeItem(restStorageKey); } catch {}
      setShowReview(true);
    }
  }

  function buildBufferPayload() {
    const out: Array<{
      sessionExerciseId: string;
      exerciseId: string;
      setNumber: number;
      repsPrescribed: number | null;
      repsCompleted: number;
      weightPrescribed: number | null;
      weightUsed: number;
      rir: number | null;
      isAmrap: boolean;
      isWarmup: boolean;
    }> = [];
    for (const row of rows) {
      const b = setLog[logKey(row)];
      if (!b) continue;
      out.push({
        sessionExerciseId: row.sessionExerciseId,
        exerciseId: row.exerciseId,
        setNumber: row.setNumber,
        repsPrescribed: row.repsPrescribed,
        repsCompleted: b.repsCompleted,
        weightPrescribed: row.weightPrescribed,
        weightUsed: b.weightUsed,
        rir: b.rir,
        isAmrap: row.isAmrap,
        isWarmup: false,
      });
    }
    return out;
  }

  async function persistAndComplete(kind: "complete" | "early") {
    const sets = buildBufferPayload();
    if (kind === "complete" && sets.length === 0) {
      toast.error("No sets logged yet");
      return;
    }
    const save = await saveSessionSetsAction({ sessionId, sets }).catch(() => ({
      ok: false as const,
    }));
    if (!save.ok) {
      toast.error("Save failed — try again");
      return;
    }
    if (pendingBump?.applied) {
      await applyAmrapBumpAction({
        liftName: pendingBump.liftName,
        amrapReps: pendingBump.amrapReps,
        amrapPercentage: pendingBump.amrapPercentage,
        sessionId,
      }).catch(() => null);
    }
    if (kind === "complete") {
      await completeSessionAction(sessionId);
      toast.success("Session saved");
    } else {
      await endSessionEarlyAction(sessionId);
      toast.success("Saved partial workout");
    }
    try { localStorage.removeItem(setLogStorageKey); } catch {}
    try { localStorage.removeItem(firstSetStorageKey); } catch {}
    // Navigate away first; do NOT call router.refresh() here. Refresh
    // re-fetches the *current* route, which at this microtask is still
    // /workout/<id>/active — that re-runs startSessionAction and spawns a
    // phantom in-progress session 50ms after submit.
    router.push("/");
  }

  async function finish() {
    await persistAndComplete("complete");
  }

  async function endEarly() {
    await persistAndComplete("early");
  }

  async function discard() {
    try { localStorage.removeItem(setLogStorageKey); } catch {}
    try { localStorage.removeItem(restStorageKey); } catch {}
    try { localStorage.removeItem(firstSetStorageKey); } catch {}
    const r = await discardSessionAction(sessionId).catch(() => ({ ok: false as const }));
    if (!r.ok) {
      toast.error("Discard failed");
      return;
    }
    toast.success("Workout discarded");
    router.push("/");
    router.refresh();
  }

  return (
    <main style={{ background: BP.bg, minHeight: "100dvh" }} className="relative pb-44">
      <Header
        session={sessionLabel}
        elapsed={elapsedDisplay}
        onClose={() => router.push("/program")}
        onOpenPlan={() => setShowPlan(true)}
        onOpenLast={current.lastSession || current.last ? () => setShowLast(true) : undefined}
      />
      {showTempo && sessionTempoSummary ? (
        <div
          className="px-5 -mt-2 mb-3 text-[12px]"
          style={{ color: BP.textDim, fontWeight: 500 }}
          data-testid="session-tempo-summary"
        >
          {sessionTempoSummary}
        </div>
      ) : null}

      <div className="px-5 mb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div
              data-testid="current-exercise-name"
              style={{
                fontSize: 26,
                fontWeight: 800,
                letterSpacing: "-0.025em",
                color: BP.text,
                lineHeight: 1.1,
              }}
            >
              {current.exerciseName}
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
              {current.isAmrap ? <Pill>AMRAP</Pill> : null}
              {getLogged(current) ? (
                <Pill bg={BP.surface2} color={BP.textMuted}>
                  Logged
                </Pill>
              ) : null}
              <Mono
                data-testid="set-rep-summary"
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: BP.text,
                  background: BP.surface,
                  border: `1px solid ${BP.borderSoft}`,
                  borderRadius: 999,
                  padding: "3px 10px",
                }}
              >
                {current.totalSets} × {current.repsPrescribed}
              </Mono>
              <span className="text-[12px]" style={{ color: BP.textMuted }}>
                Set {current.setNumber} of {current.totalSets}
                {current.rirTarget != null ? <> · RIR {current.rirTarget}</> : null}
              </span>
            </div>
          </div>
          <div className="pt-1">
            <StepDots total={totalInGroup} done={doneInGroup} />
          </div>
        </div>
      </div>

      <div className="px-5 text-center">
        <Eyebrow>
          {current.percentage ? `${current.kind === "main" ? "Top" : "Working"} set · ${current.percentage}% TM` : "Working set"}
        </Eyebrow>
        {current.requiresWeightInput ? (
          <div
            className="mt-2"
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: BP.textMuted,
              letterSpacing: "-0.02em",
            }}
            data-testid="prescribed-weight"
          >
            Enter weight below
          </div>
        ) : (
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
        )}
        {current.isAmrap ? (
          <div className="mt-2.5 text-sm" style={{ color: BP.textMuted }}>
            Top set · 1 × max reps
          </div>
        ) : null}
        {showTempoChip ? (
          <div className="mt-3 flex justify-center">
            <TempoChip tempo={current.tempo} onTap={() => setTempoSheet(current.tempo)} />
          </div>
        ) : null}
      </div>

      {/* Bench AMRAP → preview what each rep bracket does to TM, before the set */}
      {current.isAmrap && current.exerciseName === "Bench Press" && benchTm != null ? (
        <AmrapTmPreview
          currentTm={benchTm}
          reps={reps}
          units={units}
          amrapPercentage={current.percentage ?? 80}
        />
      ) : null}

      {/* Plate calc */}
      {showPlateCalc ? (
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
                <Eyebrow>Plates · {barWeight(units)} {units} bar</Eyebrow>
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

      {/* Weight row */}
      {current.requiresWeightInput ? (
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
            Weight used
            {current.equipment === "bodyweight" ? (
              <span style={{ marginLeft: 6, color: BP.textFaint, fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>
                (added load · 0 = bodyweight only)
              </span>
            ) : null}
          </div>
          <WeightInput
            value={weightOverride}
            onChange={setWeightOverride}
            placeholder={current.last ? String(current.last.weight) : "0"}
          />
          {current.last ? (
            <div className="text-[12px] mt-1.5 ml-1" style={{ color: BP.textFaint }}>
              Last: <Mono>{current.last.weight}</Mono> lb × <Mono>{current.last.reps}</Mono>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="px-5 pt-3 flex items-center justify-between">
          <span className="text-[13px]" style={{ color: BP.textMuted }}>
            Weight: <Mono style={{ color: BP.text, fontWeight: 600 }}>{weightDisplay ?? "—"} lb</Mono>
          </span>
          <WeightOverride value={weightOverride} fallback={current.weightPrescribed} onChange={setWeightOverride} />
        </div>
      )}

      <div className="px-5 pt-3">
        <button
          onClick={() => setNoteEditing(true)}
          data-testid="exercise-note-toggle"
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 12px",
            background: BP.surface,
            border: `1px solid ${BP.borderSoft}`,
            borderRadius: 12,
            color: currentNote ? BP.text : BP.textMuted,
            fontSize: 13,
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          <svg width={14} height={14} viewBox="0 0 14 14" fill="none" aria-hidden>
            <path d="M2 2h10v8H6l-4 3V2z" stroke="currentColor" strokeWidth={1.4} strokeLinejoin="round" />
          </svg>
          <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {currentNote ?? "Add note for this exercise"}
          </span>
        </button>
      </div>

      <div className="px-5 pt-3">
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
          {getLogged(current)
            ? "Update set"
            : current.isAmrap
              ? "Log AMRAP set"
              : "Log set"}
        </BigButton>

        <div className="mt-2 flex gap-2">
          <button
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            disabled={idx === 0}
            data-testid="prev-set"
            style={{
              flex: 1,
              height: 44,
              background: "transparent",
              color: idx === 0 ? BP.textFaint : BP.textMuted,
              border: `1px solid ${BP.borderSoft}`,
              borderRadius: 10,
              cursor: idx === 0 ? "default" : "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            ← Previous
          </button>
          <button
            onClick={() => {
              if (getLogged(current)) {
                setIdx((i) => Math.min(rows.length - 1, i + 1));
                return;
              }
              if (!confirm("Skip this set?")) return;
              setIdx((i) => Math.min(rows.length - 1, i + 1));
            }}
            data-testid="skip-set"
            style={{
              flex: 1,
              height: 44,
              background: "transparent",
              color: BP.textMuted,
              border: `1px solid ${BP.borderSoft}`,
              borderRadius: 10,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {getLogged(current) ? "Next →" : "Skip this set"}
          </button>
        </div>
      </div>

      {/* Rest banner */}
      {restRunning && !showFullTimer ? (
        <RestBanner
          remaining={restRemaining}
          total={restTotal}
          onSkip={clearRest}
          onTap={() => setShowFullTimer(true)}
        />
      ) : null}
      {showFullTimer ? (
        <FullTimerOverlay
          remaining={restRemaining}
          total={restTotal}
          nextRow={rows[idx]}
          onClose={() => setShowFullTimer(false)}
          onAdd30={() => addRest(30)}
          onSkip={() => {
            clearRest();
            setShowFullTimer(false);
          }}
        />
      ) : null}

      {tempoSheet ? (
        <TempoSheet tempo={tempoSheet} onClose={() => setTempoSheet(null)} />
      ) : null}

      {noteEditing && current ? (
        <NoteSheet
          exerciseName={current.exerciseName}
          initial={currentNote}
          onClose={() => setNoteEditing(false)}
          onSave={async (next) => {
            const sessionExerciseId = current.sessionExerciseId;
            setLocalNotes((m) => ({ ...m, [sessionExerciseId]: next }));
            setNoteEditing(false);
            const r = await setSessionExerciseNotesAction({
              sessionExerciseId,
              notes: next,
            }).catch(() => ({ ok: false as const }));
            if (!r.ok) toast.error("Note save failed");
          }}
        />
      ) : null}

      {/* AMRAP bump modal */}
      {bumpData ? (
        <AMRAPBumpModal
          amrapReps={bumpData.amrapReps}
          amrapPercentage={bumpData.amrapPercentage}
          oldTm={bumpData.oldTm}
          newTm={bumpData.newTm}
          bump={bumpData.bump}
          reason={bumpData.reason}
          units={units}
          onApply={() => {
            // Don't write to the DB yet — record intent for the session save.
            setPendingBump({
              liftName: "bench_press",
              amrapReps: bumpData.amrapReps,
              amrapPercentage: bumpData.amrapPercentage,
              applied: bumpData.bump > 0,
            });
            toast.success(
              bumpData.bump > 0
                ? `Bench TM → ${bumpData.newTm} ${units} on save`
                : "TM held",
            );
            setBumpData(null);
            advanceAfterLog();
          }}
          onHold={() => {
            setPendingBump({
              liftName: "bench_press",
              amrapReps: bumpData.amrapReps,
              amrapPercentage: bumpData.amrapPercentage,
              applied: false,
            });
            setBumpData(null);
            advanceAfterLog();
          }}
        />
      ) : null}

      {showPlan ? (
        <PlanSheet
          sessionId={sessionId}
          entries={sessionExercises}
          rows={rows}
          getLogged={getLogged}
          onJumpToSet={(targetIdx) => {
            setIdx(targetIdx);
            setShowPlan(false);
            clearRest();
          }}
          onClose={() => setShowPlan(false)}
          onSwap={(entry) => setSwapTarget(entry)}
        />
      ) : null}

      {showLast && (current.lastSession || current.last) ? (
        <LastSessionModal
          exerciseName={current.exerciseName}
          lastSession={current.lastSession}
          last={current.last}
          currentSetNumber={current.setNumber}
          onClose={() => setShowLast(false)}
        />
      ) : null}

      {showReview ? (
        <ReviewSheet
          sessionLabel={sessionLabel}
          elapsed={elapsedDisplay}
          entries={sessionExercises}
          rows={rows}
          getLogged={getLogged}
          onEditSet={(targetIdx) => {
            setIdx(targetIdx);
            setShowReview(false);
            clearRest();
          }}
          onClose={() => setShowReview(false)}
          onSubmit={async () => {
            await finish();
          }}
        />
      ) : null}

      {swapTarget ? (
        <ExerciseLibraryPicker
          exercises={library}
          excludeId={swapTarget.exerciseId}
          title={`Swap ${swapTarget.name}`}
          onClose={() => setSwapTarget(null)}
          onPick={async (picked) => {
            const r = await swapSessionExerciseAction({
              sessionExerciseId: swapTarget.id,
              newExerciseId: picked.id,
            });
            if (!r.ok) {
              toast.error(r.error ?? "Swap failed");
              return;
            }
            if (r.wasMainLift) {
              toast.success(`Swapped — TM bump disabled for this session`);
            } else {
              toast.success(`Swapped to ${picked.name}`);
            }
            setSwapTarget(null);
            setShowPlan(false);
            router.refresh();
          }}
        />
      ) : null}

      {/* End of workout button */}
      <div className="px-5 pt-2 mt-4 flex gap-2">
        <BigButton
          kind="ghost"
          height={48}
          style={{ flex: 1 }}
          onClick={() => {
            setRestEndsAt(null);
            try { localStorage.removeItem(restStorageKey); } catch {}
            setShowReview(true);
          }}
          data-testid="finish-workout"
        >
          Review & submit
        </BigButton>
        <BigButton
          kind="ghost"
          height={48}
          style={{ flex: 1 }}
          onClick={async () => {
            if (!confirm("End session early? Remaining exercises will be marked skipped.")) return;
            await endEarly();
          }}
          data-testid="end-early"
        >
          End early
        </BigButton>
      </div>
      <div className="px-5 pt-2 mt-2">
        <button
          onClick={async () => {
            if (
              !confirm(
                "Discard this workout? All logged sets will be permanently deleted. This cannot be undone.",
              )
            )
              return;
            await discard();
          }}
          data-testid="discard-workout"
          style={{
            width: "100%",
            height: 44,
            background: "transparent",
            border: "none",
            color: BP.textDim,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            textDecoration: "underline",
            textUnderlineOffset: 4,
          }}
        >
          Discard workout
        </button>
      </div>
    </main>
  );
}
