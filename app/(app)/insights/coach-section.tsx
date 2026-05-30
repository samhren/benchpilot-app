// Server component that renders the AI Coach card. It awaits ensureCoachDigest,
// which only calls the model when there's a new workout since the last digest —
// so it's cheap on most loads. Wrapped in <Suspense> by the page, it streams in
// after the rest of Insights has already rendered (no blank-page blocking).

import { BP, Card, Eyebrow, Pill } from "@/components/ui/primitives";
import { ensureCoachDigest } from "@/lib/insights/coach-service";
import type { CoachPriority } from "@/lib/insights/coach";

const PRIORITY_COLOR: Record<CoachPriority, string> = {
  high: "#ff4d4d",
  medium: "#ff8a3a",
  low: "#34d399",
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <Card padding={14} style={{ borderRadius: 16, marginBottom: 14 }}>
      <Eyebrow style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: BP.accent, display: "inline-block" }} />
        AI Coach
      </Eyebrow>
      {children}
    </Card>
  );
}

export function CoachCardSkeleton() {
  return (
    <Shell>
      <div style={{ fontSize: 13, color: BP.textDim }}>Reading your training…</div>
      <div className="grid" style={{ gap: 8, marginTop: 10 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              height: 56,
              borderRadius: 12,
              background: BP.surface2,
              border: `1px solid ${BP.borderSoft}`,
              opacity: 0.5,
            }}
          />
        ))}
      </div>
    </Shell>
  );
}

export default async function CoachSection({ userId }: { userId: string }) {
  const view = await ensureCoachDigest(userId);

  if (view.status === "empty") {
    return (
      <Shell>
        <div style={{ fontSize: 13, color: BP.textDim, lineHeight: 1.5 }}>
          Finish a workout and your coach will weigh in here — what to push, what to pull back, and
          how your bench is tracking.
        </div>
      </Shell>
    );
  }

  if (view.status === "unavailable") {
    return (
      <Shell>
        <div style={{ fontSize: 13, color: BP.textDim }}>Coaching is unavailable right now.</div>
      </Shell>
    );
  }

  const { digest, createdAt } = view;
  return (
    <Shell>
      <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4, marginBottom: 10 }}>
        {digest.headline}
      </div>
      <div className="grid" style={{ gap: 8 }}>
        {digest.items.map((it, i) => {
          const color = PRIORITY_COLOR[it.priority];
          return (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 12,
                background: BP.surface2,
                border: `1px solid ${BP.borderSoft}`,
              }}
            >
              <span style={{ width: 3, borderRadius: 2, background: color, flexShrink: 0, alignSelf: "stretch" }} />
              <div style={{ minWidth: 0 }}>
                <div className="flex items-center" style={{ gap: 8, marginBottom: 2, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13.5, fontWeight: 650 }}>{it.title}</span>
                  {it.tag ? (
                    <Pill color={color} style={{ fontSize: 9, padding: "2px 7px" }}>
                      {it.tag}
                    </Pill>
                  ) : null}
                </div>
                <div style={{ fontSize: 12.5, color: BP.textDim, lineHeight: 1.45 }}>{it.detail}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 10, color: BP.textFaint, marginTop: 9 }}>
        Updated {relativeTime(createdAt)} · auto-refreshes after each workout · AI-generated, use judgment
      </div>
    </Shell>
  );
}
