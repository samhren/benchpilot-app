"use client";

import { BP, BigButton, Eyebrow, Mono } from "@/components/ui/primitives";
import type { SetRow } from "../types";
import { fmt } from "./format";

export function RestBanner({
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

export function FullTimerOverlay({
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
      <div
        className="px-5 flex justify-between items-center"
        style={{ paddingTop: "max(48px, calc(env(safe-area-inset-top) + 20px))" }}
      >
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
