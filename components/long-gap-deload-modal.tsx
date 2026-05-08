"use client";

import { useState } from "react";
import { BP, BigButton, Eyebrow, Mono, Pill } from "@/components/ui/primitives";

interface Props {
  daysGone: number;
  programDayId: string;
}

export function LongGapDeloadModal({ daysGone, programDayId }: Props) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div
      data-testid="long-gap-modal"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "flex-end",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          margin: "0 auto",
          background: "#141414",
          borderRadius: "24px 24px 0 0",
          padding: 22,
          border: `1px solid ${BP.border}`,
        }}
      >
        <div style={{ width: 40, height: 4, borderRadius: 2, background: "#3a3a3a", margin: "0 auto 14px" }} />
        <div className="flex items-center gap-2 mb-2">
          <Pill>Welcome back</Pill>
          <Eyebrow>{daysGone}-day gap</Eyebrow>
        </div>
        <div className="text-[22px] font-bold tracking-[-0.025em]">
          Ease back in with a deload week?
        </div>
        <div className="text-sm mt-2" style={{ color: BP.textMuted }}>
          You haven't trained in {daysGone} days. Consider running today's session at 60% of your TM
          to wake up the pattern without trashing yourself. You can opt out per session.
        </div>

        <div className="flex flex-col gap-2 mt-5">
          <a href={`/workout/${programDayId}/active?deload=0.6`}>
            <BigButton kind="primary" height={56} data-testid="long-gap-accept">
              Start today at 60%
            </BigButton>
          </a>
          <BigButton kind="dark" height={48} onClick={() => setDismissed(true)} data-testid="long-gap-dismiss">
            Resume normal — I'm fine
          </BigButton>
        </div>
      </div>
    </div>
  );
}
