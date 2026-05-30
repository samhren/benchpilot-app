"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BP, Eyebrow, Mono, Pill } from "@/components/ui/primitives";
import { reorderSessionExercisesAction } from "@/app/actions";
import type { SessionExerciseEntry, SetRow } from "../types";

export function PlanSheet({
  sessionId,
  entries,
  rows,
  getLogged,
  onJumpToSet,
  onClose,
  onSwap,
}: {
  sessionId: string;
  entries: SessionExerciseEntry[];
  rows: SetRow[];
  getLogged: (row: SetRow) => { repsCompleted: number; weightUsed: number; rir: number | null } | null;
  onJumpToSet: (idx: number) => void;
  onClose: () => void;
  onSwap: (entry: SessionExerciseEntry) => void;
}) {
  const router = useRouter();
  const sorted = [...entries].sort((a, b) => a.orderIndex - b.orderIndex);

  async function move(entryId: string, dir: -1 | 1) {
    const i = sorted.findIndex((e) => e.id === entryId);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= sorted.length) return;
    const next = [...sorted];
    [next[i], next[j]] = [next[j], next[i]];
    const r = await reorderSessionExercisesAction({
      sessionId,
      orderedIds: next.map((e) => e.id),
    });
    if (r.ok) {
      router.refresh();
    } else {
      toast.error("Reorder failed");
    }
  }

  return (
    <div
      data-testid="plan-sheet"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "flex-end",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 460,
          margin: "0 auto",
          background: "#141414",
          borderRadius: "24px 24px 0 0",
          padding: "16px 16px 22px",
          border: `1px solid ${BP.border}`,
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{ width: 40, height: 4, borderRadius: 2, background: "#3a3a3a", margin: "0 auto 12px" }}
        />
        <div className="flex items-center justify-between mb-3">
          <Eyebrow>Today's plan</Eyebrow>
          <button
            onClick={onClose}
            data-testid="plan-close"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: `1px solid ${BP.borderSoft}`,
              background: BP.surface,
              color: BP.textMuted,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto" style={{ flex: 1 }}>
          <div className="flex flex-col gap-2">
            {sorted.map((e, i) => {
              // All rows for this exercise, kept in their original idx order so
              // we can jump back to the matching set in the active workout.
              const exerciseRows = rows
                .map((r, ridx) => ({ r, ridx }))
                .filter((x) => x.r.sessionExerciseId === e.id)
                .sort((a, b) => a.r.setNumber - b.r.setNumber);
              return (
              <div
                key={e.id}
                data-testid={`plan-row-${e.id}`}
                style={{
                  background: BP.surface,
                  border: `1px solid ${BP.borderSoft}`,
                  borderRadius: 12,
                  padding: "12px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  opacity: e.status === "completed" ? 0.6 : 1,
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
                    {e.swappedFromExerciseId ? (
                      <Pill color={BP.accent}>swapped</Pill>
                    ) : null}
                    {e.isMainLift ? <Pill color={BP.textMuted}>main</Pill> : null}
                  </div>
                  <div className="text-[11px]" style={{ color: BP.textDim }}>
                    {e.muscleGroup} · {e.status}
                  </div>
                </div>
                <button
                  onClick={() => move(e.id, -1)}
                  disabled={i === 0 || e.status === "completed"}
                  data-testid={`plan-up-${e.id}`}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    border: `1px solid ${BP.borderSoft}`,
                    background: BP.surface2,
                    color: BP.text,
                    cursor: i === 0 || e.status === "completed" ? "not-allowed" : "pointer",
                    opacity: i === 0 || e.status === "completed" ? 0.4 : 1,
                  }}
                >
                  ↑
                </button>
                <button
                  onClick={() => move(e.id, 1)}
                  disabled={i === sorted.length - 1 || e.status === "completed"}
                  data-testid={`plan-down-${e.id}`}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    border: `1px solid ${BP.borderSoft}`,
                    background: BP.surface2,
                    color: BP.text,
                    cursor:
                      i === sorted.length - 1 || e.status === "completed"
                        ? "not-allowed"
                        : "pointer",
                    opacity:
                      i === sorted.length - 1 || e.status === "completed" ? 0.4 : 1,
                  }}
                >
                  ↓
                </button>
                <button
                  onClick={() => onSwap(e)}
                  disabled={e.status === "completed"}
                  data-testid={`plan-swap-${e.id}`}
                  style={{
                    height: 32,
                    padding: "0 10px",
                    borderRadius: 8,
                    border: "none",
                    background: BP.accent,
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: e.status === "completed" ? "not-allowed" : "pointer",
                    opacity: e.status === "completed" ? 0.4 : 1,
                  }}
                >
                  Swap
                </button>
                </div>
                {exerciseRows.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {exerciseRows.map(({ r, ridx }) => {
                      const logged = getLogged(r);
                      return (
                        <button
                          key={`${r.sessionExerciseId}:${r.setNumber}`}
                          data-testid={`plan-set-${r.sessionExerciseId}-${r.setNumber}`}
                          onClick={() => onJumpToSet(ridx)}
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
      </div>
    </div>
  );
}
