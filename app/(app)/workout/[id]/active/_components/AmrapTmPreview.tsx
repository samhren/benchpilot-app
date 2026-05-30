"use client";

import { BP, Eyebrow, Mono } from "@/components/ui/primitives";
import { applyAmrapBump, amrapTmProjections } from "@/lib/programming/amrap";

export function AmrapTmPreview({
  currentTm,
  reps,
  units,
  amrapPercentage,
}: {
  currentTm: number;
  reps: number | null;
  units: "lb" | "kg";
  amrapPercentage: number;
}) {
  const opts = { units, amrapPercentage };
  const projections = amrapTmProjections(currentTm, opts);
  const activeBump =
    reps != null && Number.isFinite(reps) ? applyAmrapBump(currentTm, reps, opts).bumpAmount : null;
  return (
    <div className="px-5 pt-5">
      <div
        data-testid="amrap-tm-preview"
        style={{
          background: BP.surface,
          border: `1px solid ${BP.borderSoft}`,
          borderRadius: 12,
          padding: "10px 12px",
        }}
      >
        <div className="flex items-baseline justify-between mb-1.5">
          <Eyebrow>If you hit…</Eyebrow>
          <span style={{ fontSize: 11, color: BP.textDim }}>Bench TM {currentTm} {units}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          {projections.map((p) => {
            const isActive = activeBump != null && p.result.bumpAmount === activeBump;
            return (
              <div
                key={p.repsLabel}
                data-testid={`amrap-tm-row-${p.result.bumpAmount}`}
                className="flex items-center justify-between"
                style={{
                  fontSize: 13,
                  padding: "5px 8px",
                  borderRadius: 8,
                  background: isActive ? BP.accentSoft : "transparent",
                  fontWeight: isActive ? 700 : 500,
                }}
              >
                <span style={{ color: isActive ? BP.text : BP.textDim }}>
                  <Mono style={{ color: "inherit", fontWeight: "inherit" }}>{p.repsLabel}</Mono> reps
                </span>
                <span className="flex items-center gap-2">
                  <span style={{ color: p.result.bumpAmount > 0 ? BP.accent : BP.textDim }}>
                    {p.result.bumpAmount > 0 ? `+${p.result.bumpAmount} ${units}` : "hold"}
                  </span>
                  <span aria-hidden style={{ color: BP.textFaint }}>
                    →
                  </span>
                  <Mono style={{ color: isActive ? BP.text : BP.textMuted, fontWeight: 700 }}>
                    {p.result.newTm}
                  </Mono>
                  <span style={{ color: BP.textDim, fontWeight: 500 }}>{units}</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
