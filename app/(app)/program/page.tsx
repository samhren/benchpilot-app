export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { dayStatus, workoutSessions, programDays } from "@/lib/db/schema";
import { eq, isNotNull, and } from "drizzle-orm";
import { getActiveProgram, getAllProgramDays, getSettings } from "@/lib/queries";
import { dayOfWeekInTz, getProgramProgress, isoDate, scheduledDateForDay } from "@/lib/program-state";
import { BP, Eyebrow, Mono } from "@/components/ui/primitives";
import { requireUserId } from "@/lib/auth";

const SESSION_COLORS: Record<string, string> = {
  upper_a: "#FF2F2F",
  upper_b: "#ff6b47",
  upper_c: "#ffaa3a",
  lower_a: "#3a8dff",
  lower_b: "#6e6cff",
  deload: "#888888",
  test: "#fff",
  rest: "",
};

const SESSION_SHORT: Record<string, string> = {
  upper_a: "U-A",
  upper_b: "U-B",
  upper_c: "U-C",
  lower_a: "L-A",
  lower_b: "L-B",
  deload: "DL",
  test: "TEST",
  rest: "",
};

const BLOCKS = [
  { name: "Block 1 · Foundation", range: "Weeks 1–4", weeks: [1, 2, 3, 4] },
  { name: "Block 2 · Build", range: "Weeks 5–8", weeks: [5, 6, 7, 8] },
  { name: "Block 3 · Intensify", range: "Weeks 9–12", weeks: [9, 10, 11, 12] },
  { name: "Deload", range: "Week 13", weeks: [13] },
  { name: "Test", range: "Week 14", weeks: [14] },
];

