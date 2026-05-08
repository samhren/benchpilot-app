"use client";

import { useMemo, useState, useTransition } from "react";
import { BP, BigButton, Eyebrow, Mono } from "@/components/ui/primitives";
import { manualSetTmAction } from "@/app/actions";
import { toast } from "sonner";

type LiftName = "bench_press" | "back_squat" | "deadlift" | "overhead_press";

interface Props {
  initial: string;
  lifts: Array<{ name: string; currentOneRm: number | null; trainingMax: number | null }>;
  histories: Record<
    string,
    Array<{ trainingMax: number; effectiveFrom: string; reason: string; amrapReps: number | null; notes: string | null }>
  >;
}

const TABS: Array<{ id: LiftName; label: string }> = [
  { id: "bench_press", label: "Bench" },
  { id: "back_squat", label: "Squat" },
  { id: "deadlift", label: "Deadlift" },
];

export default function LiftsClient({ initial, lifts, histories }: Props) {
  const [tab, setTab] = useState<LiftName>((TABS.find((t) => t.id === initial)?.id) ?? "bench_press");
  const [editing, setEditing] = useState(false);

  const lift = useMemo(() => lifts.find((l) => l.name === tab), [lifts, tab]);
  const series = useMemo(() => {
    const h = histories[tab] ?? [];
    return h
      .slice()
      .reverse()
      .filter((r) => r.trainingMax > 0)
      .map((r) => r.trainingMax);
  }, [histories, tab]);
  const history = useMemo(() => (histories[tab] ?? []).filter((r) => r.reason !== "initial"), [histories, tab]);

  return (
    <div style={{ padding: "12px 20px 110px" }}>
      <Eyebrow style={{ paddingTop: 4 }}>Training maxes</Eyebrow>
      <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", marginTop: 4, marginBottom: 18 }}>
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

      <div style={{ marginTop: 22 }}>
        <Eyebrow>Current TM</Eyebrow>
        <div className="flex items-baseline gap-2 mt-1.5">
          <Mono
            style={{ fontSize: 64, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 0.95 }}
            data-testid="current-tm"
          >
            {lift?.trainingMax ?? "—"}
          </Mono>
          <Mono style={{ fontSize: 18, color: BP.textDim, fontWeight: 500 }}>lb</Mono>
        </div>
        {lift?.currentOneRm ? (
          <div className="text-sm mt-1" style={{ color: BP.textMuted }}>
            from 1RM <Mono>{lift.currentOneRm}</Mono> lb
          </div>
        ) : null}
      </div>

      {series.length >= 2 ? (
        <div
          style={{
            marginTop: 24,
            padding: "18px 16px 14px",
            background: BP.surface,
            borderRadius: 18,
            border: `1px solid ${BP.borderSoft}`,
          }}
        >
          <div className="flex justify-between items-baseline">
            <Eyebrow>{series.length} TM events</Eyebrow>
            <Mono style={{ fontSize: 11, color: BP.green }}>
              +{(series[series.length - 1] - series[0]).toFixed(0)} lb
            </Mono>
          </div>
          <TMChart data={series} />
        </div>
      ) : null}

      <div style={{ marginTop: 22 }}>
        <div className="flex justify-between items-center pl-0.5 pb-3">
          <Eyebrow>History</Eyebrow>
          <span className="font-mono text-[11px]" style={{ color: BP.textDim }}>
            {history.length} bumps
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
          {history.length === 0 ? (
            <div className="p-4 text-sm" style={{ color: BP.textMuted }}>
              No bumps yet.
            </div>
          ) : (
            history.map((h, i) => {
              const dt = new Date(h.effectiveFrom);
              const dateStr = dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "14px 16px",
                    borderBottom:
                      i < history.length - 1 ? `1px solid ${BP.borderSoft}` : "none",
                  }}
                >
                  <Mono style={{ fontSize: 14, fontWeight: 700, color: BP.accent, width: 56 }}>
                    {h.trainingMax} lb
                  </Mono>
                  <div style={{ flex: 1 }}>
                    <div className="text-[13px]" style={{ color: BP.text, fontWeight: 500 }}>
                      {h.notes ?? h.reason}
                    </div>
                    <Mono style={{ fontSize: 11, color: BP.textDim, marginTop: 2 }}>{dateStr}</Mono>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="mt-4">
        <BigButton kind="ghost" height={52} onClick={() => setEditing(true)} data-testid="manual-tm-btn">
          Manually adjust TM
        </BigButton>
      </div>

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
        <div style={{ width: 36, height: 4, borderRadius: 2, background: "#444", margin: "0 auto 18px" }} />
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
