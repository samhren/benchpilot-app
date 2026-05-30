"use client";

import { useMemo, useState, type ReactNode } from "react";
import { BP, Card, Eyebrow, Mono, Pill } from "@/components/ui/primitives";
import {
  MUSCLE_MODEL_SOURCE,
  type RegionGroup,
  type RegionVolume,
  type StrengthGroupResult,
  type StrengthLevel,
} from "@/lib/insights/muscle-model";

type Tab = "strength" | "volume";

const LEVEL_COLOR: Record<StrengthLevel, string> = {
  Beginner: "#6b7280",
  Novice: "#3b82f6",
  Intermediate: "#2f6dff",
  Advanced: "#34d399",
  Elite: "#f5c451",
};

const STATUS = {
  untrained: { color: "#6b7280", word: "Untrained" },
  under: { color: "#ff8a3a", word: "Under MEV" },
  optimal: { color: "#34d399", word: "In range" },
  over: { color: "#ff4d4d", word: "Over MRV" },
} as const;

const TRACK = "#1c2026";
const GROUP_ORDER: RegionGroup[] = ["Push", "Shoulders", "Back", "Arms", "Legs", "Core"];

export default function InsightsClient({
  volume,
  strength,
  bodyWeight,
  age,
  coachSlot,
}: {
  volume: RegionVolume[];
  strength: StrengthGroupResult[];
  bodyWeight: number | null;
  age: number | null;
  coachSlot: ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("strength");

  // Scored lifts first (strongest on top), un-benchmarked lifts after.
  const strengthSorted = useMemo(() => {
    return strength.slice().sort((a, b) => {
      if (a.score == null && b.score == null) return 0;
      if (a.score == null) return 1;
      if (b.score == null) return -1;
      return b.score - a.score;
    });
  }, [strength]);

  const volumeByGroup = useMemo(() => {
    return GROUP_ORDER.map((g) => ({
      group: g,
      rows: volume.filter((v) => v.group === g),
    })).filter((g) => g.rows.length > 0);
  }, [volume]);

  const anyVolume = volume.some((v) => v.weeklySets > 0);

  return (
    <div style={{ padding: "12px 20px 110px" }}>
      <Eyebrow style={{ paddingTop: 4 }}>Strength &amp; Training Balance</Eyebrow>
      <div className="flex items-baseline justify-between" style={{ marginTop: 4, marginBottom: 18 }}>
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em" }}>Insights</div>
        <Mono style={{ fontSize: 11, color: BP.textDim }}>
          {bodyWeight ? `${Math.round(bodyWeight)} lb` : "set BW"} · {age ? `${age} yr` : "set age"}
        </Mono>
      </div>

      {coachSlot}

      {/* Tab switch */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 4,
          background: BP.surface,
          padding: 4,
          borderRadius: 12,
          border: `1px solid ${BP.borderSoft}`,
          marginBottom: 14,
        }}
      >
        {(["strength", "volume"] as const).map((id) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              height: 38,
              borderRadius: 9,
              border: "none",
              background: tab === id ? BP.surface2 : "transparent",
              color: tab === id ? BP.text : BP.textMuted,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {id === "strength" ? "Strength" : "Volume"}
          </button>
        ))}
      </div>

      {tab === "strength" ? (
        <StrengthView rows={strengthSorted} />
      ) : (
        <VolumeView groups={volumeByGroup} anyVolume={anyVolume} />
      )}

      <div className="text-[10px] mt-5 leading-relaxed" style={{ color: BP.textFaint }}>
        Strength: best e1RM (entered 1RM or logged sets) vs a bodyweight-scaled standard —
        compound lifts only; isolation work isn&apos;t graded for strength. Volume: hard sets over the
        last 7 days (direct = 1, indirect = ½) vs MEV/MRV landmarks. Standards are male-oriented and
        bodyweight{age ? "/age" : ""}-scaled. Model {MUSCLE_MODEL_SOURCE.updated}.
      </div>
    </div>
  );
}

/* ------------------------------ Strength ------------------------------ */

