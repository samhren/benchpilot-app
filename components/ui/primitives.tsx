"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export const BP = {
  bg: "var(--bp-bg)",
  surface: "var(--bp-surface)",
  surface2: "var(--bp-surface2)",
  border: "var(--bp-border)",
  borderSoft: "var(--bp-border-soft)",
  text: "var(--bp-text)",
  textMuted: "var(--bp-text-muted)",
  textDim: "var(--bp-text-dim)",
  textFaint: "var(--bp-text-faint)",
  accent: "var(--bp-accent)",
  accentSoft: "var(--bp-accent-soft)",
  accentLine: "var(--bp-accent-line)",
  green: "var(--bp-green)",
  amber: "var(--bp-amber)",
} as const;

export function Mono({
  children,
  className,
  ...rest
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn("font-mono", className)} {...rest}>
      {children}
    </span>
  );
}

export function Eyebrow({
  children,
  className,
  style,
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(className)}
      style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 1.4,
        textTransform: "uppercase",
        color: BP.textDim,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Card({
  children,
  className,
  style,
  padding = 16,
}: { padding?: number } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(className)}
      style={{
        background: BP.surface,
        borderRadius: 18,
        padding,
        border: `1px solid ${BP.borderSoft}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Pill({
  children,
  color = BP.accent,
  bg,
  style,
  ...rest
}: { color?: string; bg?: string } & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      {...rest}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "4px 10px",
        borderRadius: 999,
        background: bg ?? `color-mix(in oklab, ${color} 14%, transparent)`,
        color,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.6,
        textTransform: "uppercase",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

type BigButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  kind?: "primary" | "dark" | "ghost";
  height?: number;
  icon?: React.ReactNode;
};

export function BigButton({
  children,
  kind = "primary",
  height = 64,
  icon,
  className,
  style,
  ...rest
}: BigButtonProps) {
  const styles =
    kind === "primary"
      ? { background: BP.accent, color: "#fff", border: "none" }
      : kind === "dark"
        ? { background: BP.surface2, color: "#fff", border: `1px solid ${BP.border}` }
        : { background: "transparent", color: BP.text, border: `1px solid ${BP.border}` };
  return (
    <button
      {...rest}
      className={cn("transition-transform active:scale-[0.985] disabled:opacity-60", className)}
      style={{
        width: "100%",
        height,
        borderRadius: 16,
        fontSize: 17,
        fontWeight: 700,
        letterSpacing: "-0.01em",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        cursor: "pointer",
        ...styles,
        ...style,
      }}
    >
      {icon}
      {children}
    </button>
  );
}

export function StatCard({
  label,
  value,
  unit = "lb",
  sub,
  accent,
  highlight,
  onClick,
  testId,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  sub?: React.ReactNode;
  accent?: string;
  highlight?: boolean;
  onClick?: () => void;
  testId?: string;
}) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className="text-left transition-transform active:scale-[0.99]"
      style={{
        background: BP.surface,
        borderRadius: 16,
        padding: "14px 16px 16px",
        border: highlight ? `1px solid ${BP.accentLine}` : `1px solid ${BP.borderSoft}`,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        cursor: onClick ? "pointer" : "default",
        ...(highlight
          ? {
              backgroundImage:
                "linear-gradient(180deg, rgba(255,47,47,0.08), rgba(255,47,47,0) 60%)",
            }
          : {}),
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 0.6,
          color: BP.textMuted,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 2 }}>
        <Mono
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: accent ?? BP.text,
            letterSpacing: "-0.03em",
          }}
        >
          {value}
        </Mono>
        <Mono style={{ fontSize: 13, fontWeight: 500, color: BP.textDim }}>{unit}</Mono>
      </div>
      {sub ? (
        <div style={{ fontSize: 11, color: BP.textDim, marginTop: 2 }}>{sub}</div>
      ) : null}
    </button>
  );
}

export function StepDots({
  total,
  done,
  accent = BP.accent,
}: {
  total: number;
  done: number;
  accent?: string;
}) {
  const out: React.ReactNode[] = [];
  for (let i = 0; i < total; i++) {
    const isDone = i < done;
    const isCurrent = i === done;
    out.push(
      <div
        key={i}
        style={{
          width: isCurrent ? 18 : 8,
          height: 8,
          borderRadius: 4,
          background: isDone || isCurrent ? accent : BP.borderSoft,
          transition: "all 0.2s",
        }}
      />,
    );
  }
  return <div style={{ display: "flex", gap: 6, alignItems: "center" }}>{out}</div>;
}

export function Sparkline({
  data,
  width = 180,
  height = 40,
  color = BP.text,
  accent = BP.accent,
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  accent?: string;
}) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const points = data
    .map((v, i) => `${i * step},${height - ((v - min) / range) * (height - 6) - 3}`)
    .join(" ");
  const last = data[data.length - 1];
  const lx = (data.length - 1) * step;
  const ly = height - ((last - min) / range) * (height - 6) - 3;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeOpacity={0.65}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lx} cy={ly} r={3} fill={accent} />
    </svg>
  );
}

export function Chevron({ size = 12, color = BP.textDim, dir = "right" as "right" | "down" | "left" }) {
  const d =
    dir === "right" ? "M1 1l5 5-5 5" : dir === "down" ? "M1 2l5 5 5-5" : "M7 1L2 6l5 5";
  return (
    <svg width={size} height={size * 1.5} viewBox="0 0 8 12" fill="none">
      <path
        d={d}
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export { calcPlates, platesSummary } from "@/lib/plates";
