"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BP, Eyebrow, Mono, Pill, StatCard } from "@/components/ui/primitives";
import { BarChart, TrendChart, type Bar, type TrendPoint } from "@/components/ui/charts";
import type { LiftStats, WeekBucket } from "@/lib/lift-stats";

type TabId = "bench_press" | "back_squat" | "all" | "history";

// Session-type → accent colour, mirroring the Program page.
const SESSION_COLORS: Record<string, string> = {
  upper_a: "#FF2F2F",
  upper_b: "#ff6b47",
  upper_c: "#ffaa3a",
  lower_a: "#3a8dff",
  lower_b: "#6e6cff",
  deload: "#888888",
  test: "#ffffff",
};

export interface ExerciseEntry {
  id: string;
  name: string;
  muscleGroup: string;
}

export interface ExerciseHistory {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string | null;
  stats: LiftStats;
}

export interface LiftSummary {
  name: string;
  stats: LiftStats;
}

export interface ProgramContext {
  week: number;
  totalWeeks: number;
  block: string;
  adherenceDone: number;
  adherenceTotal: number;
}

export interface SessionListItem {
  id: string;
  name: string;
  sessionType: string | null;
  completedAt: string;
  setCount: number;
}

export interface SessionSet {
  setNumber: number;
  weight: number;
  reps: number;
  rir: number | null;
  isAmrap: boolean;
  isWarmup: boolean;
}

export interface SessionDetail {
  id: string;
  name: string;
  sessionType: string | null;
  completedAt: string;
  notes: string | null;
  bodyWeightLb: number | null;
  exercises: Array<{ name: string; muscleGroup: string; sets: SessionSet[] }>;
}

interface Props {
  initial: string;
  lifts: LiftSummary[];
  program: ProgramContext | null;
  exerciseEntries: ExerciseEntry[];
  selectedExercise: ExerciseHistory | null;
  selectedExerciseId: string | null;
  sessionList: SessionListItem[];
  selectedSession: SessionDetail | null;
  selectedSessionId: string | null;
}

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "bench_press", label: "Bench" },
  { id: "back_squat", label: "Squat" },
  { id: "all", label: "All" },
  { id: "history", label: "History" },
];

const DAY_MS = 86_400_000;

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ageLabel(iso: string | null): string {
  if (!iso) return "Never";
  const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS));
  return days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
}

// ── Building blocks ────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 26, marginBottom: 10 }}>
      <Eyebrow>{children}</Eyebrow>
    </div>
  );
}

