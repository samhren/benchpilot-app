"use client";

import { useState, useTransition } from "react";
import { BP } from "@/components/ui/primitives";
import { logBodyWeightAction } from "@/app/actions";
import { toast } from "sonner";

export function LogWeightButton() {
  const [open, setOpen] = useState(false);
  const [w, setW] = useState("");
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full font-semibold flex items-center justify-center gap-2 transition-transform active:scale-[0.99]"
        style={{
          height: 44,
          background: "transparent",
          border: `1px solid ${BP.border}`,
          borderRadius: 12,
          color: BP.text,
          fontSize: 14,
          cursor: "pointer",
        }}
        data-testid="log-weight-toggle"
      >
        <span style={{ fontSize: 18, lineHeight: 0, color: BP.textMuted }}>＋</span>
        Log weight
      </button>
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = parseFloat(w);
    if (!Number.isFinite(value) || value <= 0) return;
    start(async () => {
      const r = await logBodyWeightAction(value);
      if (r.ok) {
        toast.success(`Logged ${value} lb`);
        setOpen(false);
        setW("");
      } else {
        toast.error("Failed to log");
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        type="number"
        step="0.1"
        autoFocus
        value={w}
        onChange={(e) => setW(e.target.value)}
        placeholder="185.0"
        className="flex-1 font-mono text-base"
        style={{
          height: 44,
          padding: "0 14px",
          background: BP.surface2,
          border: `1px solid ${BP.border}`,
          borderRadius: 12,
          color: BP.text,
          outline: "none",
        }}
      />
      <button
        type="submit"
        disabled={pending || !w}
        className="font-semibold"
        style={{
          height: 44,
          padding: "0 18px",
          background: BP.accent,
          color: "#fff",
          border: "none",
          borderRadius: 12,
          fontSize: 14,
          cursor: "pointer",
        }}
      >
        Save
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        style={{
          height: 44,
          padding: "0 14px",
          background: "transparent",
          color: BP.textMuted,
          border: `1px solid ${BP.border}`,
          borderRadius: 12,
          fontSize: 14,
          cursor: "pointer",
        }}
      >
        Cancel
      </button>
    </form>
  );
}