export default async function ProgramPage() {
  const userId = await requireUserId();
  const program = await getActiveProgram();
  if (!program) redirect("/settings");

  const all = await getAllProgramDays(program.id);
  const completed = await db
    .select({ pdId: workoutSessions.programDayId })
    .from(workoutSessions)
    .innerJoin(programDays, eq(workoutSessions.programDayId, programDays.id))
    .where(
      and(
        eq(workoutSessions.userId, userId),
        eq(programDays.programId, program.id),
        isNotNull(workoutSessions.completedAt),
      ),
    );
  const doneIds = new Set(completed.map((c) => c.pdId));
  const statuses = await db
    .select({ programDayId: dayStatus.programDayId, state: dayStatus.state, rescheduledTo: dayStatus.rescheduledTo })
    .from(dayStatus)
    .innerJoin(programDays, eq(dayStatus.programDayId, programDays.id))
    .where(and(eq(dayStatus.userId, userId), eq(programDays.programId, program.id)));
  const statusByDay = new Map(statuses.map((s) => [s.programDayId, s]));

  const settingsRow = await getSettings();
  const tz = settingsRow?.timezone ?? "UTC";
  const today = new Date();
  const progress = getProgramProgress(program.startDate, today, tz, program.totalWeeks);
  const currentWeek = progress.week;
  const currentDay = dayOfWeekInTz(today, tz);
  const todayIso = isoDate(today, tz);

  const byWeek: Record<number, typeof all> = {};
  for (const d of all) {
    if (!byWeek[d.weekNumber]) byWeek[d.weekNumber] = [];
    byWeek[d.weekNumber].push(d);
  }

  return (
    <div style={{ padding: "12px 20px 110px" }}>
      <Eyebrow style={{ paddingTop: 4 }}>14 weeks · 5/3/1 derived</Eyebrow>
      <div className="flex items-end justify-between mt-1 mb-2">
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em" }}>Program</div>
        <Mono style={{ fontSize: 12, color: BP.textMuted, marginBottom: 6 }}>
          Wk {currentWeek} of 14
        </Mono>
      </div>

      <div
        className="sticky z-10 grid gap-1.5 px-1 py-3 mb-2"
        style={{
          top: "env(safe-area-inset-top)",
          gridTemplateColumns: "32px repeat(7, 1fr)",
          background: BP.bg,
          borderBottom: `1px solid ${BP.borderSoft}`,
        }}
      >
        <div />
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <div
            key={i}
            style={{
              fontSize: 11,
              color: BP.textDim,
              fontWeight: 600,
              textAlign: "center",
              letterSpacing: 0.6,
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {BLOCKS.map((block) => (
        <div key={block.name}>
          <div className="px-1 pt-3 pb-2 flex justify-between items-baseline">
            <div className="text-[13px] font-bold tracking-[-0.01em]">{block.name}</div>
            <Mono style={{ fontSize: 11, color: BP.textDim }}>{block.range}</Mono>
          </div>
          {block.weeks.map((w) => {
            const days = (byWeek[w] ?? []).slice().sort((a, b) => a.dayOfWeek - b.dayOfWeek);
            const isCurrent = w === currentWeek;
            return (
              <div
                key={w}
                className="grid gap-1.5 py-1.5"
                style={{
                  gridTemplateColumns: "32px repeat(7, 1fr)",
                  borderLeft: isCurrent ? `2px solid ${BP.accent}` : "2px solid transparent",
                  paddingLeft: isCurrent ? 8 : 10,
                  marginLeft: -10,
                  background: isCurrent
                    ? "linear-gradient(90deg, rgba(255,47,47,0.06), transparent 60%)"
                    : "transparent",
                  borderRadius: 8,
                }}
              >
                <div
                  className="font-mono font-semibold flex items-center"
                  style={{
                    fontSize: 12,
                    color: isCurrent ? BP.accent : w < currentWeek ? BP.textDim : BP.textMuted,
                  }}
                >
                  {String(w).padStart(2, "0")}
                </div>
                {days.map((d) => (
                  (() => {
                    const ds = statusByDay.get(d.id);
                    const scheduled = scheduledDateForDay(program.startDate, d.weekNumber, d.dayOfWeek);
                    const isDone = doneIds.has(d.id) || ds?.state === "done";
                    const isSkipped = ds?.state === "skipped";
                    const isRescheduled = ds?.state === "rescheduled";
                    const isMissed =
                      d.sessionType !== "rest" &&
                      !isDone &&
                      !isSkipped &&
                      !isRescheduled &&
                      scheduled < todayIso;
                    return (
                      <DayChip
                        key={d.id}
                        sessionType={d.sessionType}
                        href={d.sessionType === "rest" || isSkipped ? null : `/workout/${d.id}`}
                        isToday={isCurrent && d.dayOfWeek === currentDay}
                        isDone={isDone}
                        isSkipped={isSkipped}
                        isRescheduled={isRescheduled}
                        isMissed={isMissed}
                      />
                    );
                  })()
                ))}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function DayChip({
  sessionType,
  href,
  isToday,
  isDone,
  isSkipped,
  isRescheduled,
  isMissed,
}: {
  sessionType: string;
  href: string | null;
  isToday: boolean;
  isDone: boolean;
  isSkipped: boolean;
  isRescheduled: boolean;
  isMissed: boolean;
}) {
  if (sessionType === "rest") {
    return (
      <div
        style={{
          height: 40,
          borderRadius: 8,
          background: "transparent",
          border: `1px dashed ${BP.borderSoft}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ width: 4, height: 4, borderRadius: 2, background: BP.textFaint }} />
      </div>
    );
  }
  const color = SESSION_COLORS[sessionType] || BP.textMuted;
  // A completed session is "done" first and foremost — only highlight today's
  // session while it's still outstanding.
  const highlight = isToday && !isDone && !isSkipped;
  const stateColor = isMissed ? "#ffaa3a" : isRescheduled ? "#3a8dff" : isSkipped ? BP.textDim : color;
  const inner = (
    <div
      style={{
        height: 40,
        borderRadius: 8,
        background: highlight ? color : isDone || isSkipped ? "rgba(255,255,255,0.04)" : BP.surface,
        border: `1px solid ${isDone || isSkipped || isRescheduled || isMissed ? stateColor + "66" : BP.borderSoft}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        boxShadow: highlight
          ? `0 0 0 3px rgba(255,47,47,0.18), 0 0 20px rgba(255,47,47,0.3)`
          : "none",
        cursor: href ? "pointer" : "default",
      }}
    >
      <Mono
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: highlight ? "#fff" : isDone || isSkipped ? BP.textDim : stateColor,
          opacity: isDone || isSkipped ? 0.7 : 1,
        }}
      >
        {SESSION_SHORT[sessionType]}
      </Mono>
      {isDone || isSkipped || isRescheduled || isMissed ? (
        <div
          style={{
            position: "absolute",
            top: 3,
            right: 3,
            minWidth: 5,
            height: 5,
            borderRadius: 3,
            background: stateColor,
          }}
        />
      ) : null}
      {isSkipped || isRescheduled || isMissed ? (
        <Mono
          style={{
            position: "absolute",
            bottom: 2,
            right: 4,
            fontSize: 8,
            color: stateColor,
            fontWeight: 800,
          }}
        >
          {isSkipped ? "S" : isRescheduled ? "R" : "!"}
        </Mono>
      ) : null}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
