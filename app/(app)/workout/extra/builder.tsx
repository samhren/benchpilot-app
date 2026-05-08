"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ExerciseLibraryPicker,
  type LibraryExercise,
} from "@/components/exercise-library-picker";
import { startExtraSessionAction } from "@/app/actions";
import { BP, BigButton, Eyebrow, Mono, Pill } from "@/components/ui/primitives";

interface Row {
  exerciseId: string;
  name: string;
  muscleGroup: string;
  sets: number;
  reps: number;
  rirTarget: number;
}

export function ExtraSessionBuilder({ library }: { library: LibraryExercise[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [picking, setPicking] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function addExercise(ex: LibraryExercise) {
    setRows((r) => [
      ...r,
      { exerciseId: ex.id, name: ex.name, muscleGroup: ex.muscleGroup, sets: 3, reps: 8, rirTarget: 1 },
    ]);
    setPicking(false);
  }

  function update(i: number, patch: Partial<Row>) {
    setRows((r) => r.map((row, j) => (i === j ? { ...row, ...patch } : row)));
  }

  function remove(i: number) {
    setRows((r) => r.filter((_, j) => j !== i));
  }

  async function start() {
    if (rows.length === 0) {
      toast.error("Add at least one exercise");
      return;
    }
    setSubmitting(true);
    const r = await startExtraSessionAction({
      exercises: rows.map((row) => ({
        exerciseId: row.exerciseId,
        sets: row.sets,
        reps: row.reps,
        rirTarget: row.rirTarget,
      })),
    });
    setSubmitting(false);
    if (!r.ok) {
      toast.error("Failed to start session");
      return;
    }
    toast.success("Extra session started");
    router.push(`/workout/extra/${r.sessionId}/active`);
  }

  return (
    <div style={{ padding: "12px 20px 130px" }}>
      <button
        onClick={() => router.back()}
        style={{
          color: BP.textMuted,
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
          marginTop: 4,
        }}
      >
        ← Back
      </button>

      <Eyebrow style={{ paddingTop: 18 }}>Off-schedule</Eyebrow>
      <div className="flex items-baseline gap-3 mt-1.5">
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em" }}>Extra session</div>
        <Pill bg={BP.accentSoft} color={BP.accent}>
          adhoc
        </Pill>
      </div>
      <div className="text-sm mt-1" style={{ color: BP.textMuted }}>
        Build a one-off workout. Doesn't shift the program.
      </div>

      <div className="mt-5 flex flex-col gap-2">
        {rows.map((row, i) => (
          <div
            key={i}
            data-testid={`extra-row-${i}`}
            style={{
              background: BP.surface,
              border: `1px solid ${BP.borderSoft}`,
              borderRadius: 14,
              padding: "12px 14px",
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[15px] font-semibold">{row.name}</div>
                <div className="text-[12px]" style={{ color: BP.textDim }}>
                  {row.muscleGroup}
                </div>
              </div>
              <button
                onClick={() => remove(i)}
                data-testid={`extra-remove-${i}`}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  border: `1px solid ${BP.borderSoft}`,
                  background: BP.surface2,
                  color: BP.textMuted,
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <NumField
                label="Sets"
                value={row.sets}
                min={1}
                max={10}
                onChange={(v) => update(i, { sets: v })}
                testId={`extra-sets-${i}`}
              />
              <NumField
                label="Reps"
                value={row.reps}
                min={1}
                max={30}
                onChange={(v) => update(i, { reps: v })}
                testId={`extra-reps-${i}`}
              />
              <NumField
                label="RIR"
                value={row.rirTarget}
                min={0}
                max={5}
                onChange={(v) => update(i, { rirTarget: v })}
                testId={`extra-rir-${i}`}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3">
        <BigButton kind="dark" height={52} onClick={() => setPicking(true)} data-testid="extra-add">
          + Add exercise
        </BigButton>
      </div>

      {rows.length > 0 ? (
        <div className="mt-4">
          <BigButton
            kind="primary"
            height={64}
            onClick={start}
            data-testid="extra-start"
            disabled={submitting}
          >
            Start session
          </BigButton>
        </div>
      ) : null}

      {picking ? (
        <ExerciseLibraryPicker
          exercises={library}
          title="Add exercise"
          onClose={() => setPicking(false)}
          onPick={addExercise}
        />
      ) : null}
    </div>
  );
}

function NumField({
  label,
  value,
  min,
  max,
  onChange,
  testId,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  testId?: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        background: BP.surface2,
        border: `1px solid ${BP.borderSoft}`,
        borderRadius: 10,
        padding: "6px 10px",
      }}
    >
      <Eyebrow>{label}</Eyebrow>
      <div className="flex items-center gap-1 mt-0.5">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            border: "none",
            background: BP.surface,
            color: BP.text,
            cursor: "pointer",
          }}
        >
          −
        </button>
        <Mono
          data-testid={testId}
          style={{ flex: 1, textAlign: "center", fontSize: 16, fontWeight: 700 }}
        >
          {value}
        </Mono>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            border: "none",
            background: BP.surface,
            color: BP.text,
            cursor: "pointer",
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}
