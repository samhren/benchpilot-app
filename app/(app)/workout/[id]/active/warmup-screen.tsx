"use client";

import { useEffect, useRef, useState } from "react";
import { BP, BigButton, Eyebrow, Mono, StepDots } from "@/components/ui/primitives";
import type { WarmupRoutine } from "@/lib/warmup";

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.max(0, sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function WarmupScreen({
  routine,
  sessionLabel,
  startedAt,
  onComplete,
  onSkip,
  beep,
}: {
  routine: WarmupRoutine;
  sessionLabel: string;
  startedAt: number;
  onComplete: () => void;
  onSkip: () => void;
  beep: () => void;
}) {
  const { items } = routine;
  const [idx, setIdx] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const beepedForRef = useRef<number | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const done = idx >= items.length;
  const current = done ? null : items[idx];

  function advance() {
    setEndsAt(null);
    setIdx((i) => i + 1);
  }

  function startTimer(sec: number) {
    setEndsAt(Date.now() + sec * 1000);
  }

  const running = endsAt !== null && endsAt > now;
  const remaining = endsAt ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : 0;

  // Auto-advance + beep when a timed step finishes.
  useEffect(() => {
    if (endsAt === null) return;
    if (now >= endsAt && beepedForRef.current !== endsAt) {
      beepedForRef.current = endsAt;
      beep();
      setEndsAt(null);
      setIdx((i) => i + 1);
    }
  }, [now, endsAt, beep]);

  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  const pct = current?.durationSec && endsAt
    ? Math.max(0, Math.min(1, (current.durationSec - remaining) / current.durationSec))
    : 0;

  return (
    <main style={{ background: BP.bg, minHeight: "100dvh" }} className="relative pb-10">
      {/* Header */}
      <div className="px-5 py-2 pb-3.5 flex items-center gap-3.5 pt-3">
        <div className="flex-1">
          <Eyebrow>Warm-up · {routine.focus}</Eyebrow>
          <div className="text-sm font-semibold mt-px" style={{ color: BP.text }}>
            {sessionLabel.split("—")[0]?.trim() || sessionLabel}
          </div>
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
          {fmt(elapsed)}
        </Mono>
      </div>

      <div className="px-5 mt-1 flex items-center justify-between">
        <StepDots total={items.length} done={Math.min(idx, items.length)} />
        <span className="text-[12px]" style={{ color: BP.textMuted }}>
          {Math.min(idx + (done ? 0 : 1), items.length)} of {items.length}
        </span>
      </div>

      {done ? (
        <div className="px-5 mt-10 flex flex-col items-center text-center">
          <div
            className="flex items-center justify-center"
            style={{
              width: 72,
              height: 72,
              borderRadius: 999,
              background: BP.accentSoft ?? BP.surface,
              marginBottom: 18,
            }}
          >
            <svg width={32} height={32} viewBox="0 0 18 18" fill="none">
              <path d="M3 9l4 4 8-9" stroke={BP.accent} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", color: BP.text }}>
            Warmed up
          </div>
          <div className="mt-1.5 text-sm" style={{ color: BP.textMuted }}>
            {fmt(elapsed)} of prep · let&apos;s lift
          </div>
          <BigButton
            kind="primary"
            height={60}
            onClick={onComplete}
            data-testid="warmup-start-lifting"
            style={{ marginTop: 28, width: "100%" }}
          >
            Start lifting
          </BigButton>
        </div>
      ) : current ? (
        <>
          {/* Current step */}
          <div className="px-5 mt-8 text-center">
            <div
              data-testid="warmup-current"
              style={{
                fontSize: 30,
                fontWeight: 800,
                letterSpacing: "-0.025em",
                color: BP.text,
                lineHeight: 1.1,
              }}
            >
              {current.label}
            </div>
            {current.detail ? (
              <div className="mt-2 text-[15px]" style={{ color: BP.textMuted }}>
                {current.detail}
              </div>
            ) : null}
          </div>

          {/* Timed step → countdown ring */}
          {current.durationSec ? (
            <div className="px-5 mt-8 flex flex-col items-center">
              <TimerRing
                remaining={endsAt ? remaining : current.durationSec}
                pct={running ? pct : 0}
              />
              {!running ? (
                <BigButton
                  kind="primary"
                  height={56}
                  onClick={() => startTimer(current.durationSec!)}
                  data-testid="warmup-start-timer"
                  style={{ marginTop: 24, width: "100%" }}
                >
                  Start {fmt(current.durationSec)}
                </BigButton>
              ) : (
                <button
                  onClick={() => setEndsAt(null)}
                  data-testid="warmup-pause-timer"
                  style={{
                    marginTop: 24,
                    width: "100%",
                    height: 56,
                    background: BP.surface,
                    border: `1px solid ${BP.borderSoft}`,
                    borderRadius: 14,
                    color: BP.text,
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Pause
                </button>
              )}
              <button
                onClick={advance}
                data-testid="warmup-next"
                style={{
                  marginTop: 10,
                  width: "100%",
                  height: 48,
                  background: "transparent",
                  border: `1px solid ${BP.borderSoft}`,
                  borderRadius: 12,
                  color: BP.textMuted,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {running ? "Skip ahead" : "Done · next"}
              </button>
            </div>
          ) : (
            <div className="px-5 mt-10">
              <BigButton
                kind="primary"
                height={64}
                onClick={advance}
                data-testid="warmup-next"
                icon={
                  <svg width={18} height={18} viewBox="0 0 18 18" fill="none">
                    <path d="M3 9l4 4 8-9" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                }
                style={{ width: "100%" }}
              >
                Done · next
              </BigButton>
            </div>
          )}

          {/* Up next preview */}
          {idx + 1 < items.length ? (
            <div className="px-5 mt-8">
              <Eyebrow>Up next</Eyebrow>
              <div className="mt-2 flex flex-col gap-1.5">
                {items.slice(idx + 1, idx + 4).map((it, i) => (
                  <div
                    key={i}
                    className="flex items-baseline justify-between"
                    style={{
                      fontSize: 14,
                      color: BP.textDim,
                      padding: "8px 12px",
                      background: BP.surface,
                      border: `1px solid ${BP.borderSoft}`,
                      borderRadius: 10,
                    }}
                  >
                    <span style={{ color: BP.textMuted, fontWeight: 600 }}>{it.label}</span>
                    {it.detail ? <span style={{ fontSize: 12 }}>{it.detail}</span> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {/* Skip the whole warm-up */}
      {!done ? (
        <div className="px-5 mt-10 text-center">
          <button
            onClick={onSkip}
            data-testid="warmup-skip-all"
            style={{
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
            Skip warm-up
          </button>
        </div>
      ) : null}
    </main>
  );
}

function TimerRing({ remaining, pct }: { remaining: number; pct: number }) {
  const size = 200;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={BP.surface2} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={BP.accent}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset 0.25s linear" }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Mono
          data-testid="warmup-timer-remaining"
          style={{ fontSize: 48, fontWeight: 800, letterSpacing: "-0.04em", color: BP.text }}
        >
          {fmt(remaining)}
        </Mono>
      </div>
    </div>
  );
}
