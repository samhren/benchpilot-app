"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BP, BigButton, Eyebrow, Mono } from "@/components/ui/primitives";
import {
  resetProgramAction,
  setComparisonProfileAction,
  setEnableWarmupAction,
  setLiftOneRmAction,
  setProgramStartDateAction,
  setRestTimersAction,
  setTimezoneAction,
  setUnitsAction,
} from "@/app/actions";
import { toast } from "sonner";

interface Props {
  lifts: Array<{ name: string; currentOneRm: number | null; trainingMax: number | null }>;
  currentWeek: number;
  currentBlock: string;
  startDate: string;
  units: "lb" | "kg";
  timezone: string;
  age: number | null;
  comparisonBodyWeightLb: number | null;
  restMainSec: number;
  restAccessorySec: number;
  enableWarmup: boolean;
}

const LIFT_LABELS: Record<string, string> = {
  bench_press: "Bench press",
  back_squat: "Back squat",
};

export default function SettingsClient({
  lifts,
  currentWeek,
  currentBlock,
  startDate,
  units: initialUnits,
  timezone: initialTimezone,
  age: initialAge,
  comparisonBodyWeightLb: initialComparisonBodyWeight,
  restMainSec,
  restAccessorySec,
  enableWarmup: initialEnableWarmup,
}: Props) {
  const router = useRouter();
  const [enableWarmup, setEnableWarmup] = useState(initialEnableWarmup);
  const [units, setUnits] = useState(initialUnits);
  const [timezone, setTimezone] = useState(initialTimezone);
  const [age, setAge] = useState(String(initialAge ?? ""));
  const [comparisonBodyWeight, setComparisonBodyWeight] = useState(String(initialComparisonBodyWeight ?? ""));
  const [mainRest, setMainRest] = useState(String(Math.round(restMainSec / 60)));
  const [accessoryRest, setAccessoryRest] = useState(String(Math.round(restAccessorySec / 60)));
  const [programStart, setProgramStart] = useState(startDate);
  const [pending, start] = useTransition();

  return (
    <div style={{ padding: "12px 20px 110px" }}>
      <Eyebrow style={{ paddingTop: 4 }}>Account</Eyebrow>
      <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", marginTop: 4, marginBottom: 18 }}>
        Settings
      </div>

      <Group label="1RMs">
        {lifts.map((l, i) => (
          <OneRmRow
            key={l.name}
            liftName={l.name}
            label={LIFT_LABELS[l.name] ?? l.name}
            oneRm={l.currentOneRm}
            trainingMax={l.trainingMax}
            last={i === lifts.length - 1}
          />
        ))}
      </Group>

      <Group label="Units">
        <Row title="Weight units">
          <div
            style={{
              display: "flex",
              gap: 4,
              background: BP.surface2,
              padding: 3,
              borderRadius: 8,
            }}
          >
            {(["lb", "kg"] as const).map((u) => {
              const on = u === units;
              return (
                <button
                  key={u}
                  onClick={() =>
                    start(async () => {
                      setUnits(u);
                      await setUnitsAction(u);
                      router.refresh();
                    })
                  }
                  style={{
                    height: 28,
                    padding: "0 12px",
                    borderRadius: 6,
                    border: "none",
                    background: on ? BP.accent : "transparent",
                    color: on ? "#fff" : BP.textMuted,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                  data-testid={`units-${u}`}
                >
                  {u.toUpperCase()}
                </button>
              );
            })}
          </div>
        </Row>
      </Group>

      <Group label="Comparison Profile">
        <Row title="Age" sub="Used for strength standards" last={false}>
          <NumberSave
            value={age}
            onChange={setAge}
            suffix="yr"
            disabled={pending}
            min={13}
            max={100}
            onSave={() =>
              start(async () => {
                const nextAge = parseInt(age, 10);
                const nextBodyWeight = parseFloat(comparisonBodyWeight);
                const r = await setComparisonProfileAction({
                  age: Number.isFinite(nextAge) ? nextAge : null,
                  bodyWeightLb: Number.isFinite(nextBodyWeight) ? nextBodyWeight : null,
                });
                if (r.ok) {
                  toast.success("Comparison profile updated");
                  router.refresh();
                }
              })
            }
          />
        </Row>
        <Row title="Bodyweight" sub="Used for strength standards" last>
          <NumberSave
            value={comparisonBodyWeight}
            onChange={setComparisonBodyWeight}
            suffix="lb"
            disabled={pending}
            min={70}
            max={500}
            onSave={() =>
              start(async () => {
                const nextAge = parseInt(age, 10);
                const nextBodyWeight = parseFloat(comparisonBodyWeight);
                const r = await setComparisonProfileAction({
                  age: Number.isFinite(nextAge) ? nextAge : null,
                  bodyWeightLb: Number.isFinite(nextBodyWeight) ? nextBodyWeight : null,
                });
                if (r.ok) {
                  toast.success("Comparison profile updated");
                  router.refresh();
                }
              })
            }
          />
        </Row>
      </Group>

      <Group label="Display">
        <Row title="Show tempo guidance on bench sets" sub="Pause/touch-and-go chips on the active workout" last={false}>
          <TempoToggle />
        </Row>
        <Row title="Guided warm-up" sub="Step through a pre-lift warm-up before logging starts" last>
          <Toggle
            on={enableWarmup}
            disabled={pending}
            testId="warmup-toggle"
            onToggle={(next) =>
              start(async () => {
                setEnableWarmup(next);
                const r = await setEnableWarmupAction(next);
                if (r.ok) {
                  toast.success(next ? "Warm-up enabled" : "Warm-up off");
                  router.refresh();
                } else {
                  setEnableWarmup(!next);
                }
              })
            }
          />
        </Row>
      </Group>

      <Group label="Workout Defaults">
        <Row title="Main lift rest" sub="Minutes after bench and squat sets" last={false}>
          <NumberSave
            value={mainRest}
            onChange={setMainRest}
            suffix="min"
            disabled={pending}
            onSave={() =>
              start(async () => {
                const main = Math.max(1, Math.min(10, Math.round(parseFloat(mainRest) || 3)));
                const accessory = Math.max(1, Math.min(10, Math.round(parseFloat(accessoryRest) || 2)));
                await setRestTimersAction({ mainSec: main * 60, accessorySec: accessory * 60 });
                toast.success("Rest timers updated");
                router.refresh();
              })
            }
          />
        </Row>
        <Row title="Accessory rest" sub="Minutes after accessory sets" last>
          <NumberSave
            value={accessoryRest}
            onChange={setAccessoryRest}
            suffix="min"
            disabled={pending}
            onSave={() =>
              start(async () => {
                const main = Math.max(1, Math.min(10, Math.round(parseFloat(mainRest) || 3)));
                const accessory = Math.max(1, Math.min(10, Math.round(parseFloat(accessoryRest) || 2)));
                await setRestTimersAction({ mainSec: main * 60, accessorySec: accessory * 60 });
                toast.success("Rest timers updated");
                router.refresh();
              })
            }
          />
        </Row>
      </Group>

      <Group label="Program">
        <Row title="Current week" sub={`Week ${currentWeek} of 14 · ${currentBlock}`} last={false} />
        <Row title="Start date" sub="Changing this re-anchors the 14-week calendar" last={false}>
          <input
            type="date"
            value={programStart}
            onChange={(e) => setProgramStart(e.target.value)}
            style={inputStyle(132)}
          />
          <button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await setProgramStartDateAction(programStart);
                if (r.ok) {
                  toast.success("Start date updated");
                  router.refresh();
                }
              })
            }
            style={smallButtonStyle}
          >
            Save
          </button>
        </Row>
        <Row title="Timezone" sub="Used for week/day rollover and bodyweight dates" last={false}>
          <input
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            placeholder="America/New_York"
            style={inputStyle(156)}
          />
          <button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await setTimezoneAction(timezone);
                if (r.ok) {
                  toast.success("Timezone updated");
                  router.refresh();
                } else {
                  toast.error("Invalid timezone");
                }
              })
            }
            style={smallButtonStyle}
          >
            Save
          </button>
        </Row>
        <Row title="Reset program" sub="Wipes sessions and sets, restarts week 1" last>
          <BigButton
            kind="ghost"
            height={36}
            style={{ width: 100, fontSize: 13 }}
            disabled={pending}
            onClick={() =>
              start(async () => {
                if (!confirm("Reset program? Wipes sessions.")) return;
                const r = await resetProgramAction();
                if (r.ok) {
                  toast.success("Program reset");
                  router.refresh();
                }
              })
            }
            data-testid="reset-program"
          >
            Reset
          </BigButton>
        </Row>
      </Group>

      <Group label="">
        <Row
          title="Sign out"
          danger
          last
          onClick={async () => {
            await fetch("/api/auth/signout", { method: "POST" });
            router.push("/signin");
            router.refresh();
          }}
        />
      </Group>

      <div className="text-center mt-7 text-[11px] font-mono" style={{ color: BP.textFaint }}>
        BenchPilot v1.0 · 5/3/1 derived
      </div>
    </div>
  );
}

