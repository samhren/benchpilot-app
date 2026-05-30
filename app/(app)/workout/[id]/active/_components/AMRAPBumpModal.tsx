"use client";

import { BP, BigButton, Eyebrow, Mono, Pill } from "@/components/ui/primitives";

export function AMRAPBumpModal({
  amrapReps,
  amrapPercentage,
  oldTm,
  newTm,
  bump,
  reason,
  units,
  onApply,
  onHold,
}: {
  amrapReps: number;
  amrapPercentage: number;
  oldTm: number;
  newTm: number;
  bump: number;
  reason: string;
  units: "lb" | "kg";
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
          <Pill data-testid="bump-pill">{isHold ? "Hold TM" : `+${bump} ${units} bump`}</Pill>
          <Eyebrow>Bench TM</Eyebrow>
        </div>
        <div className="text-[24px] font-bold tracking-[-0.025em] leading-tight">
          You hit <Mono style={{ color: BP.accent }}>{amrapReps} reps</Mono> at {amrapPercentage}% TM
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
            <Mono style={{ fontSize: 11, color: BP.textDim }}>{units}</Mono>
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
            <Mono style={{ fontSize: 11, color: BP.textDim }}>{units}</Mono>
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
