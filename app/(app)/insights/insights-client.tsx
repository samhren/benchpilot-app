"use client";

import { useMemo, useState } from "react";
import { BP, Card, Eyebrow, Mono, Pill } from "@/components/ui/primitives";
import type { MuscleInsight } from "@/lib/insights/muscle-model";
import { MUSCLE_MODEL_SOURCE } from "@/lib/insights/muscle-model";

type Tab = "fatigue" | "strength";

// Shared palette. Fatigue: cool (recovered) -> hot (cooked).
const C = {
  track: "#1c2026",
  grid: "#23272f",
  axis: "#5c616b",
  recovered: "#2f6dff",
  moderate: "#ff8a3a",
  high: "#ff3535",
  belowStd: "#ff4d4d",
  nearStd: "#ff8a3a",
  atStd: "#2f6dff",
  aboveStd: "#34d399",
} as const;

function fatigueColor(v: number): string {
  if (v >= 70) return C.high;
  if (v >= 40) return C.moderate;
  return C.recovered;
}

function fatigueWord(v: number): string {
  if (v >= 70) return "Cooked";
  if (v >= 40) return "Working";
  if (v >= 12) return "Fresh-ish";
  return "Recovered";
}

function strengthColor(v: number | null): string {
  if (v == null) return C.track;
  if (v >= 110) return C.aboveStd;
  if (v >= 90) return C.atStd;
  if (v >= 70) return C.nearStd;
  return C.belowStd;
}

function strengthWord(v: number | null): string {
  if (v == null) return "No data";
  if (v >= 110) return "Above standard";
  if (v >= 90) return "At standard";
  if (v >= 70) return "Approaching";
  return "Below standard";
}

export default function InsightsClient({
  insights,
  bodyWeight,
  age,
}: {
  insights: MuscleInsight[];
  bodyWeight: number | null;
  age: number | null;
}) {
  const [tab, setTab] = useState<Tab>("fatigue");

  const hasFatigue = insights.some((i) => i.fatigue > 0);
  const hasStrength = insights.some((i) => i.strengthScore != null);

  // Sort rows by the active metric, descending, so the chart reads top-down.
  const rows = useMemo(() => {
    const copy = insights.slice();
    if (tab === "fatigue") {
      copy.sort((a, b) => b.fatigue - a.fatigue);
    } else {
      copy.sort(
        (a, b) =>
          (b.strengthScore ?? -1) - (a.strengthScore ?? -1) || a.label.localeCompare(b.label),
      );
    }
    return copy;
  }, [insights, tab]);

  const top = rows[0];
  const empty = tab === "fatigue" ? !hasFatigue : !hasStrength;

  return (
    <div style={{ padding: "12px 20px 110px" }}>
      <Eyebrow style={{ paddingTop: 4 }}>Recovery &amp; Standards</Eyebrow>
      <div className="flex items-baseline justify-between" style={{ marginTop: 4, marginBottom: 18 }}>
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em" }}>Insights</div>
        <Mono style={{ fontSize: 11, color: BP.textDim }}>
          {bodyWeight ? `${Math.round(bodyWeight)} lb` : "set BW"} · {age ? `${age} yr` : "set age"}
        </Mono>
      </div>

      {/* Tab switch */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 4,
          background: BP.surface,
          padding: 4,
          borderRadius: 12,
          border: `1px solid ${BP.borderSoft}`,
          marginBottom: 12,
        }}
      >
        {(["fatigue", "strength"] as const).map((id) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              height: 38,
              borderRadius: 9,
              border: "none",
              background: tab === id ? BP.surface2 : "transparent",
              color: tab === id ? BP.text : BP.textMuted,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {id === "fatigue" ? "Fatigue" : "Strength"}
          </button>
        ))}
      </div>

      {/* Main chart */}
      <Card padding={16} style={{ borderRadius: 16 }}>
        <div className="flex items-start justify-between" style={{ marginBottom: 4 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em" }}>
              {tab === "fatigue" ? "Muscle fatigue" : "Relative strength"}
            </div>
            <div style={{ fontSize: 11, color: BP.textDim, marginTop: 2 }}>
              {tab === "fatigue"
                ? "Recovery-adjusted, 0 = fresh · 100 = just hammered"
                : "Best e1RM vs a bodyweight-scaled standard · 100 = on par"}
            </div>
          </div>
          {!empty && top ? (
            <Pill
              color={tab === "fatigue" ? fatigueColor(top.fatigue) : strengthColor(top.strengthScore)}
              style={{ flexShrink: 0 }}
            >
              {tab === "fatigue"
                ? `${top.label} ${top.fatigue}`
                : `${top.label} ${top.strengthScore ?? "—"}%`}
            </Pill>
          ) : null}
        </div>

        {empty ? (
          <EmptyState tab={tab} hasBodyWeight={bodyWeight != null} />
        ) : (
          <BarChart rows={rows} tab={tab} />
        )}

        <Legend tab={tab} />
      </Card>

      {/* Per-muscle detail list */}
      <div className="mt-4 grid gap-2">
        {rows.map((m) => (
          <DetailRow key={m.muscle} m={m} tab={tab} />
        ))}
      </div>

      <div className="text-[10px] mt-4 leading-relaxed" style={{ color: BP.textFaint }}>
        Effective sets &amp; muscle mapping: Free Exercise DB taxonomy. Strength standards: Strength
        Level and FitnessVolt, scaled to your bodyweight{age ? " and age" : ""}. Model version{" "}
        {MUSCLE_MODEL_SOURCE.updated}; data is checked into the app and never fetched during
        workouts.
      </div>
    </div>
  );
}

