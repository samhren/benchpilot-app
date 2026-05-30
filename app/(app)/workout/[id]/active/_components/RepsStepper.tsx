"use client";

import { BP, Mono } from "@/components/ui/primitives";

export function RepsStepper({
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
