"use client";

import { BP, Mono } from "@/components/ui/primitives";

export function RIRPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
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
