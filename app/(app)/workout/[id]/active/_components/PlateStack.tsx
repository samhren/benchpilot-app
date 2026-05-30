"use client";

export function PlateStack({ plates }: { plates: number[] }) {
  const colors: Record<number, string> = { 45: "#3a4960", 35: "#5a3030", 25: "#3a3a3a", 10: "#2d2d2d", 5: "#202020", 2.5: "#1a1a1a" };
  const sizes: Record<number, number> = { 45: 56, 35: 48, 25: 42, 10: 32, 5: 26, 2.5: 22 };
  const widths: Record<number, number> = { 45: 8, 35: 8, 25: 7, 10: 6, 5: 5, 2.5: 4 };
  const left = [...plates].reverse();
  const right = plates;
  const Plate = ({ p }: { p: number }) => (
    <div
      style={{
        width: widths[p],
        height: sizes[p],
        background: colors[p],
        borderRadius: 2,
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    />
  );
  return (
    <div className="flex items-center gap-0">
      <div style={{ width: 18, height: 6, background: "#3a3a3a", borderRadius: "2px 0 0 2px" }} />
      {left.map((p, i) => (
        <div key={"l" + i} style={{ marginLeft: 1 }}>
          <Plate p={p} />
        </div>
      ))}
      <div style={{ width: 36, height: 4, background: "#444" }} />
      {right.map((p, i) => (
        <div key={"r" + i} style={{ marginRight: 1 }}>
          <Plate p={p} />
        </div>
      ))}
      <div style={{ width: 18, height: 6, background: "#3a3a3a", borderRadius: "0 2px 2px 0" }} />
    </div>
  );
}