function OneRmRow({
  liftName,
  label,
  oneRm,
  trainingMax,
  last,
}: {
  liftName: string;
  label: string;
  oneRm: number | null;
  trainingMax: number | null;
  last: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(String(oneRm ?? ""));
  const [pending, start] = useTransition();
  const router = useRouter();
  const squatWorkingWeight =
    liftName === "back_squat" && oneRm != null ? Math.round((oneRm * 0.75) / 5) * 5 : null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        minHeight: 56,
        padding: "10px 16px",
        borderBottom: last ? "none" : `1px solid ${BP.borderSoft}`,
      }}
    >
      <div style={{ flex: 1 }}>
        <div className="text-[15px] font-medium">{label}</div>
        {liftName === "back_squat" && squatWorkingWeight != null ? (
          <div className="text-[12px] mt-0.5" style={{ color: BP.textDim }}>
            1RM <Mono>{oneRm ?? "—"}</Mono> · next squat{" "}
            <Mono data-testid={`tm-${liftName}`}>{squatWorkingWeight}</Mono> lb
          </div>
        ) : trainingMax != null ? (
          <div className="text-[12px] mt-0.5" style={{ color: BP.textDim }}>
            1RM <Mono>{oneRm ?? "—"}</Mono> · TM{" "}
            <Mono data-testid={`tm-${liftName}`}>{trainingMax}</Mono> lb
          </div>
        ) : (
          <div className="text-[12px] mt-0.5" style={{ color: BP.textDim }}>
            Not set
          </div>
        )}
      </div>
      {editing ? (
        <div className="flex gap-2 items-center">
          <input
            type="number"
            value={v}
            onChange={(e) => setV(e.target.value)}
            placeholder="225"
            data-testid={`onerm-${liftName}`}
            className="font-mono text-[15px]"
            style={{
              width: 80,
              height: 36,
              padding: "0 10px",
              background: BP.surface2,
              border: `1px solid ${BP.border}`,
              borderRadius: 8,
              color: BP.text,
              outline: "none",
            }}
          />
          <button
            data-testid={`onerm-save-${liftName}`}
            disabled={pending}
            onClick={() => {
              const n = parseFloat(v);
              if (!Number.isFinite(n) || n <= 0) return;
              start(async () => {
                const r = await setLiftOneRmAction({
                  liftName: liftName as "bench_press" | "back_squat",
                  oneRm: n,
                });
                if (r.ok) {
                  toast.success(`TM = ${r.tm} lb`);
                  setEditing(false);
                  router.refresh();
                }
              });
            }}
            style={{
              height: 36,
              padding: "0 12px",
              background: BP.accent,
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Save
          </button>
        </div>
      ) : (
        <button
          onClick={() => {
            setEditing(true);
            setV(String(oneRm ?? ""));
          }}
          style={{
            height: 32,
            padding: "0 12px",
            background: "transparent",
            color: BP.accent,
            border: `1px solid ${BP.border}`,
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
          data-testid={`onerm-edit-${liftName}`}
        >
          Edit
        </button>
      )}
    </div>
  );
}

const smallButtonStyle: React.CSSProperties = {
  height: 36,
  padding: "0 10px",
  marginLeft: 8,
  background: BP.surface2,
  color: BP.text,
  border: `1px solid ${BP.border}`,
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

function inputStyle(width: number): React.CSSProperties {
  return {
    width,
    height: 36,
    padding: "0 10px",
    background: BP.surface2,
    border: `1px solid ${BP.border}`,
    borderRadius: 8,
    color: BP.text,
    outline: "none",
    fontFamily: "var(--font-mono)",
    fontSize: 12,
  };
}

function NumberSave({
  value,
  onChange,
  suffix,
  disabled,
  min = 1,
  max = 10,
  onSave,
}: {
  value: string;
  onChange: (v: string) => void;
  suffix: string;
  disabled: boolean;
  min?: number;
  max?: number;
  onSave: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle(58)}
      />
      <Mono style={{ fontSize: 11, color: BP.textDim }}>{suffix}</Mono>
      <button disabled={disabled} onClick={onSave} style={smallButtonStyle}>
        Save
      </button>
    </div>
  );
}

function TempoToggle() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    try {
      setOn(localStorage.getItem("bp:showTempo") !== "0");
    } catch {}
  }, []);
  function toggle() {
    const next = !on;
    setOn(next);
    try {
      localStorage.setItem("bp:showTempo", next ? "1" : "0");
    } catch {}
  }
  return (
    <button
      onClick={toggle}
      data-testid="tempo-toggle"
      data-on={on ? "1" : "0"}
      style={{
        width: 46,
        height: 28,
        borderRadius: 999,
        background: on ? BP.accent : BP.surface2,
        border: `1px solid ${on ? BP.accent : BP.borderSoft}`,
        position: "relative",
        cursor: "pointer",
        padding: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: on ? 20 : 2,
          width: 22,
          height: 22,
          borderRadius: 999,
          background: "#fff",
          transition: "left 120ms ease",
        }}
      />
    </button>
  );
}

