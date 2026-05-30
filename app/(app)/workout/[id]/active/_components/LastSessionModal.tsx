"use client";

import { BP, BigButton, Eyebrow, Mono } from "@/components/ui/primitives";
import type { SetRow } from "../types";
import { relativeDateLabel } from "./format";

export function LastSessionModal({
  exerciseName,
  lastSession,
  last,
  currentSetNumber,
  onClose,
}: {
  exerciseName: string;
  lastSession: SetRow["lastSession"];
  last: SetRow["last"];
  currentSetNumber: number;
  onClose: () => void;
}) {
  const sets = lastSession?.sets ?? [];
  return (
    <div
      onClick={onClose}
      data-testid="last-session-modal"
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
          style={{ width: 40, height: 4, borderRadius: 2, background: BP.borderSoft, margin: "0 auto 14px" }}
        />
        <div className="flex items-baseline justify-between mb-3">
          <Eyebrow>Last time · {exerciseName}</Eyebrow>
          {lastSession ? (
            <span style={{ fontSize: 11, color: BP.textDim }}>{relativeDateLabel(lastSession.date)}</span>
          ) : null}
        </div>
        {sets.length > 0 ? (
          <div className="flex flex-col gap-1.5" data-testid="last-session">
            {sets.map((s) => {
              const isCurrent = s.setNumber === currentSetNumber;
              return (
                <div
                  key={s.setNumber}
                  data-testid={`last-session-set-${s.setNumber}`}
                  className="flex items-baseline justify-between"
                  style={{
                    fontSize: 14,
                    color: isCurrent ? BP.text : BP.textMuted,
                    fontWeight: isCurrent ? 700 : 500,
                  }}
                >
                  <span style={{ color: isCurrent ? BP.text : BP.textDim }}>Set {s.setNumber}</span>
                  <span>
                    <Mono style={{ color: "inherit", fontWeight: "inherit" }}>{s.reps}</Mono> reps @{" "}
                    <Mono style={{ color: "inherit", fontWeight: "inherit" }}>{s.weight}</Mono> lb
                  </span>
                </div>
              );
            })}
          </div>
        ) : last ? (
          <div style={{ fontSize: 14, color: BP.textMuted }} data-testid="last-time">
            <Mono style={{ color: BP.text, fontWeight: 700 }}>{last.reps}</Mono> reps @{" "}
            <Mono style={{ color: BP.text, fontWeight: 700 }}>{last.weight}</Mono> lb
          </div>
        ) : (
          <div style={{ fontSize: 14, color: BP.textMuted }}>No previous data for this exercise.</div>
        )}
        <BigButton kind="dark" height={48} onClick={onClose} style={{ marginTop: 18 }}>
          Got it
        </BigButton>
      </div>
    </div>
  );
}
