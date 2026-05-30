"use client";

import { BP, BigButton } from "@/components/ui/primitives";
import { TEMPO_CHIP_LABEL, TEMPO_EXPLANATION, type Tempo } from "@/lib/programming/tempo";

export function TempoChip({ tempo, onTap }: { tempo: Tempo; onTap: () => void }) {
  if (tempo === "controlled") return null;
  const isPause = tempo === "pause_1s" || tempo === "pause_1s_first_rep";
  const dotColor = isPause ? "#ff2f2f" : "#cfcfcf";
  const bg = isPause ? "rgba(255,47,47,0.12)" : BP.surface2;
  const border = isPause ? "rgba(255,47,47,0.42)" : BP.borderSoft;
  const fg = isPause ? "#ff5252" : BP.text;
  return (
    <button
      type="button"
      onClick={onTap}
      data-testid="tempo-chip"
      data-tempo={tempo}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        height: 30,
        padding: "0 12px",
        borderRadius: 999,
        background: bg,
        border: `1px solid ${border}`,
        color: fg,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 0.3,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: dotColor,
          boxShadow: isPause ? "0 0 6px rgba(255,47,47,0.6)" : "none",
        }}
      />
      {TEMPO_CHIP_LABEL[tempo]}
    </button>
  );
}

export function TempoSheet({ tempo, onClose }: { tempo: Tempo; onClose: () => void }) {
  if (tempo === "controlled") return null;
  return (
    <div
      onClick={onClose}
      data-testid="tempo-sheet"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 60,
        display: "flex",
        alignItems: "flex-end",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: BP.surface,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          borderTop: `1px solid ${BP.borderSoft}`,
          width: "100%",
          maxWidth: 420,
          margin: "0 auto",
          padding: "18px 20px 28px",
        }}
      >
        <div
          style={{
            width: 40,
            height: 4,
            borderRadius: 2,
            background: BP.borderSoft,
            margin: "0 auto 14px",
          }}
        />
        <div style={{ fontSize: 16, fontWeight: 800, color: BP.text, marginBottom: 10 }}>
          {TEMPO_CHIP_LABEL[tempo]}
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.5, color: BP.textMuted }}>
          {TEMPO_EXPLANATION[tempo]}
        </div>
        <BigButton kind="dark" height={48} onClick={onClose} style={{ marginTop: 16 }}>
          Got it
        </BigButton>
      </div>
    </div>
  );
}
