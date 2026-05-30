"use client";

import { useState } from "react";
import { BP, BigButton, Eyebrow, Mono, Pill } from "@/components/ui/primitives";
import type { SessionExerciseEntry, SetRow } from "../types";

function SummaryStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div
      style={{
        background: BP.surface,
        border: `1px solid ${BP.borderSoft}`,
        borderRadius: 12,
        padding: "10px 12px",
      }}
    >
      <Eyebrow>{label}</Eyebrow>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          marginTop: 2,
        }}
      >
        {value}
      </div>
      <Mono style={{ fontSize: 10, color: BP.textDim }}>{sub}</Mono>
    </div>
  );
}

export function ReviewSheet({
  sessionLabel,
  elapsed,
  entries,
  rows,
  getLogged,
  onEditSet,
  onClose,
  onSubmit,
}: {
  sessionLabel: string;
  elapsed: string;
  entries: SessionExerciseEntry[];
  rows: SetRow[];
  getLogged: (
    row: SetRow,
  ) => { repsCompleted: number; weightUsed: number; rir: number | null } | null;
  onEditSet: (idx: number) => void;
  onClose: () => void;
  onSubmit: () => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const sorted = [...entries].sort((a, b) => a.orderIndex - b.orderIndex);

  let loggedCount = 0;
  let skippedCount = 0;
  let totalVolume = 0;
  for (const r of rows) {
    const l = getLogged(r);
    if (l) {
      loggedCount += 1;
      totalVolume += (l.weightUsed ?? 0) * (l.repsCompleted ?? 0);
    } else {
      skippedCount += 1;
    }
  }

  return (
    <div
      data-testid="review-sheet"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 95,
        background: BP.bg,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "calc(env(safe-area-inset-top) + 14px) 18px 10px",
          borderBottom: `1px solid ${BP.borderSoft}`,
          background: BP.bg,
        }}
      >
        <button
          onClick={onClose}
          data-testid="review-close"
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            border: `1px solid ${BP.borderSoft}`,
            background: BP.surface,
            color: BP.textMuted,
            cursor: "pointer",
            fontSize: 18,
            lineHeight: 1,
          }}
        >
          ←
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Eyebrow>Review &amp; submit</Eyebrow>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              marginTop: 2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {sessionLabel.split("—")[0].trim()}
          </div>
        </div>
        <Mono style={{ fontSize: 13, color: BP.textDim }}>{elapsed}</Mono>
      </div>

      <div style={{ overflowY: "auto", flex: 1, padding: "14px 16px 140px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 8,
            marginBottom: 14,
          }}
        >
          <SummaryStat label="Logged" value={`${loggedCount}`} sub={`of ${rows.length} sets`} />
          <SummaryStat label="Skipped" value={`${skippedCount}`} sub="will be marked" />
          <SummaryStat label="Volume" value={`${Math.round(totalVolume).toLocaleString()}`} sub="lb · vol" />
        </div>

        <div className="flex flex-col gap-2">
          {sorted.map((e, i) => {
            const exerciseRows = rows
              .map((r, ridx) => ({ r, ridx }))
              .filter((x) => x.r.sessionExerciseId === e.id)
              .sort((a, b) => a.r.setNumber - b.r.setNumber);
            const exLogged = exerciseRows.filter((x) => getLogged(x.r) != null).length;
            const allDone = exLogged === exerciseRows.length && exerciseRows.length > 0;
            return (
              <div
                key={e.id}
                data-testid={`review-row-${e.id}`}
                style={{
                  background: BP.surface,
                  border: `1px solid ${BP.borderSoft}`,
                  borderRadius: 12,
                  padding: "12px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  opacity: exerciseRows.length === 0 ? 0.55 : 1,
                }}
              >
                <div className="flex items-center gap-2.5">
                  <Mono
                    style={{
                      width: 22,
                      color: BP.textDim,
                      fontSize: 12,
                      fontWeight: 700,
                      textAlign: "center",
                    }}
                  >
                    {i + 1}
                  </Mono>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="text-[14px] font-semibold truncate">{e.name}</div>
                      {e.isMainLift ? <Pill color={BP.textMuted}>main</Pill> : null}
                      {allDone ? <Pill color={BP.green}>done</Pill> : null}
                    </div>
                    <div className="text-[11px]" style={{ color: BP.textDim }}>
                      {exLogged}/{exerciseRows.length} sets logged
                    </div>
                  </div>
                </div>
                {exerciseRows.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {exerciseRows.map(({ r, ridx }) => {
                      const logged = getLogged(r);
                      return (
                        <button
                          key={`${r.sessionExerciseId}:${r.setNumber}`}
                          data-testid={`review-set-${r.sessionExerciseId}-${r.setNumber}`}
                          onClick={() => onEditSet(ridx)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            height: 30,
                            padding: "0 10px",
                            borderRadius: 8,
                            border: `1px solid ${logged ? "rgba(43,208,95,0.45)" : BP.borderSoft}`,
                            background: logged ? "rgba(43,208,95,0.10)" : BP.surface2,
                            color: logged ? BP.text : BP.textMuted,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                            fontFamily: "inherit",
                          }}
                        >
                          <span style={{ color: BP.textDim, fontSize: 11 }}>#{r.setNumber}</span>
                          {logged ? (
                            <Mono style={{ fontSize: 12, fontWeight: 700 }}>
                              {logged.weightUsed}×{logged.repsCompleted}
                            </Mono>
                          ) : (
                            <Mono style={{ fontSize: 12, color: BP.textDim }}>—</Mono>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "12px 16px calc(env(safe-area-inset-bottom, 0px) + 16px)",
          background: "linear-gradient(to top, #0a0a0a 70%, rgba(10,10,10,0))",
          borderTop: `0.5px solid ${BP.borderSoft}`,
        }}
      >
        <div className="mx-auto" style={{ maxWidth: 420 }}>
          <BigButton
            kind="primary"
            height={60}
            disabled={submitting}
            onClick={async () => {
              setSubmitting(true);
              try {
                await onSubmit();
              } finally {
                setSubmitting(false);
              }
            }}
            data-testid="submit-session"
          >
            {submitting ? "Saving…" : "Submit session"}
          </BigButton>
        </div>
      </div>
    </div>
  );
}