/* ----------------------------- Bar chart ----------------------------- */

function BarChart({ rows, tab }: { rows: MuscleInsight[]; tab: Tab }) {
  // Domain. Fatigue is a fixed 0-100 gauge. Strength is anchored at 100 (the
  // standard) and extends to fit the strongest lift so one big number doesn't
  // crush the rest, but never below 120 so the reference line has headroom.
  const maxStrength = Math.max(
    120,
    ...rows.map((r) => r.strengthScore ?? 0),
  );
  const domainMax = tab === "fatigue" ? 100 : Math.ceil(maxStrength / 20) * 20;
  const ticks =
    tab === "fatigue"
      ? [0, 25, 50, 75, 100]
      : Array.from({ length: domainMax / 20 + 1 }, (_, i) => i * 20);
  // Strength reference line sits at the standard (100).
  const refValue = tab === "strength" ? 100 : null;

  const labelW = 78; // px reserved for muscle labels
  const valueW = 40; // px reserved for the right-hand number
  const rowH = 30;
  const gap = 6;
  const top = 6;
  const bottom = 20; // axis tick labels
  const height = top + rows.length * (rowH + gap) - gap + bottom;

  return (
    <svg
      width="100%"
      viewBox={`0 0 320 ${height}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "block", marginTop: 12, overflow: "visible" }}
    >
      <defs>
        <clipPath id="bp-bar-clip">
          <rect x={labelW} y={0} width={320 - labelW - valueW} height={height} rx={3} />
        </clipPath>
      </defs>
      {(() => {
        const plotX = labelW;
        const plotW = 320 - labelW - valueW;
        const scale = (v: number) => plotX + (Math.min(v, domainMax) / domainMax) * plotW;
        const plotBottom = top + rows.length * (rowH + gap) - gap;

        return (
          <>
            {/* Gridlines + axis ticks */}
            {ticks.map((t) => {
              const x = scale(t);
              return (
                <g key={`grid-${t}`}>
                  <line
                    x1={x}
                    x2={x}
                    y1={top}
                    y2={plotBottom}
                    stroke={C.grid}
                    strokeWidth={1}
                    strokeDasharray={t === 0 ? undefined : "2 4"}
                  />
                  <text
                    x={x}
                    y={plotBottom + 14}
                    fill={C.axis}
                    fontSize={9}
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {t}
                    {tab === "strength" && t === domainMax ? "%" : ""}
                  </text>
                </g>
              );
            })}

            {/* Strength standard reference line */}
            {refValue != null ? (
              <g>
                <line
                  x1={scale(refValue)}
                  x2={scale(refValue)}
                  y1={top - 2}
                  y2={plotBottom + 2}
                  stroke={C.atStd}
                  strokeWidth={1.5}
                  strokeOpacity={0.7}
                />
                <text
                  x={scale(refValue)}
                  y={top - 4}
                  fill={C.atStd}
                  fontSize={8.5}
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  STD
                </text>
              </g>
            ) : null}

            {/* Bars */}
            {rows.map((m, i) => {
              const y = top + i * (rowH + gap);
              const v = tab === "fatigue" ? m.fatigue : m.strengthScore;
              const color =
                tab === "fatigue" ? fatigueColor(m.fatigue) : strengthColor(m.strengthScore);
              const barW = v == null ? 0 : Math.max(2, scale(v) - plotX);
              return (
                <g key={m.muscle}>
                  {/* label */}
                  <text
                    x={labelW - 8}
                    y={y + rowH / 2 + 3.5}
                    fill={BP.text}
                    fontSize={11.5}
                    fontWeight={600}
                    textAnchor="end"
                  >
                    {m.label}
                  </text>
                  {/* track */}
                  <rect
                    x={plotX}
                    y={y + 6}
                    width={plotW}
                    height={rowH - 12}
                    rx={3}
                    fill={C.track}
                  />
                  {/* value bar */}
                  {v == null ? (
                    <text
                      x={plotX + 6}
                      y={y + rowH / 2 + 3.5}
                      fill={C.axis}
                      fontSize={9.5}
                      fontFamily="monospace"
                    >
                      no data
                    </text>
                  ) : (
                    <rect
                      x={plotX}
                      y={y + 6}
                      width={barW}
                      height={rowH - 12}
                      rx={3}
                      fill={color}
                      clipPath="url(#bp-bar-clip)"
                    />
                  )}
                  {/* right value */}
                  {v != null ? (
                    <text
                      x={320 - 4}
                      y={y + rowH / 2 + 4}
                      fill={color}
                      fontSize={13}
                      fontWeight={800}
                      fontFamily="monospace"
                      textAnchor="end"
                    >
                      {v}
                      {tab === "strength" ? "%" : ""}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </>
        );
      })()}
    </svg>
  );
}

function Legend({ tab }: { tab: Tab }) {
  const items =
    tab === "fatigue"
      ? [
          { c: C.recovered, t: "Recovered <40" },
          { c: C.moderate, t: "Working 40-69" },
          { c: C.high, t: "Cooked 70+" },
        ]
      : [
          { c: C.belowStd, t: "Below <70" },
          { c: C.nearStd, t: "Near 70-89" },
          { c: C.atStd, t: "At 90-109" },
          { c: C.aboveStd, t: "Above 110+" },
        ];
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "6px 12px",
        marginTop: 14,
        paddingTop: 12,
        borderTop: `1px solid ${BP.borderSoft}`,
      }}
    >
      {items.map((it) => (
        <div key={it.t} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{ width: 9, height: 9, borderRadius: 3, background: it.c, flexShrink: 0 }}
          />
          <span style={{ fontSize: 10, color: BP.textDim, fontWeight: 500 }}>{it.t}</span>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ tab, hasBodyWeight }: { tab: Tab; hasBodyWeight: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "36px 12px 28px",
        gap: 8,
      }}
    >
      <div style={{ fontSize: 28, opacity: 0.5 }}>—</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: BP.textMuted }}>
        {tab === "fatigue" ? "No recent working sets" : "Nothing to compare yet"}
      </div>
      <div style={{ fontSize: 12, color: BP.textDim, maxWidth: 240, lineHeight: 1.5 }}>
        {tab === "fatigue"
          ? "Fatigue reflects working sets from the last few days. Log a session and it'll fill in here."
          : hasBodyWeight
            ? "Log a few working sets and your strength vs. standard will appear."
            : "Set your bodyweight in Settings so strength can be scaled to a standard."}
      </div>
    </div>
  );
}

/* --------------------------- Detail rows --------------------------- */

function DetailRow({ m, tab }: { m: MuscleInsight; tab: Tab }) {
  if (tab === "fatigue") {
    const color = fatigueColor(m.fatigue);
    return (
      <Card padding={14} style={{ borderRadius: 12 }}>
        <div className="flex items-center justify-between" style={{ gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div className="text-[15px] font-semibold">{m.label}</div>
            <div className="text-[11px] mt-0.5" style={{ color: BP.textDim }}>
              {m.weeklySets > 0
                ? `${m.weeklySets} effective sets · ${m.weeklyVolumeLb.toLocaleString()} lb · last 7d`
                : "No working sets in the last 7 days"}
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <Mono style={{ fontSize: 24, fontWeight: 800, color }}>{m.fatigue}</Mono>
            <div style={{ fontSize: 10, color, fontWeight: 600, marginTop: -2 }}>
              {fatigueWord(m.fatigue)}
            </div>
          </div>
        </div>
        <Bar value={m.fatigue} max={100} color={color} />
      </Card>
    );
  }

  const color = strengthColor(m.strengthScore);
  return (
    <Card padding={14} style={{ borderRadius: 12 }}>
      <div className="flex items-center justify-between" style={{ gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div className="text-[15px] font-semibold">{m.label}</div>
          <div className="text-[11px] mt-0.5 truncate" style={{ color: BP.textDim }}>
            {m.bestExercise
              ? `${m.bestExercise} · e1RM ${m.bestE1rm} vs ${m.standardE1rm} lb std`
              : "No comparable working sets"}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <Mono style={{ fontSize: 24, fontWeight: 800, color }}>
            {m.strengthScore ?? "—"}
            {m.strengthScore != null ? <span style={{ fontSize: 13 }}>%</span> : null}
          </Mono>
          <div style={{ fontSize: 10, color, fontWeight: 600, marginTop: -2 }}>
            {strengthWord(m.strengthScore)}
          </div>
        </div>
      </div>
      {/* Strength bar references the standard (100%) as the full-width mark,
          but lets above-standard overflow visually by capping at the track. */}
      <Bar value={m.strengthScore ?? 0} max={120} color={color} reference={100} />
    </Card>
  );
}

function Bar({
  value,
  max,
  color,
  reference,
}: {
  value: number;
  max: number;
  color: string;
  reference?: number;
}) {
  return (
    <div
      style={{
        position: "relative",
        height: 7,
        borderRadius: 4,
        background: C.track,
        marginTop: 10,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${Math.min(100, (value / max) * 100)}%`,
          background: color,
        }}
      />
      {reference != null ? (
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${(reference / max) * 100}%`,
            width: 1.5,
            background: BP.text,
            opacity: 0.55,
          }}
        />
      ) : null}
    </div>
  );
}