function CardShell({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: BP.surface,
        borderRadius: 16,
        border: `1px solid ${BP.borderSoft}`,
        padding: 16,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function e1rmPoints(stats: LiftStats): TrendPoint[] {
  return stats.e1rmSeries.map((p) => ({
    t: p.t,
    v: p.e1rm,
    label: fmtDate(p.date),
    sub: `${p.weight}×${p.reps}${p.isAmrap ? " AMRAP" : ""}`,
  }));
}

function volumeBars(weeks: WeekBucket[]): Bar[] {
  return weeks.map((w) => ({
    label: fmtDate(w.weekStart),
    value: w.volume,
    sub: `${w.sets} sets`,
  }));
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function LiftsClient({
  initial,
  lifts,
  program,
  exerciseEntries,
  selectedExercise,
  selectedExerciseId,
  sessionList,
  selectedSession,
  selectedSessionId,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>(() => {
    if (selectedSessionId) return "history";
    if (selectedExerciseId) return "all";
    return TABS.find((t) => t.id === initial)?.id ?? "bench_press";
  });
  const [search, setSearch] = useState("");

  const lift = useMemo(
    () => (tab === "all" ? undefined : lifts.find((l) => l.name === tab)),
    [lifts, tab],
  );

  return (
    <div style={{ padding: "12px 20px 110px" }}>
      <Eyebrow style={{ paddingTop: 4 }}>Progress</Eyebrow>
      <div className="flex items-baseline justify-between" style={{ marginTop: 4, marginBottom: 18 }}>
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em" }}>Lifts</div>
        {program ? (
          <Mono style={{ fontSize: 11, color: BP.textDim }}>
            Week {program.week} of {program.totalWeeks} · Block {program.block}
          </Mono>
        ) : null}
      </div>

      <div
        style={{
          display: "flex",
          gap: 4,
          background: BP.surface,
          padding: 4,
          borderRadius: 12,
          border: `1px solid ${BP.borderSoft}`,
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            data-testid={`tab-${t.id}`}
            onClick={() => {
              setTab(t.id);
              // Drop any open detail view (exercise / session) when switching.
              if (selectedExerciseId || selectedSessionId) {
                router.replace(`/lifts?l=${t.id}`, { scroll: false });
              }
            }}
            style={{
              flex: 1,
              height: 38,
              borderRadius: 9,
              border: "none",
              background: tab === t.id ? BP.surface2 : "transparent",
              color: tab === t.id ? BP.text : BP.textMuted,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: tab === t.id ? "0 1px 2px rgba(0,0,0,0.4)" : "none",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "all" ? (
        selectedExercise ? (
          <ExerciseDetail
            ex={selectedExercise}
            onBack={() => router.replace("/lifts?l=all", { scroll: false })}
          />
        ) : (
          <ExerciseBrowser
            entries={exerciseEntries}
            search={search}
            onSearch={setSearch}
            onPick={(id) => router.push(`/lifts?ex=${id}`, { scroll: false })}
          />
        )
      ) : null}

      {tab === "history" ? (
        selectedSession ? (
          <SessionDetailView
            session={selectedSession}
            onBack={() => router.replace("/lifts?l=history", { scroll: false })}
          />
        ) : (
          <HistoryList
            sessions={sessionList}
            onPick={(id) => router.push(`/lifts?session=${id}`, { scroll: false })}
          />
        )
      ) : null}

      {lift ? (
        <>
          <StrengthSection stats={lift.stats} />
          <VolumeSection stats={lift.stats} />
          <ConsistencySection stats={lift.stats} program={program} />
        </>
      ) : null}
    </div>
  );
}

// ── Strength ─────────────────────────────────────────────────────────────────

function StrengthSection({ stats }: { stats: LiftStats }) {
  const best = stats.bestSet;
  const points = e1rmPoints(stats);
  const trend =
    stats.currentE1rm != null && stats.startE1rm != null
      ? stats.currentE1rm - stats.startE1rm
      : null;

  return (
    <>
      <SectionLabel>Strength</SectionLabel>
      <CardShell>
        <div className="flex justify-between items-baseline">
          <Eyebrow>Estimated 1RM</Eyebrow>
          <Mono style={{ fontSize: 11, color: BP.textDim }}>Epley</Mono>
        </div>
        {best ? (
          <>
            <div className="flex items-baseline gap-2 mt-1.5">
              <Mono
                style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1 }}
                data-testid="estimated-1rm"
              >
                {best.e1rm}
              </Mono>
              <Mono style={{ fontSize: 14, color: BP.textDim, fontWeight: 500 }}>lb</Mono>
              {trend != null && trend !== 0 ? (
                <Mono
                  style={{
                    fontSize: 11,
                    color: trend > 0 ? BP.green : BP.textDim,
                    marginLeft: 4,
                  }}
                >
                  {trend > 0 ? "▲ +" : "▼ "}
                  {trend} since first session
                </Mono>
              ) : null}
            </div>
            {points.length >= 2 ? (
              <div style={{ marginTop: 10 }}>
                <TrendChart points={points} unit="lb" testId="e1rm-chart" />
                <Mono style={{ fontSize: 10, color: BP.textDim }}>
                  ● estimated 1RM per session
                </Mono>
              </div>
            ) : (
              <div className="text-[13px] mt-2" style={{ color: BP.textMuted }}>
                Log a couple more sessions to see the trend.
              </div>
            )}
            <div className="text-[13px] mt-3" style={{ color: BP.textMuted }}>
              Best set <Mono>{best.weight}</Mono> lb × <Mono>{best.reps}</Mono>
              {best.isAmrap ? " (AMRAP)" : ""} · <Mono>{fmtDate(best.completedAt)}</Mono>
            </div>
          </>
        ) : (
          <div className="text-sm mt-2" style={{ color: BP.textMuted }}>
            No logged sets yet. Finish a top set to see your projected max.
          </div>
        )}
      </CardShell>

      <RepPrStrip stats={stats} />
    </>
  );
}

function RepPrStrip({ stats }: { stats: LiftStats }) {
  // The headline rep maxes — heaviest weight hit for ≥1 / ≥3 / ≥5 reps.
  const shown = [1, 3, 5];
  const rows = shown.map((n) => stats.repPrs.find((r) => r.reps === n) ?? { reps: n, pr: null });
  if (rows.every((r) => !r.pr)) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 8 }}>
      {rows.map((row) => (
        <CardShell key={row.reps} style={{ padding: "12px 12px 14px" }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 0.6,
              color: BP.textMuted,
              textTransform: "uppercase",
            }}
          >
            {row.reps}RM
          </div>
          {row.pr ? (
            <>
              <Mono
                style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", marginTop: 2 }}
              >
                {row.pr.weight}
              </Mono>
              <Mono style={{ fontSize: 10, color: BP.textDim }}>
                ×{row.pr.reps} · {fmtDate(row.pr.completedAt)}
              </Mono>
            </>
          ) : (
            <Mono style={{ fontSize: 22, fontWeight: 800, color: BP.textDim, marginTop: 2 }}>—</Mono>
          )}
        </CardShell>
      ))}
    </div>
  );
}

// ── Volume ───────────────────────────────────────────────────────────────────

function VolumeSection({ stats }: { stats: LiftStats }) {
  const delta = stats.thisWeekVolume - stats.lastWeekVolume;
  const pct =
    stats.lastWeekVolume > 0 ? Math.round((delta / stats.lastWeekVolume) * 100) : null;
  const deltaLabel =
    stats.thisWeekVolume === 0
      ? "no sets yet this week"
      : pct != null
        ? `${pct >= 0 ? "▲ +" : "▼ "}${pct}% vs last week`
        : "first week logged";

  return (
    <>
      <SectionLabel>Volume</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <StatCard
          label="This week"
          value={stats.thisWeekVolume.toLocaleString()}
          unit="lb"
          sub={deltaLabel}
          accent={delta > 0 && pct != null ? BP.green : undefined}
        />
        <StatCard
          label="Avg / session"
          value={stats.avgSessionVolume.toLocaleString()}
          unit="lb"
          sub={`${stats.totalSessions} session${stats.totalSessions === 1 ? "" : "s"} total`}
        />
      </div>

      {stats.weeks.length >= 2 ? (
        <CardShell style={{ marginTop: 8 }}>
          <div className="flex justify-between items-baseline">
            <Eyebrow>Weekly tonnage</Eyebrow>
            <Mono style={{ fontSize: 11, color: BP.textDim }}>{stats.weeks.length} weeks</Mono>
          </div>
          <BarChart bars={volumeBars(stats.weeks)} unit="lb" testId="volume-chart" />
          <Mono style={{ fontSize: 10, color: BP.textDim, marginTop: 2, display: "block" }}>
            {stats.totalVolume.toLocaleString()} lb lifetime · {stats.totalSets} working sets
          </Mono>
        </CardShell>
      ) : stats.weeks.length === 1 ? (
        <CardShell style={{ marginTop: 8 }}>
          <Eyebrow>Weekly tonnage</Eyebrow>
          <div className="text-[13px] mt-2" style={{ color: BP.textMuted }}>
            One week logged so far — <Mono>{stats.weeks[0].volume.toLocaleString()}</Mono> lb.
          </div>
        </CardShell>
      ) : null}
    </>
  );
}

// ── Consistency ──────────────────────────────────────────────────────────────

function ConsistencySection({
  stats,
  program,
}: {
  stats: LiftStats;
  program: ProgramContext | null;
}) {
  return (
    <>
      <SectionLabel>Consistency</SectionLabel>
      <CardShell>
        <div className="flex justify-between items-start">
          <div>
            <Eyebrow>Last trained</Eyebrow>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                marginTop: 2,
              }}
            >
              {ageLabel(stats.lastTrainedAt)}
            </div>
          </div>
          {stats.streakWeeks > 0 ? (
            <Pill color={BP.green}>
              {stats.streakWeeks} wk streak
            </Pill>
          ) : (
            <Pill color={BP.textMuted}>no streak</Pill>
          )}
        </div>

        {stats.weeks.length >= 1 ? (
          <div style={{ marginTop: 14 }}>
            <FrequencyStrip weeks={stats.weeks} />
            <Mono style={{ fontSize: 10, color: BP.textDim, marginTop: 6, display: "block" }}>
              {stats.totalSessions} session{stats.totalSessions === 1 ? "" : "s"} across{" "}
              {stats.weeks.length} week{stats.weeks.length === 1 ? "" : "s"}
            </Mono>
          </div>
        ) : (
          <div className="text-[13px] mt-2" style={{ color: BP.textMuted }}>
            No sessions logged yet.
          </div>
        )}
      </CardShell>

      {program && program.adherenceTotal > 0 ? (
        <CardShell style={{ marginTop: 8 }}>
          <div className="flex justify-between items-baseline">
            <Eyebrow>Program adherence</Eyebrow>
            <Mono style={{ fontSize: 11, color: BP.textDim }}>
              {Math.round((program.adherenceDone / program.adherenceTotal) * 100)}%
            </Mono>
          </div>
          <div className="flex items-baseline gap-2" style={{ marginTop: 6 }}>
            <Mono style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em" }}>
              {program.adherenceDone}
            </Mono>
            <Mono style={{ fontSize: 13, color: BP.textDim }}>
              / {program.adherenceTotal} scheduled days done
            </Mono>
          </div>
          <RatioBar done={program.adherenceDone} total={program.adherenceTotal} />
        </CardShell>
      ) : null}
    </>
  );
}

