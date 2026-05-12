"use client";

import { useMemo, useState, useTransition } from "react";
import { BP, BigButton, Eyebrow, Mono } from "@/components/ui/primitives";
import { manualSetTmAction } from "@/app/actions";
import { toast } from "sonner";

type LiftName = "bench_press" | "back_squat";

export interface LiftSummary {
  name: string;
  currentOneRm: number | null;
  trainingMax: number | null;
  bestSet:
    | {
        weight: number;
        reps: number;
        e1RM: number;
        completedAt: string;
        isAmrap: boolean;
      }
    | null;
  lastTrainedAt: string | null;
  volumeSeries: Array<{ date: string; volume: number; topWeight: number }>;
  history: Array<{
    trainingMax: number;
    effectiveFrom: string;
    reason: string;
    amrapReps: number | null;
    notes: string | null;
  }>;
}

interface Props {
  initial: string;
  lifts: LiftSummary[];
}

const TABS: Array<{ id: LiftName; label: string }> = [
  { id: "bench_press", label: "Bench" },
  { id: "back_squat", label: "Squat" },
];

export default function LiftsClient({ initial, lifts }: Props) {
  const [tab, setTab] = useState<LiftName>(
    TABS.find((t) => t.id === initial)?.id ?? "bench_press",
  );
  const [editing, setEditing] = useState(false);

  const lift = useMemo(() => lifts.find((l) => l.name === tab), [lifts, tab]);

  const tmSeries = useMemo(() => {
    if (!lift) return [] as number[];
    return lift.history
      .slice()
      .reverse()
      .filter((r) => r.trainingMax > 0)
      .map((r) => r.trainingMax);
  }, [lift]);

  const visibleHistory = useMemo(
    () => (lift?.history ?? []).filter((r) => r.reason !== "initial"),
    [lift],
  );

  return (
    <div style={{ padding: "12px 20px 110px" }}>
      <Eyebrow style={{ paddingTop: 4 }}>Training maxes</Eyebrow>
      <div
        style={{
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: "-0.03em",
          marginTop: 4,
          marginBottom: 18,
        }}
      >
        Lifts
      </div>

      <div
        style={{
          display: "flex",
          gap: 4,
          background: BP.surface,
          padding: 4,
          borderRadius: 12,
          border: `1px solid ${BP.borderSoft}`,
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            data-testid={`tab-${t.id}`}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1,
              height: 38,
              borderRadius: 9,
              border: "none",
              background: tab === t.id ? BP.surface2 : "transparent",
              color: tab === t.id ? BP.text : BP.textMuted,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: tab === t.id ? "0 1px 2px rgba(0,0,0,0.4)" : "none",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {lift ? (
        <>
          <TmHeadline lift={lift} />

          <EstimatedOneRmCard best={lift.bestSet} trainingMax={lift.trainingMax} />

          <LastTrainedCard
            lastTrainedAt={lift.lastTrainedAt}
            series={lift.volumeSeries}
          />

          {tmSeries.length >= 2 ? (
            <div
              style={{
                marginTop: 22,
                padding: "18px 16px 14px",
                background: BP.surface,
                borderRadius: 18,
                border: `1px solid ${BP.borderSoft}`,
              }}
            >
              <div className="flex justify-between items-baseline">
                <Eyebrow>{tmSeries.length} TM events</Eyebrow>
                <Mono style={{ fontSize: 11, color: BP.green }}>
                  +{(tmSeries[tmSeries.length - 1] - tmSeries[0]).toFixed(0)} lb
                </Mono>
              </div>
              <TMChart data={tmSeries} />
            </div>
          ) : null}

          <div style={{ marginTop: 22 }}>
            <div className="flex justify-between items-center pl-0.5 pb-3">
              <Eyebrow>History</Eyebrow>
              <span className="font-mono text-[11px]" style={{ color: BP.textDim }}>
                {visibleHistory.length} bumps
              </span>
            </div>
            <div
              style={{
                background: BP.surface,
                borderRadius: 16,
                border: `1px solid ${BP.borderSoft}`,
                overflow: "hidden",
              }}
            >
              {visibleHistory.length === 0 ? (
                <div className="p-4 text-sm" style={{ color: BP.textMuted }}>
                  No history yet.
                </div>
              ) : (
                visibleHistory.map((h, i) => {
                  const dt = new Date(h.effectiveFrom);
                  const dateStr = dt.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  });
                  return (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        padding: "14px 16px",
                        borderBottom:
                          i < visibleHistory.length - 1
                            ? `1px solid ${BP.borderSoft}`
                            : "none",
                      }}
                    >
                      <Mono
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: BP.accent,
                          width: 56,
                        }}
                      >
                        {h.trainingMax} lb
                      </Mono>
                      <div style={{ flex: 1 }}>
                        <div className="text-[13px]" style={{ color: BP.text, fontWeight: 500 }}>
                          {h.notes ?? h.reason}
                        </div>
                        <Mono style={{ fontSize: 11, color: BP.textDim, marginTop: 2 }}>
                          {dateStr}
                        </Mono>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-4">
            <BigButton
              kind="ghost"
              height={52}
              onClick={() => setEditing(true)}
              data-testid="manual-tm-btn"
            >
              Manually adjust TM
            </BigButton>
          </div>
        </>
      ) : null}

      {editing && lift ? (
        <ManualTmDialog
          liftName={lift.name as LiftName}
          currentTm={lift.trainingMax ?? 0}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </div>
  );
}

function TmHeadline({ lift }: { lift: LiftSummary }) {
  return (
    <div style={{ marginTop: 22 }}>
      <Eyebrow>Current TM</Eyebrow>
      <div className="flex items-baseline gap-2 mt-1.5">
        <Mono
          style={{
            fontSize: 64,
            fontWeight: 800,
            letterSpacing: "-0.04em",
            lineHeight: 0.95,
          }}
          data-testid="current-tm"
        >
          {lift.trainingMax ?? "—"}
        </Mono>
        <Mono style={{ fontSize: 18, color: BP.textDim, fontWeight: 500 }}>lb</Mono>
      </div>
      {lift.currentOneRm ? (
        <div className="text-sm mt-1" style={{ color: BP.textMuted }}>
          from declared 1RM <Mono>{lift.currentOneRm}</Mono> lb · TM = 90%
        </div>
      ) : null}
    </div>
  );
}

function EstimatedOneRmCard({
  best,
  trainingMax,
}: {
  best: LiftSummary["bestSet"];
  trainingMax: number | null;
}) {
  if (!best) {
    return (
      <div
        style={{
          marginTop: 18,
          padding: 16,
          background: BP.surface,
          borderRadius: 16,
          border: `1px solid ${BP.borderSoft}`,
        }}
      >
        <Eyebrow>Estimated 1RM</Eyebrow>
        <div className="text-sm mt-2" style={{ color: BP.textMuted }}>
          No logged sets yet. Finish a top set to see your projected max.
        </div>
      </div>
    );
  }

  const dateStr = new Date(best.completedAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const tmGap = trainingMax ? best.e1RM - trainingMax : null;

  return (
    <div
      style={{
        marginTop: 18,
        padding: 16,
        background: BP.surface,
        borderRadius: 16,
        border: `1px solid ${BP.borderSoft}`,
      }}
    >
      <div className="flex justify-between items-baseline">
        <Eyebrow>Estimated 1RM</Eyebrow>
        <Mono style={{ fontSize: 11, color: BP.textDim }}>Epley</Mono>
      </div>
      <div className="flex items-baseline gap-2 mt-1.5">
        <Mono
          style={{
            fontSize: 36,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1,
          }}
          data-testid="estimated-1rm"
        >
          {best.e1RM}
        </Mono>
        <Mono style={{ fontSize: 14, color: BP.textDim, fontWeight: 500 }}>lb</Mono>
        {tmGap != null && tmGap !== 0 ? (
          <Mono
            style={{
              fontSize: 11,
              color: tmGap > 0 ? BP.green : BP.textDim,
              marginLeft: 4,
            }}
          >
            {tmGap > 0 ? "+" : ""}
            {tmGap} vs TM
          </Mono>
        ) : null}
      </div>
      <div className="text-[13px] mt-2" style={{ color: BP.textMuted }}>
        Best set <Mono>{best.weight}</Mono> lb × <Mono>{best.reps}</Mono>
        {best.isAmrap ? " (AMRAP)" : ""} · <Mono>{dateStr}</Mono>
      </div>
    </div>
  );
}

function LastTrainedCard({
  lastTrainedAt,
  series,
}: {
  lastTrainedAt: string | null;
  series: LiftSummary["volumeSeries"];
}) {
  if (!lastTrainedAt) {
    return (
      <div
        style={{
          marginTop: 14,
          padding: 16,
          background: BP.surface,
          borderRadius: 16,
          border: `1px solid ${BP.borderSoft}`,
        }}
      >
        <Eyebrow>Activity</Eyebrow>
        <div className="text-sm mt-2" style={{ color: BP.textMuted }}>
          Not trained yet.
        </div>
      </div>
    );
  }

  const last = new Date(lastTrainedAt);
  const ageDays = Math.max(0, Math.floor((Date.now() - last.getTime()) / 86_400_000));
  const ageLabel =
    ageDays === 0 ? "today" : ageDays === 1 ? "yesterday" : `${ageDays} days ago`;

  return (
    <div
      style={{
        marginTop: 14,
        padding: "16px 16px 12px",
        background: BP.surface,
        borderRadius: 16,
        border: `1px solid ${BP.borderSoft}`,
      }}
    >
      <div className="flex justify-between items-baseline">
        <Eyebrow>Last trained</Eyebrow>
        <Mono style={{ fontSize: 11, color: BP.textDim }}>
          {series.length} session{series.length === 1 ? "" : "s"}
        </Mono>
      </div>
      <div className="flex items-baseline gap-2 mt-1.5">
        <span
          style={{
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: BP.text,
          }}
        >
          {ageLabel}
        </span>
        <Mono style={{ fontSize: 12, color: BP.textDim }}>
          {last.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </Mono>
      </div>
      {series.length >= 2 ? (
        <VolumeBars data={series} />
      ) : (
        <div className="text-[12px] mt-2" style={{ color: BP.textDim }}>
          Log a couple more sessions to see volume trend.
        </div>
      )}
    </div>
  );
}

function VolumeBars({ data }: { data: LiftSummary["volumeSeries"] }) {
  const w = 295;
  const h = 56;
  const max = Math.max(...data.map((d) => d.volume), 1);
  const barW = Math.max(4, Math.floor(w / data.length) - 4);
  return (
    <svg
      width="100%"
      height={h + 18}
      viewBox={`0 0 ${w} ${h + 18}`}
      style={{ marginTop: 10, display: "block" }}
    >
      {data.map((d, i) => {
        const bh = Math.max(2, (d.volume / max) * h);
        const x = i * (barW + 4);
        const y = h - bh;
        const isLast = i === data.length - 1;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barW}
            height={bh}
            rx={2}
            fill={isLast ? "#FF2F2F" : "#3a3a3a"}
          />
        );
      })}
      <text
        x={0}
        y={h + 14}
        fontSize={10}
        fill="#666"
        style={{ fontFamily: "ui-monospace, monospace" }}
      >
        {data[0]
          ? new Date(data[0].date).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })
          : ""}
      </text>
      <text
        x={w}
        y={h + 14}
        fontSize={10}
        fill="#aaa"
        textAnchor="end"
        style={{ fontFamily: "ui-monospace, monospace" }}
      >
        {(data[data.length - 1]?.volume ?? 0).toLocaleString()} lb · vol
      </text>
    </svg>
  );
}

function ManualTmDialog({
  liftName,
  currentTm,
  onClose,
}: {
  liftName: LiftName;
  currentTm: number;
  onClose: () => void;
}) {
  const [tm, setTm] = useState(currentTm || 0);
  const [pending, start] = useTransition();
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(8px)",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          left: 16,
          right: 16,
          bottom: 36,
          maxWidth: 388,
          margin: "0 auto",
          background: "#1a1a1a",
          borderRadius: 24,
          padding: 24,
          border: `1px solid ${BP.border}`,
        }}
      >
        <div
          style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            background: "#444",
            margin: "0 auto 18px",
          }}
        />
        <Eyebrow>Adjust TM</Eyebrow>
        <div className="text-[22px] font-bold tracking-[-0.02em] mt-1.5">
          Manual {liftName.replace("_", " ")}
        </div>
        <div className="text-sm mt-2.5 leading-snug" style={{ color: BP.textMuted }}>
          BenchPilot bumps your TM automatically based on AMRAP performance. Manual edits skip the rule.
        </div>
        <div
          style={{
            marginTop: 18,
            padding: 16,
            background: "#0d0d0d",
            borderRadius: 14,
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <button
            onClick={() => setTm((v) => Math.max(0, v - 5))}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              border: `1px solid ${BP.border}`,
              background: "transparent",
              color: BP.text,
              fontSize: 20,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            −
          </button>
          <div style={{ flex: 1, textAlign: "center" }}>
            <Mono style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.03em" }}>{tm}</Mono>
            <Mono style={{ fontSize: 13, color: BP.textDim, marginLeft: 4 }}>lb</Mono>
          </div>
          <button
            onClick={() => setTm((v) => v + 5)}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              border: `1px solid ${BP.border}`,
              background: "transparent",
              color: BP.text,
              fontSize: 20,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            ＋
          </button>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <BigButton kind="dark" height={56} style={{ flex: 1 }} onClick={onClose}>
            Cancel
          </BigButton>
          <BigButton
            kind="primary"
            height={56}
            style={{ flex: 1.4 }}
            disabled={pending || tm <= 0}
            onClick={() =>
              start(async () => {
                const r = await manualSetTmAction({ liftName, trainingMax: tm });
                if (r.ok) {
                  toast.success("TM updated");
                  onClose();
                } else {
                  toast.error("Failed");
                }
              })
            }
          >
            Save TM
          </BigButton>
        </div>
      </div>
    </div>
  );
}

function TMChart({ data }: { data: number[] }) {
  const w = 295;
  const h = 110;
  const min = Math.min(...data) - 5;
  const max = Math.max(...data) + 5;
  const range = max - min || 1;
  const step = w / Math.max(1, data.length - 1);
  const pts = data.map((v, i) => [i * step, h - ((v - min) / range) * h] as const);
  const path = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
  const area = `${path} L${w},${h} L0,${h} Z`;
  return (
    <svg width="100%" height={h + 24} viewBox={`0 -8 ${w} ${h + 24}`} style={{ marginTop: 10 }}>
      <defs>
        <linearGradient id="tmgrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FF2F2F" stopOpacity="0.35" />
          <stop offset="1" stopColor="#FF2F2F" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#tmgrad)" />
      <path d={path} stroke="#FF2F2F" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={i === pts.length - 1 ? 4 : 2}
          fill={i === pts.length - 1 ? "#FF2F2F" : "#fff"}
          stroke="#FF2F2F"
          strokeWidth={i === pts.length - 1 ? 0 : 1}
        />
      ))}
    </svg>
  );
}