function Toggle({
  on,
  onToggle,
  disabled,
  testId,
}: {
  on: boolean;
  onToggle: (next: boolean) => void;
  disabled?: boolean;
  testId?: string;
}) {
  return (
    <button
      onClick={() => !disabled && onToggle(!on)}
      disabled={disabled}
      data-testid={testId}
      data-on={on ? "1" : "0"}
      style={{
        width: 46,
        height: 28,
        borderRadius: 999,
        background: on ? BP.accent : BP.surface2,
        border: `1px solid ${on ? BP.accent : BP.borderSoft}`,
        position: "relative",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.6 : 1,
        padding: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: on ? 20 : 2,
          width: 22,
          height: 22,
          borderRadius: 999,
          background: "#fff",
          transition: "left 120ms ease",
        }}
      />
    </button>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      {label ? (
        <div
          className="px-1.5 pb-2"
          style={{
            fontSize: 11,
            color: BP.textDim,
            fontWeight: 600,
            letterSpacing: 0.6,
            textTransform: "uppercase",
          }}
        >
          {label}
        </div>
      ) : null}
      <div
        style={{
          background: BP.surface,
          borderRadius: 16,
          border: `1px solid ${BP.borderSoft}`,
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Row({
  title,
  sub,
  children,
  last,
  danger,
  onClick,
}: {
  title: string;
  sub?: string;
  children?: React.ReactNode;
  last?: boolean;
  danger?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        minHeight: 56,
        padding: "10px 16px",
        borderBottom: last ? "none" : `1px solid ${BP.borderSoft}`,
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div style={{ flex: 1 }}>
        <div className="text-[15px] font-medium" style={{ color: danger ? BP.accent : BP.text }}>
          {title}
        </div>
        {sub ? (
          <div className="text-[12px] mt-0.5" style={{ color: BP.textDim }}>
            {sub}
          </div>
        ) : null}
      </div>
      {children}
    </div>
  );
}