// One cell per calendar week between the first and last trained week; gaps
// (weeks with no session) show as empty so missed weeks are visible.
function FrequencyStrip({ weeks }: { weeks: WeekBucket[] }) {
  const cells = useMemo(() => {
    if (weeks.length === 0) return [] as number[];
    const byKey = new Map(weeks.map((w) => [w.weekStart, w.sessions]));
    const start = new Date(weeks[0].weekStart + "T00:00:00Z");
    const end = new Date(weeks[weeks.length - 1].weekStart + "T00:00:00Z");
    const out: number[] = [];
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 7)) {
      out.push(byKey.get(d.toISOString().slice(0, 10)) ?? 0);
    }
    return out;
  }, [weeks]);

  return (
    <div style={{ display: "flex", gap: 3 }}>
      {cells.map((n, i) => (
        <div
          key={i}
          title={`${n} session${n === 1 ? "" : "s"}`}
          style={{
            flex: 1,
            height: 26,
            borderRadius: 4,
            background:
              n === 0
                ? BP.surface2
                : n === 1
                  ? "color-mix(in oklab, var(--bp-accent) 38%, transparent)"
                  : BP.accent,
          }}
        />
      ))}
    </div>
  );
}

function RatioBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (done / total) * 100) : 0;
  return (
    <div
      style={{
        marginTop: 10,
        height: 8,
        borderRadius: 4,
        background: BP.surface2,
        overflow: "hidden",
      }}
    >
      <div style={{ width: `${pct}%`, height: "100%", background: BP.accent }} />
    </div>
  );
}

