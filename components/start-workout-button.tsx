"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BP, BigButton, Eyebrow, Mono } from "@/components/ui/primitives";

interface Props {
  programDayId: string;
}

export function StartWorkoutButton({ programDayId }: Props) {
  const router = useRouter();
  const [deload, setDeload] = useState(false);
  const [factor, setFactor] = useState(0.6);

  function go() {
    const qs = deload ? `?deload=${factor}` : "";
    router.push(`/workout/${programDayId}/active${qs}`);
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        style={{
          background: deload ? BP.accentSoft : BP.surface,
          border: `1px solid ${deload ? BP.accent : BP.borderSoft}`,
          borderRadius: 14,
          padding: "10px 14px",
          color: BP.text,
        }}
      >
        <button
          onClick={() => setDeload((d) => !d)}
          data-testid="deload-toggle"
          style={{
            width: "100%",
            background: "transparent",
            border: "none",
            color: BP.text,
            textAlign: "left",
            cursor: "pointer",
            padding: 0,
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <Eyebrow style={{ color: deload ? BP.accent : BP.textDim }}>Feeling bad?</Eyebrow>
              <div className="text-[13px] mt-0.5" style={{ color: BP.textMuted }}>
                {deload ? `Deload — ${Math.round(factor * 100)}% of TM` : "Tap to deload"}
              </div>
            </div>
            <Mono style={{ fontSize: 12, color: deload ? BP.accent : BP.textDim, fontWeight: 700 }}>
              {deload ? "ON" : "OFF"}
            </Mono>
          </div>
        </button>
        {deload ? (
          <div className="mt-3 flex items-center gap-2">
            {[0.5, 0.6, 0.7, 0.8].map((f) => (
              <button
                key={f}
                onClick={() => setFactor(f)}
                data-testid={`deload-${Math.round(f * 100)}`}
                style={{
                  flex: 1,
                  height: 36,
                  borderRadius: 8,
                  border: "none",
                  background: factor === f ? BP.accent : BP.surface2,
                  color: factor === f ? "#fff" : BP.textMuted,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {Math.round(f * 100)}%
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <BigButton
        kind="primary"
        height={64}
        onClick={go}
        data-testid="start-active"
        icon={
          <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
            <path d="M3 2l11 6-11 6V2z" fill="#fff" />
          </svg>
        }
      >
        {deload ? "Start deload session" : "Start this workout"}
      </BigButton>
    </div>
  );
}
