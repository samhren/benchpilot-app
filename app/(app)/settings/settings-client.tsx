"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BP, BigButton, Eyebrow, Mono } from "@/components/ui/primitives";
import { resetProgramAction, setLiftOneRmAction, setUnitsAction } from "@/app/actions";
import { toast } from "sonner";

interface Props {
  lifts: Array<{ name: string; currentOneRm: number | null; trainingMax: number | null }>;
  currentWeek: number;
  units: "lb" | "kg";
}

const LIFT_LABELS: Record<string, string> = {
  bench_press: "Bench press",
  back_squat: "Back squat",
  deadlift: "Deadlift",
  overhead_press: "Overhead press",
};

export default function SettingsClient({ lifts, currentWeek, units: initialUnits }: Props) {
  const router = useRouter();
  const [units, setUnits] = useState(initialUnits);
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

      <Group label="Program">
        <Row title="Current week" sub={`Week ${currentWeek} of 14`} last={false} />
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
        {trainingMax != null ? (
          <div className="text-[12px] mt-0.5" style={{ color: BP.textDim }}>
            1RM <Mono>{oneRm ?? "—"}</Mono> · TM <Mono>{trainingMax}</Mono> lb
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
                  liftName: liftName as "bench_press",
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
