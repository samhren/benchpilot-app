export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { workoutSessions, programDays, workoutSets } from "@/lib/db/schema";
import { desc, eq, isNotNull, sql } from "drizzle-orm";
import { BP, Eyebrow, Mono } from "@/components/ui/primitives";

export default async function HistoryPage() {
  const sessions = await db
    .select({
      session: workoutSessions,
      day: programDays,
      setCount: sql<number>`count(${workoutSets.id})`,
    })
    .from(workoutSessions)
    .leftJoin(programDays, eq(workoutSessions.programDayId, programDays.id))
    .leftJoin(workoutSets, eq(workoutSets.sessionId, workoutSessions.id))
    .where(isNotNull(workoutSessions.completedAt))
    .groupBy(workoutSessions.id, programDays.id)
    .orderBy(desc(workoutSessions.startedAt))
    .limit(50);

  return (
    <div style={{ padding: "12px 20px 110px" }}>
      <Eyebrow style={{ paddingTop: 4 }}>Past sessions</Eyebrow>
      <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", marginTop: 4, marginBottom: 18 }}>
        History
      </div>
      <div
        style={{
          background: BP.surface,
          borderRadius: 16,
          border: `1px solid ${BP.borderSoft}`,
          overflow: "hidden",
        }}
      >
        {sessions.length === 0 ? (
          <div className="p-4 text-sm" style={{ color: BP.textMuted }}>
            No completed sessions yet.
          </div>
        ) : (
          sessions.map((s, i) => (
            <div
              key={s.session.id}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "14px 16px",
                borderBottom: i < sessions.length - 1 ? `1px solid ${BP.borderSoft}` : "none",
              }}
            >
              <div style={{ flex: 1 }}>
                <div className="text-[14px] font-semibold">{s.day?.displayName ?? "Workout"}</div>
                <Mono style={{ fontSize: 11, color: BP.textDim, marginTop: 2 }}>
                  {(s.session.completedAt as unknown as Date)?.toLocaleString?.() ?? ""}
                </Mono>
              </div>
              <Mono style={{ fontSize: 13, color: BP.text, fontWeight: 600 }}>{Number(s.setCount)} sets</Mono>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
