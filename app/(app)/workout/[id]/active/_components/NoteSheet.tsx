"use client";

import { useState } from "react";
import { BP, BigButton, Eyebrow } from "@/components/ui/primitives";

export function NoteSheet({
  exerciseName,
  initial,
  onClose,
  onSave,
}: {
  exerciseName: string;
  initial: string | null;
  onClose: () => void;
  onSave: (next: string | null) => void;
}) {
  const [v, setV] = useState(initial ?? "");
  return (
    <div
      onClick={onClose}
      data-testid="note-sheet"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 60,
        display: "flex",
        alignItems: "flex-end",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: BP.surface,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          borderTop: `1px solid ${BP.borderSoft}`,
          width: "100%",
          maxWidth: 420,
          margin: "0 auto",
          padding: "18px 20px 28px",
        }}
      >
        <div
          style={{
            width: 40,
            height: 4,
            borderRadius: 2,
            background: BP.borderSoft,
            margin: "0 auto 14px",
          }}
        />
        <Eyebrow>Note · {exerciseName}</Eyebrow>
        <textarea
          autoFocus
          data-testid="note-textarea"
          value={v}
          onChange={(e) => setV(e.target.value)}
          placeholder="Felt strong / shoulder twinge / form cue…"
          rows={5}
          style={{
            width: "100%",
            marginTop: 10,
            background: BP.surface2,
            border: `1px solid ${BP.borderSoft}`,
            borderRadius: 12,
            color: BP.text,
            padding: "12px 14px",
            fontSize: 15,
            lineHeight: 1.4,
            outline: "none",
            resize: "vertical",
            minHeight: 110,
          }}
        />
        <div className="flex gap-2 mt-3">
          <BigButton kind="dark" height={48} onClick={onClose} style={{ flex: 1 }}>
            Cancel
          </BigButton>
          <BigButton
            kind="primary"
            height={48}
            onClick={() => onSave(v.trim().length === 0 ? null : v.trim())}
            data-testid="note-save"
            style={{ flex: 2 }}
          >
            Save
          </BigButton>
        </div>
      </div>
    </div>
  );
}
