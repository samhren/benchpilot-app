"use client";

import { useEffect, useState } from "react";
import { BP } from "@/components/ui/primitives";

export function WeightInput({
  value,
  onChange,
  placeholder,
}: {
  value: number | null;
  onChange: (n: number | null) => void;
  placeholder?: string;
}) {
  const [v, setV] = useState(value != null ? String(value) : "");
  useEffect(() => {
    setV(value != null ? String(value) : "");
  }, [value]);
  function commit(next: string) {
    setV(next);
    if (next.trim() === "") {
      onChange(null);
      return;
    }
    const n = parseFloat(next);
    onChange(Number.isFinite(n) ? n : null);
  }
  function step(delta: number) {
    const base = value ?? 0;
    const next = Math.max(0, base + delta);
    commit(String(next));
  }
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        background: BP.surface,
        border: `1px solid ${BP.borderSoft}`,
        borderRadius: 14,
        padding: 6,
        width: "100%",
        boxSizing: "border-box",
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => step(-5)}
        data-testid="weight-minus"
        aria-label="-5 lb"
        style={{
          flex: "0 0 56px",
          height: 52,
          borderRadius: 10,
          background: BP.surface2,
          border: "none",
          color: BP.text,
          fontSize: 22,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        −
      </button>
      <input
        type="number"
        inputMode="decimal"
        value={v}
        onChange={(e) => commit(e.target.value)}
        placeholder={placeholder ?? "0"}
        data-testid="weight-input"
        className="font-mono no-spinner"
        style={{
          flex: "1 1 0",
          width: "100%",
          minWidth: 0,
          height: 52,
          margin: "0 8px",
          padding: "0 8px",
          textAlign: "center",
          fontSize: 28,
          fontWeight: 800,
          background: "transparent",
          border: "none",
          color: BP.text,
          outline: "none",
          letterSpacing: "-0.02em",
          boxSizing: "border-box",
          appearance: "textfield",
          MozAppearance: "textfield",
        }}
      />
      <button
        onClick={() => step(5)}
        data-testid="weight-plus"
        aria-label="+5 lb"
        style={{
          flex: "0 0 56px",
          height: 52,
          borderRadius: 10,
          background: BP.surface2,
          border: "none",
          color: BP.text,
          fontSize: 22,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        +
      </button>
    </div>
  );
}

export function WeightOverride({
  value,
  fallback,
  onChange,
}: {
  value: number | null;
  fallback: number | null;
  onChange: (n: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(String(value ?? fallback ?? ""));
  if (!editing) {
    return (
      <button
        onClick={() => {
          setV(String(value ?? fallback ?? ""));
          setEditing(true);
        }}
        style={{
          background: "transparent",
          border: "none",
          color: BP.accent,
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
        }}
        data-testid="weight-override"
      >
        Override
      </button>
    );
  }
  return (
    <div className="flex gap-1">
      <input
        type="number"
        value={v}
        onChange={(e) => setV(e.target.value)}
        className="font-mono text-sm"
        style={{
          width: 80,
          height: 32,
          padding: "0 8px",
          background: BP.surface2,
          border: `1px solid ${BP.border}`,
          borderRadius: 8,
          color: BP.text,
          outline: "none",
        }}
      />
      <button
        onClick={() => {
          const n = parseFloat(v);
          onChange(Number.isFinite(n) ? n : null);
          setEditing(false);
        }}
        style={{
          height: 32,
          padding: "0 10px",
          background: BP.accent,
          color: "#fff",
          border: "none",
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Set
      </button>
    </div>
  );
}