function StrengthView({ rows }: { rows: StrengthGroupResult[] }) {
  const DOMAIN = 200; // % scale; Elite is 175+
  return (
    <div className="grid gap-2">
      <div className="text-[12px] mb-1" style={{ color: BP.textDim }}>
        100% = a solid intermediate lift for your bodyweight. Bands: Novice · Intermediate ·
        Advanced · Elite.
      </div>
      {rows.map((r) => {
        const color = r.level ? LEVEL_COLOR[r.level] : BP.textFaint;
        const fillPct = r.score == null ? 0 : Math.min(100, (r.score / DOMAIN) * 100);
        const stdPct = (100 / DOMAIN) * 100; // reference mark at 100%
        return (
          <Card key={r.key} padding={14} style={{ borderRadius: 12 }}>
            <div className="flex items-center justify-between" style={{ gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div className="text-[15px] font-semibold">{r.label}</div>
                <div className="text-[11px] mt-0.5" style={{ color: BP.textDim }}>
                  {r.score != null ? (
                    <>
                      e1RM <Mono style={{ color: BP.textMuted }}>{r.e1rm}</Mono> vs{" "}
                      <Mono style={{ color: BP.textMuted }}>{r.standard}</Mono> lb std
                      {r.source === "1rm" ? " · from your 1RM" : " · from logged sets"}
                    </>
                  ) : (
                    r.hint
                  )}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                {r.score != null ? (
                  <>
                    <Mono style={{ fontSize: 24, fontWeight: 800, color }}>{r.score}<span style={{ fontSize: 13 }}>%</span></Mono>
                    <div style={{ fontSize: 10, color, fontWeight: 600, marginTop: -2 }}>{r.level}</div>
                  </>
                ) : (
                  <Mono style={{ fontSize: 18, fontWeight: 700, color: BP.textFaint }}>—</Mono>
                )}
              </div>
            </div>
            {/* bar with a reference mark at the 100% (intermediate) line */}
            <div
              style={{
                position: "relative",
                height: 7,
                borderRadius: 4,
                background: TRACK,
                marginTop: 10,
                overflow: "hidden",
              }}
            >
              <div style={{ height: "100%", width: `${fillPct}%`, background: color }} />
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: `${stdPct}%`,
                  width: 1.5,
                  background: BP.text,
                  opacity: 0.5,
                }}
              />
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* ------------------------------- Volume ------------------------------- */

function VolumeView({
  groups,
  anyVolume,
}: {
  groups: { group: RegionGroup; rows: RegionVolume[] }[];
  anyVolume: boolean;
}) {
  if (!anyVolume) {
    return (
      <Card padding={16} style={{ borderRadius: 16 }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            padding: "30px 12px",
            gap: 8,
          }}
        >
          <div style={{ fontSize: 28, opacity: 0.5 }}>—</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: BP.textMuted }}>
            No working sets in the last 7 days
          </div>
          <div style={{ fontSize: 12, color: BP.textDim, maxWidth: 250, lineHeight: 1.5 }}>
            Log a session and your weekly sets per muscle region will fill in here, graded against
            evidence-based volume landmarks.
          </div>
        </div>
      </Card>
    );
  }
  return (
    <div className="grid gap-3">
      <div className="text-[12px]" style={{ color: BP.textDim }}>
        Hard sets per region, last 7 days. The shaded band is the productive range
        (MEV → MRV).
      </div>
      {groups.map(({ group, rows }) => (
        <div key={group}>
          <Eyebrow style={{ paddingLeft: 2, paddingBottom: 6 }}>{group}</Eyebrow>
          <Card padding={0} style={{ borderRadius: 14, overflow: "hidden" }}>
            {rows.map((r, i) => (
              <VolumeRow key={r.region} r={r} last={i === rows.length - 1} />
            ))}
          </Card>
        </div>
      ))}
    </div>
  );
}

function VolumeRow({ r, last }: { r: RegionVolume; last: boolean }) {
  const s = STATUS[r.status];
  const trackMax = Math.max(r.mrv, r.weeklySets) * 1.12 || 1;
  const pct = (v: number) => `${Math.min(100, (v / trackMax) * 100)}%`;
  return (
    <div
      style={{
        padding: "11px 14px",
        borderBottom: last ? "none" : `1px solid ${BP.borderSoft}`,
      }}
    >
      <div className="flex items-center justify-between" style={{ gap: 10, marginBottom: 7 }}>
        <span className="text-[14px] font-medium">{r.label}</span>
        <span className="flex items-center" style={{ gap: 8 }}>
          <Mono style={{ fontSize: 14, fontWeight: 700, color: s.color }}>
            {r.weeklySets}
          </Mono>
          <Pill color={s.color}>{s.word}</Pill>
        </span>
      </div>
      {/* track with MEV→MRV productive band + current fill */}
      <div style={{ position: "relative", height: 8, borderRadius: 4, background: TRACK, overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: pct(r.mev),
            width: `calc(${pct(r.mrv)} - ${pct(r.mev)})`,
            background: "rgba(52,211,153,0.18)",
          }}
        />
        <div style={{ height: "100%", width: pct(r.weeklySets), background: s.color, opacity: 0.85 }} />
      </div>
      <div className="flex justify-between" style={{ marginTop: 4 }}>
        <span style={{ fontSize: 10, color: BP.textFaint }}>
          MEV <Mono>{r.mev}</Mono> · MRV <Mono>{r.mrv}</Mono>
        </span>
        {r.weeklyVolumeLb > 0 ? (
          <span style={{ fontSize: 10, color: BP.textFaint }}>
            <Mono>{r.weeklyVolumeLb.toLocaleString()}</Mono> lb
          </span>
        ) : null}
      </div>
    </div>
  );
}
