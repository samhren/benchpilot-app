"use client";

import { useMemo, useState } from "react";
import { BP, BigButton, Eyebrow, Mono } from "@/components/ui/primitives";

export interface LibraryExercise {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string | null;
}

interface Props {
  exercises: LibraryExercise[];
  excludeId?: string;
  title?: string;
  onPick: (ex: LibraryExercise) => void;
  onClose: () => void;
}

export function ExerciseLibraryPicker({
  exercises,
  excludeId,
  title = "Pick an exercise",
  onPick,
  onClose,
}: Props) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = exercises.filter((e) => e.id !== excludeId);
    if (!needle) return list;
    return list.filter(
      (e) =>
        e.name.toLowerCase().includes(needle) ||
        e.muscleGroup.toLowerCase().includes(needle) ||
        (e.equipment ?? "").toLowerCase().includes(needle),
    );
  }, [q, exercises, excludeId]);

  const grouped = useMemo(() => {
    const m = new Map<string, LibraryExercise[]>();
    for (const e of filtered) {
      const arr = m.get(e.muscleGroup) ?? [];
      arr.push(e);
      m.set(e.muscleGroup, arr);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  return (
    <div
      data-testid="exercise-picker"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 95,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "flex-end",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 460,
          margin: "0 auto",
          background: "#141414",
          borderRadius: "24px 24px 0 0",
          padding: "16px 16px 22px",
          border: `1px solid ${BP.border}`,
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{ width: 40, height: 4, borderRadius: 2, background: "#3a3a3a", margin: "0 auto 12px" }}
        />
        <div className="flex items-center justify-between mb-3">
          <Eyebrow>{title}</Eyebrow>
          <button
            onClick={onClose}
            data-testid="picker-close"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: `1px solid ${BP.borderSoft}`,
              background: BP.surface,
              color: BP.textMuted,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search exercises…"
          data-testid="picker-search"
          autoFocus
          style={{
            width: "100%",
            height: 44,
            padding: "0 14px",
            background: BP.surface2,
            border: `1px solid ${BP.border}`,
            borderRadius: 12,
            color: BP.text,
            fontSize: 15,
            outline: "none",
            marginBottom: 10,
          }}
        />
        <div className="overflow-y-auto" style={{ flex: 1 }}>
          {grouped.length === 0 ? (
            <div
              className="text-center py-8"
              style={{ color: BP.textMuted, fontSize: 13 }}
            >
              No matches
            </div>
          ) : (
            grouped.map(([group, list]) => (
              <div key={group} style={{ marginBottom: 14 }}>
                <Eyebrow style={{ marginBottom: 6, marginLeft: 4 }}>{group}</Eyebrow>
                <div className="flex flex-col gap-1.5">
                  {list.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => onPick(e)}
                      data-testid={`picker-pick-${e.id}`}
                      style={{
                        background: BP.surface,
                        border: `1px solid ${BP.borderSoft}`,
                        borderRadius: 12,
                        padding: "12px 14px",
                        color: BP.text,
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      <div className="flex items-baseline justify-between">
                        <div className="text-[14px] font-semibold">{e.name}</div>
                        {e.equipment ? (
                          <Mono style={{ fontSize: 11, color: BP.textDim }}>{e.equipment}</Mono>
                        ) : null}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
        <div className="mt-3">
          <BigButton kind="dark" height={48} onClick={onClose}>
            Cancel
          </BigButton>
        </div>
      </div>
    </div>
  );
}
