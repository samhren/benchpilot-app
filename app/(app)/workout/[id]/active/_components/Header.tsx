"use client";

import { BP, Eyebrow, Mono } from "@/components/ui/primitives";

export function Header({
  session,
  elapsed,
  onClose,
  onOpenPlan,
  onOpenLast,
}: {
  session: string;
  elapsed: string;
  onClose: () => void;
  onOpenPlan?: () => void;
  onOpenLast?: () => void;
}) {
  const [head, ...rest] = session.split("—");
  return (
    <div className="px-5 py-2 pb-3.5 flex items-center gap-3.5 pt-3">
      <button
        onClick={onClose}
        data-testid="close-active"
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          border: `1px solid ${BP.borderSoft}`,
          background: BP.surface,
          color: BP.textMuted,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width={14} height={14} viewBox="0 0 14 14">
          <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
        </svg>
      </button>
      <div className="flex-1 text-center">
        <Eyebrow>{head.trim()}</Eyebrow>
        <div className="text-sm font-semibold mt-px">{(rest.join("—") || "").trim()}</div>
      </div>
      {onOpenLast ? (
        <button
          onClick={onOpenLast}
          data-testid="open-last"
          style={{
            height: 32,
            padding: "0 10px",
            borderRadius: 8,
            border: `1px solid ${BP.borderSoft}`,
            background: BP.surface,
            color: BP.textMuted,
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Last
        </button>
      ) : null}
      {onOpenPlan ? (
        <button
          onClick={onOpenPlan}
          data-testid="open-plan"
          style={{
            height: 32,
            padding: "0 10px",
            borderRadius: 8,
            border: `1px solid ${BP.borderSoft}`,
            background: BP.surface,
            color: BP.textMuted,
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Plan
        </button>
      ) : null}
      <Mono
        style={{
          fontSize: 12,
          color: BP.textMuted,
          fontWeight: 600,
          background: BP.surface,
          padding: "6px 10px",
          borderRadius: 8,
          border: `1px solid ${BP.borderSoft}`,
        }}
      >
        {elapsed}
      </Mono>
    </div>
  );
}
