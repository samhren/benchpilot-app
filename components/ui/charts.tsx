"use client";

// Dependency-free, tappable SVG charts for the Lifts page. Mobile-first:
// every data point has a finger-sized hit target and taps drive an inline
// readout rather than a hover tooltip.
import { useState } from "react";
import { BP, Mono } from "./primitives";

const W = 300;

export interface TrendPoint {
  t: number; // ms since epoch
  v: number;
  label: string; // date-ish caption shown in the readout
  sub?: string; // e.g. "215 × 3"
}

function shortDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * A line/area trend with an optional step series drawn behind it (used to lay
 * the prescribed Training Max under the realised e1RM trend). Tap any point to
 * pin the readout.
 */
export function TrendChart({
  points,
  steps,
  height = 132,
  unit = "lb",
  testId,
}: {
  points: TrendPoint[];
  steps?: Array<{ t: number; v: number }>;
  height?: number;
  unit?: string;
  testId?: string;
}) {
  const [sel, setSel] = useState(points.length - 1);
  if (points.length < 2) return null;

  const padTop = 10;
  const padBottom = 22;
  const plotH = height - padTop - padBottom;

  const ts = [...points.map((p) => p.t), ...(steps?.map((s) => s.t) ?? [])];
  const tMin = Math.min(...ts);
  const tMax = Math.max(...ts);
  const tRange = tMax - tMin || 1;

  const vs = [...points.map((p) => p.v), ...(steps?.map((s) => s.v) ?? [])];
  const vMin = Math.min(...vs);
  const vMax = Math.max(...vs);
  const vPad = (vMax - vMin) * 0.14 || 5;
  const lo = vMin - vPad;
  const hi = vMax + vPad;

  const x = (t: number) => ((t - tMin) / tRange) * W;
  const y = (v: number) => padTop + (1 - (v - lo) / (hi - lo)) * plotH;

  const xy = points.map((p) => [x(p.t), y(p.v)] as const);
  const line = xy.map(([px, py], i) => `${i === 0 ? "M" : "L"}${px},${py}`).join(" ");
  const area = `${line} L${W},${padTop + plotH} L0,${padTop + plotH} Z`;

  let stepPath = "";
  if (steps && steps.length > 0) {
    const s = [...steps].sort((a, b) => a.t - b.t);
    stepPath = `M${x(s[0].t)},${y(s[0].v)}`;
    for (let i = 1; i < s.length; i++) {
      stepPath += ` L${x(s[i].t)},${y(s[i - 1].v)} L${x(s[i].t)},${y(s[i].v)}`;
    }
    stepPath += ` L${W},${y(s[s.length - 1].v)}`;
  }

  const active = points[sel] ?? points[points.length - 1];

  return (
    <div data-testid={testId}>
      <div className="flex items-baseline justify-between" style={{ marginTop: 4 }}>
        <Mono style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em" }}>
          {Math.round(active.v)}
          <span style={{ fontSize: 12, color: BP.textDim, fontWeight: 500 }}> {unit}</span>
        </Mono>
        <div style={{ textAlign: "right" }}>
          <Mono style={{ fontSize: 11, color: BP.textMuted }}>{active.label}</Mono>
          {active.sub ? (
            <Mono style={{ fontSize: 11, color: BP.textDim, marginLeft: 6 }}>{active.sub}</Mono>
          ) : null}
        </div>
      </div>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${W} ${height}`}
        style={{ display: "block", marginTop: 6, overflow: "visible" }}
      >
        <defs>
          <linearGradient id="trendgrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={BP.accent} stopOpacity="0.32" />
            <stop offset="1" stopColor={BP.accent} stopOpacity="0" />
          </linearGradient>
        </defs>
        {stepPath ? (
          <path
            d={stepPath}
            fill="none"
            stroke={BP.textDim}
            strokeWidth={1.5}
            strokeDasharray="3 3"
            strokeOpacity={0.7}
          />
        ) : null}
        <path d={area} fill="url(#trendgrad)" />
        <path
          d={line}
          fill="none"
          stroke={BP.accent}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* vertical guide for the pinned point */}
        <line
          x1={xy[sel]?.[0] ?? 0}
          x2={xy[sel]?.[0] ?? 0}
          y1={padTop}
          y2={padTop + plotH}
          stroke={BP.accent}
          strokeWidth={1}
          strokeOpacity={0.35}
        />
        {xy.map(([px, py], i) => (
          <g key={i}>
            <circle
              cx={px}
              cy={py}
              r={i === sel ? 4.5 : 2.5}
              fill={i === sel ? BP.accent : "#fff"}
              stroke={BP.accent}
              strokeWidth={i === sel ? 0 : 1}
            />
            {/* finger-sized transparent hit target */}
            <circle
              cx={px}
              cy={py}
              r={18}
              fill="transparent"
              style={{ cursor: "pointer" }}
              onPointerDown={() => setSel(i)}
            />
          </g>
        ))}
        <text x={0} y={height - 6} fontSize={10} fill="#666" fontFamily="ui-monospace, monospace">
          {shortDate(points[0].t)}
        </text>
        <text
          x={W}
          y={height - 6}
          fontSize={10}
          fill="#aaa"
          textAnchor="end"
          fontFamily="ui-monospace, monospace"
        >
          {shortDate(points[points.length - 1].t)}
        </text>
      </svg>
    </div>
  );
}

export interface Bar {
  label: string; // x-axis caption / readout caption
  value: number;
  sub?: string;
}

/** Tappable bar chart — used for weekly tonnage. */
export function BarChart({
  bars,
  height = 72,
  unit = "lb",
  testId,
}: {
  bars: Bar[];
  height?: number;
  unit?: string;
  testId?: string;
}) {
  const [sel, setSel] = useState(bars.length - 1);
  if (bars.length === 0) return null;

  const max = Math.max(...bars.map((b) => b.value), 1);
  const gap = bars.length > 18 ? 2 : 4;
  const barW = Math.max(3, (W - gap * (bars.length - 1)) / bars.length);
  const active = bars[sel] ?? bars[bars.length - 1];

  return (
    <div data-testid={testId}>
      <div className="flex items-baseline justify-between" style={{ marginTop: 4 }}>
        <Mono style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em" }}>
          {active.value.toLocaleString()}
          <span style={{ fontSize: 12, color: BP.textDim, fontWeight: 500 }}> {unit}</span>
        </Mono>
        <Mono style={{ fontSize: 11, color: BP.textMuted }}>
          {active.label}
          {active.sub ? ` · ${active.sub}` : ""}
        </Mono>
      </div>
      <svg
        width="100%"
        height={height + 16}
        viewBox={`0 0 ${W} ${height + 16}`}
        style={{ display: "block", marginTop: 6 }}
      >
        {bars.map((b, i) => {
          const bh = Math.max(2, (b.value / max) * height);
          const bx = i * (barW + gap);
          const isSel = i === sel;
          return (
            <g key={i}>
              <rect
                x={bx}
                y={height - bh}
                width={barW}
                height={bh}
                rx={2}
                fill={isSel ? BP.accent : "#3a3a3a"}
              />
              <rect
                x={bx}
                y={0}
                width={barW}
                height={height}
                fill="transparent"
                style={{ cursor: "pointer" }}
                onPointerDown={() => setSel(i)}
              />
            </g>
          );
        })}
        <text x={0} y={height + 13} fontSize={10} fill="#666" fontFamily="ui-monospace, monospace">
          {bars[0].label}
        </text>
        <text
          x={W}
          y={height + 13}
          fontSize={10}
          fill="#aaa"
          textAnchor="end"
          fontFamily="ui-monospace, monospace"
        >
          {bars[bars.length - 1].label}
        </text>
      </svg>
    </div>
  );
}
