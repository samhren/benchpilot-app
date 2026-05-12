"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BP, Mono } from "@/components/ui/primitives";

interface Props {
  session: {
    sessionId: string;
    isExtra: boolean;
    programDayId: string | null;
    label: string;
    startedAt: string;
    setsLogged: number;
  };
}

export function ResumeWorkoutBanner({ session }: Props) {
  const pathname = usePathname();

  // Don't show if we're already inside the active workout for this session.
  if (pathname.startsWith("/workout/") && pathname.endsWith("/active")) return null;
  if (pathname.startsWith("/signin")) return null;

  const href = session.isExtra
    ? `/workout/extra/${session.sessionId}/active`
    : session.programDayId
      ? `/workout/${session.programDayId}/active`
      : null;
  if (!href) return null;

  const ageMin = Math.max(
    0,
    Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 60_000),
  );
  const ageLabel =
    ageMin < 1 ? "just now" : ageMin < 60 ? `${ageMin}m ago` : `${Math.floor(ageMin / 60)}h ago`;

  return (
    <Link
      href={href}
      data-testid="resume-workout-banner"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 70px)",
        zIndex: 60,
        display: "flex",
        justifyContent: "center",
        textDecoration: "none",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          pointerEvents: "auto",
          width: "calc(100% - 24px)",
          maxWidth: 420,
          margin: "0 12px",
          padding: "10px 14px",
          background: BP.accent,
          borderRadius: 14,
          boxShadow: "0 8px 24px rgba(255,47,47,0.35), 0 2px 6px rgba(0,0,0,0.4)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          color: "#fff",
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: "#fff",
            boxShadow: "0 0 0 4px rgba(255,255,255,0.25)",
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              opacity: 0.85,
            }}
          >
            Workout in progress
          </div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              marginTop: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {session.label.split("—")[0].trim()}
            <Mono
              style={{
                fontSize: 11,
                marginLeft: 8,
                opacity: 0.85,
                fontWeight: 500,
              }}
            >
              {session.setsLogged} set{session.setsLogged === 1 ? "" : "s"} · {ageLabel}
            </Mono>
          </div>
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexShrink: 0,
          }}
        >
          Resume
          <svg width={14} height={14} viewBox="0 0 16 16" fill="none">
            <path d="M5 3l6 5-6 5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </Link>
  );
}
