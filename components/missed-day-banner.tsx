"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { markDayStatusAction } from "@/app/actions";
import { BP, BigButton, Eyebrow, Mono, Pill } from "@/components/ui/primitives";

interface MissedDay {
  programDayId: string;
  displayName: string;
  scheduledDate: string;
}

export function MissedDayBanner({ missed }: { missed: MissedDay[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [picking, setPicking] = useState<string | null>(null);
  const [pickDate, setPickDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  if (missed.length === 0) return null;
  const day = missed[0];

  function doNow() {
    router.push(`/workout/${day.programDayId}/active`);
  }

  function skip() {
    startTransition(async () => {
      await markDayStatusAction({ programDayId: day.programDayId, state: "skipped" });
      toast.success("Marked skipped");
      router.refresh();
    });
  }

  function commitReschedule() {
    startTransition(async () => {
      await markDayStatusAction({
        programDayId: day.programDayId,
        state: "rescheduled",
        rescheduledTo: pickDate,
      });
      toast.success(`Rescheduled to ${pickDate}`);
      setPicking(null);
      router.refresh();
    });
  }

  return (
    <div
      data-testid="missed-day-banner"
      style={{
        marginTop: 18,
        background: BP.surface,
        border: `1px solid ${BP.accent}40`,
        borderRadius: 18,
        padding: 16,
      }}
    >
      <div className="flex items-center gap-2">
        <Pill color={BP.accent} bg={BP.accentSoft}>
          Missed
        </Pill>
        <Mono style={{ fontSize: 11, color: BP.textDim, fontWeight: 600 }}>
          {day.scheduledDate}
        </Mono>
        {missed.length > 1 ? (
          <Mono style={{ fontSize: 11, color: BP.textDim, marginLeft: "auto" }}>
            +{missed.length - 1} more
          </Mono>
        ) : null}
      </div>
      <div className="text-[18px] font-bold mt-2 tracking-[-0.02em]">
        {day.displayName.split("—")[0].trim()}
      </div>
      <div className="text-sm" style={{ color: BP.textMuted }}>
        {day.displayName.includes("—") ? day.displayName.split("—")[1].trim() : "Was scheduled"}
      </div>

      {picking === day.programDayId ? (
        <div className="mt-3 flex gap-2 items-center">
          <input
            type="date"
            value={pickDate}
            onChange={(e) => setPickDate(e.target.value)}
            data-testid="reschedule-date"
            style={{
              flex: 1,
              height: 40,
              padding: "0 10px",
              background: BP.surface2,
              border: `1px solid ${BP.border}`,
              borderRadius: 8,
              color: BP.text,
            }}
          />
          <BigButton
            kind="primary"
            height={40}
            onClick={commitReschedule}
            data-testid="reschedule-confirm"
            style={{ width: 90 }}
            disabled={isPending}
          >
            OK
          </BigButton>
          <BigButton
            kind="dark"
            height={40}
            onClick={() => setPicking(null)}
            style={{ width: 70 }}
          >
            Cancel
          </BigButton>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <BigButton
            kind="primary"
            height={44}
            onClick={doNow}
            style={{ flex: 1 }}
            data-testid="missed-do-now"
          >
            Do now
          </BigButton>
          <BigButton
            kind="dark"
            height={44}
            onClick={() => setPicking(day.programDayId)}
            style={{ flex: 1 }}
            data-testid="missed-reschedule"
          >
            Reschedule
          </BigButton>
          <BigButton
            kind="ghost"
            height={44}
            onClick={skip}
            style={{ flex: 1 }}
            data-testid="missed-skip"
            disabled={isPending}
          >
            Skip
          </BigButton>
        </div>
      )}
    </div>
  );
}