// ── History (past sessions) ──────────────────────────────────────────────────

function HistoryList({
  sessions,
  onPick,
}: {
  sessions: SessionListItem[];
  onPick: (id: string) => void;
}) {
  // Group by month so a long history stays scannable.
  const groups = useMemo(() => {
    const out: Array<{ label: string; items: SessionListItem[] }> = [];
    for (const s of sessions) {
      const label = new Date(s.completedAt).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      });
      let g = out[out.length - 1];
      if (!g || g.label !== label) {
        g = { label, items: [] };
        out.push(g);
      }
      g.items.push(s);
    }
    return out;
  }, [sessions]);

  if (sessions.length === 0) {
    return (
      <div
        className="text-sm"
        style={{
          marginTop: 18,
          color: BP.textMuted,
          padding: 24,
          textAlign: "center",
          background: BP.surface,
          borderRadius: 12,
          border: `1px solid ${BP.borderSoft}`,
        }}
      >
        No completed workouts yet.
      </div>
    );
  }

  return (
    <div style={{ marginTop: 18 }}>
      {groups.map((g) => (
        <div key={g.label} style={{ marginBottom: 16 }}>
          <div
            className="px-1.5 pb-1.5"
            style={{
              fontSize: 11,
              color: BP.textDim,
              fontWeight: 600,
              letterSpacing: 0.6,
              textTransform: "uppercase",
            }}
          >
            {g.label}
          </div>
          <div
            style={{
              background: BP.surface,
              borderRadius: 14,
              border: `1px solid ${BP.borderSoft}`,
              overflow: "hidden",
            }}
          >
            {g.items.map((s, i) => (
              <button
                key={s.id}
                data-testid={`history-pick-${s.id}`}
                onClick={() => onPick(s.id)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "13px 14px",
                  background: "transparent",
                  border: "none",
                  borderBottom:
                    i < g.items.length - 1 ? `1px solid ${BP.borderSoft}` : "none",
                  color: BP.text,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    flexShrink: 0,
                    background: SESSION_COLORS[s.sessionType ?? ""] ?? BP.textDim,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{s.name}</div>
                  <Mono style={{ fontSize: 11, color: BP.textDim, marginTop: 2 }}>
                    {fmtDate(s.completedAt)} · {s.setCount} set{s.setCount === 1 ? "" : "s"}
                  </Mono>
                </div>
                <span style={{ fontSize: 16, color: BP.textDim }}>›</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SessionDetailView({
  session,
  onBack,
}: {
  session: SessionDetail;
  onBack: () => void;
}) {
  const when = new Date(session.completedAt);
  const totalSets = session.exercises.reduce((n, ex) => n + ex.sets.length, 0);
  const accent = SESSION_COLORS[session.sessionType ?? ""] ?? BP.textDim;

  return (
    <div style={{ marginTop: 18 }}>
      <button
        onClick={onBack}
        data-testid="session-detail-back"
        style={{
          height: 32,
          padding: "0 10px",
          background: BP.surface,
          border: `1px solid ${BP.borderSoft}`,
          borderRadius: 8,
          color: BP.textMuted,
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          marginBottom: 12,
        }}
      >
        ← All workouts
      </button>
      <Eyebrow>
        {when.toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
      </Eyebrow>
      <div className="flex items-center gap-2" style={{ marginTop: 2 }}>
        <div style={{ width: 9, height: 9, borderRadius: 5, background: accent }} />
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.025em" }}>
          {session.name}
        </div>
      </div>
      <div className="flex items-center gap-3 mt-1" style={{ color: BP.textDim, fontSize: 12 }}>
        <Mono>{session.exercises.length} exercises</Mono>
        <span>·</span>
        <Mono>{totalSets} sets</Mono>
        {session.bodyWeightLb ? (
          <>
            <span>·</span>
            <Mono>BW {session.bodyWeightLb} lb</Mono>
          </>
        ) : null}
      </div>

      {session.exercises.length === 0 ? (
        <CardShell style={{ marginTop: 16 }}>
          <div className="text-sm" style={{ color: BP.textMuted }}>
            No sets were logged in this session.
          </div>
        </CardShell>
      ) : (
        session.exercises.map((ex, i) => (
          <CardShell key={i} style={{ marginTop: i === 0 ? 16 : 8, padding: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                padding: "13px 14px 10px",
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600 }}>{ex.name}</div>
              <Mono style={{ fontSize: 10, color: BP.textDim, textTransform: "uppercase" }}>
                {ex.muscleGroup}
              </Mono>
            </div>
            {ex.sets.map((s, j) => (
              <div
                key={j}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 14px",
                  borderTop: `1px solid ${BP.borderSoft}`,
                }}
              >
                <Mono
                  style={{
                    width: 52,
                    fontSize: 11,
                    fontWeight: 600,
                    color: BP.textDim,
                  }}
                >
                  {s.isWarmup ? "Warm" : `Set ${s.setNumber}`}
                </Mono>
                <Mono style={{ fontSize: 15, fontWeight: 700, color: BP.text }}>
                  {s.weight}
                  <span style={{ color: BP.textDim, fontWeight: 500 }}> × {s.reps}</span>
                </Mono>
                <div style={{ flex: 1 }} />
                {s.isAmrap ? <Pill color={BP.accent}>AMRAP</Pill> : null}
                {s.rir != null ? (
                  <Mono style={{ fontSize: 11, color: BP.textDim }}>RIR {s.rir}</Mono>
                ) : null}
              </div>
            ))}
          </CardShell>
        ))
      )}

      {session.notes ? (
        <CardShell style={{ marginTop: 8 }}>
          <Eyebrow>Notes</Eyebrow>
          <div className="text-[13px] mt-1.5" style={{ color: BP.textMuted }}>
            {session.notes}
          </div>
        </CardShell>
      ) : null}
    </div>
  );
}

// ── Exercise browser / detail (All tab) ──────────────────────────────────────

function ExerciseBrowser({
  entries,
  search,
  onSearch,
  onPick,
}: {
  entries: ExerciseEntry[];
  search: string;
  onSearch: (v: string) => void;
  onPick: (id: string) => void;
}) {
  const q = search.trim().toLowerCase();
  const filtered = q
    ? entries.filter(
        (e) =>
          e.name.toLowerCase().includes(q) || e.muscleGroup.toLowerCase().includes(q),
      )
    : entries;

  const grouped = useMemo(() => {
    const map = new Map<string, ExerciseEntry[]>();
    for (const e of filtered) {
      const list = map.get(e.muscleGroup) ?? [];
      list.push(e);
      map.set(e.muscleGroup, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  return (
    <div style={{ marginTop: 18 }}>
      <input
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Search exercises…"
        data-testid="exercise-search"
        style={{
          width: "100%",
          height: 44,
          padding: "0 14px",
          background: BP.surface,
          border: `1px solid ${BP.borderSoft}`,
          borderRadius: 12,
          color: BP.text,
          fontSize: 14,
          outline: "none",
          marginBottom: 12,
        }}
      />
      {grouped.length === 0 ? (
        <div
          className="text-sm"
          style={{
            color: BP.textMuted,
            padding: 24,
            textAlign: "center",
            background: BP.surface,
            borderRadius: 12,
            border: `1px solid ${BP.borderSoft}`,
          }}
        >
          No matches.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {grouped.map(([group, items]) => (
            <div key={group}>
              <div
                className="px-1.5 pb-1.5"
                style={{
                  fontSize: 11,
                  color: BP.textDim,
                  fontWeight: 600,
                  letterSpacing: 0.6,
                  textTransform: "uppercase",
                }}
              >
                {group}
              </div>
              <div
                style={{
                  background: BP.surface,
                  borderRadius: 14,
                  border: `1px solid ${BP.borderSoft}`,
                  overflow: "hidden",
                }}
              >
                {items.map((e, i) => (
                  <button
                    key={e.id}
                    data-testid={`exercise-pick-${e.id}`}
                    onClick={() => onPick(e.id)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 14px",
                      background: "transparent",
                      border: "none",
                      borderBottom:
                        i < items.length - 1 ? `1px solid ${BP.borderSoft}` : "none",
                      color: BP.text,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{e.name}</span>
                    <span style={{ fontSize: 16, color: BP.textDim }}>›</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ExerciseDetail({ ex, onBack }: { ex: ExerciseHistory; onBack: () => void }) {
  const { stats } = ex;
  const points = e1rmPoints(stats);

  return (
    <div style={{ marginTop: 18 }}>
      <button
        onClick={onBack}
        data-testid="exercise-detail-back"
        style={{
          height: 32,
          padding: "0 10px",
          background: BP.surface,
          border: `1px solid ${BP.borderSoft}`,
          borderRadius: 8,
          color: BP.textMuted,
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          marginBottom: 12,
        }}
      >
        ← All exercises
      </button>
      <Eyebrow>{ex.muscleGroup}</Eyebrow>
      <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.025em", marginTop: 2 }}>
        {ex.name}
      </div>
      <div className="flex items-center gap-3 mt-1" style={{ color: BP.textDim, fontSize: 12 }}>
        <Mono>{stats.totalSets} working sets</Mono>
        <span>·</span>
        <Mono>last {ageLabel(stats.lastTrainedAt)}</Mono>
        {ex.equipment ? (
          <>
            <span>·</span>
            <Pill color={BP.textMuted}>{ex.equipment}</Pill>
          </>
        ) : null}
      </div>

      <CardShell style={{ marginTop: 18 }}>
        <div className="flex items-baseline justify-between">
          <Eyebrow>Estimated 1RM</Eyebrow>
          <Mono style={{ fontSize: 11, color: BP.textDim }}>
            {points.length} session{points.length === 1 ? "" : "s"}
          </Mono>
        </div>
        {points.length >= 2 ? (
          <TrendChart points={points} unit="lb" />
        ) : stats.bestSet ? (
          <div className="mt-3 text-sm" style={{ color: BP.textMuted }}>
            One session logged. Best:{" "}
            <Mono style={{ color: BP.text, fontWeight: 700 }}>
              {stats.bestSet.weight}×{stats.bestSet.reps}
            </Mono>{" "}
            (~{stats.bestSet.e1rm} lb e1RM)
          </div>
        ) : (
          <div className="mt-3 text-sm" style={{ color: BP.textMuted }}>
            No history yet.
          </div>
        )}
      </CardShell>

      {stats.weeks.length >= 2 ? (
        <CardShell style={{ marginTop: 8 }}>
          <Eyebrow>Weekly tonnage</Eyebrow>
          <BarChart bars={volumeBars(stats.weeks)} unit="lb" />
        </CardShell>
      ) : null}

      <SectionLabel>Rep PRs</SectionLabel>
      <div
        style={{
          background: BP.surface,
          borderRadius: 16,
          border: `1px solid ${BP.borderSoft}`,
          overflow: "hidden",
        }}
      >
        {stats.repPrs.map((row, i) => (
          <div
            key={row.reps}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "12px 14px",
              gap: 12,
              borderBottom:
                i < stats.repPrs.length - 1 ? `1px solid ${BP.borderSoft}` : "none",
            }}
          >
            <Mono style={{ width: 44, fontSize: 13, fontWeight: 700, color: BP.textDim }}>
              ≥ {row.reps}
            </Mono>
            {row.pr ? (
              <>
                <Mono
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    letterSpacing: "-0.02em",
                    color: BP.text,
                  }}
                >
                  {row.pr.weight}
                  <span style={{ fontSize: 11, color: BP.textDim, fontWeight: 500 }}>
                    {" "}
                    × {row.pr.reps}
                  </span>
                </Mono>
                <div style={{ flex: 1 }} />
                <Mono style={{ fontSize: 11, color: BP.textDim }}>
                  {fmtDate(row.pr.completedAt)}
                </Mono>
              </>
            ) : (
              <span className="text-[13px]" style={{ color: BP.textDim }}>
                —
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
