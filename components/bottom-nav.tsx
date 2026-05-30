"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BP } from "@/components/ui/primitives";

const TAB_ICONS: Record<string, React.ReactNode> = {
  home: (
    <path
      d="M3 11.5L12 4l9 7.5V20a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1v-8.5z"
      stroke="currentColor"
      strokeWidth="1.6"
      fill="none"
      strokeLinejoin="round"
    />
  ),
  workout: (
    <g stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="9" width="3" height="6" rx="0.5" />
      <rect x="19" y="9" width="3" height="6" rx="0.5" />
      <rect x="5" y="7" width="2" height="10" rx="0.5" />
      <rect x="17" y="7" width="2" height="10" rx="0.5" />
      <line x1="7" y1="12" x2="17" y2="12" />
    </g>
  ),
  insights: (
    <g stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 18V6" />
      <path d="M9 18v-5" />
      <path d="M14 18V9" />
      <path d="M19 18V4" />
      <path d="M3 18h18" />
    </g>
  ),
  program: (
    <g stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="16" y1="3" x2="16" y2="7" />
    </g>
  ),
  lifts: (
    <g stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 17l5-6 4 4 4-6 5 7" />
      <circle cx="8" cy="11" r="0.8" fill="currentColor" />
      <circle cx="12" cy="15" r="0.8" fill="currentColor" />
      <circle cx="16" cy="9" r="0.8" fill="currentColor" />
    </g>
  ),
  settings: (
    <g stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M22 12h-3M5 12H2M19 5l-2 2M7 17l-2 2M19 19l-2-2M7 7L5 5" />
    </g>
  ),
};

const TABS: { id: string; href: string; label: string }[] = [
  { id: "home", href: "/", label: "Home" },
  { id: "program", href: "/program", label: "Program" },
  { id: "insights", href: "/insights", label: "Insights" },
  { id: "lifts", href: "/lifts", label: "Lifts" },
  { id: "settings", href: "/settings", label: "Settings" },
];

export function BottomNav() {
  const pathname = usePathname();

  // Hide bottom nav while inside an active workout, sign-in, etc.
  if (pathname.startsWith("/workout/")) return null;
  if (pathname.startsWith("/signin")) return null;

  let active: string = "home";
  if (pathname === "/") active = "home";
  else if (pathname.startsWith("/workout")) active = "workout";
  else if (pathname.startsWith("/program")) active = "program";
  else if (pathname.startsWith("/insights")) active = "insights";
  else if (pathname.startsWith("/lifts")) active = "lifts";
  else if (pathname.startsWith("/settings")) active = "settings";

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        paddingTop: 6,
        paddingBottom: "max(env(safe-area-inset-bottom, 0px), 16px)",
        background: "linear-gradient(to top, #0a0a0a 70%, rgba(10,10,10,0))",
        borderTop: `0.5px solid ${BP.borderSoft}`,
        display: "flex",
        justifyContent: "space-around",
        alignItems: "flex-end",
        zIndex: 50,
      }}
    >
      {TABS.map((t) => {
        const isActive = t.id === active;
        return (
          <Link
            key={t.id}
            href={t.href}
            data-testid={`nav-${t.id}`}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              color: isActive ? BP.accent : BP.textDim,
              padding: "6px 4px",
              minWidth: 56,
              textDecoration: "none",
            }}
          >
            <svg width={24} height={24} viewBox="0 0 24 24">
              {TAB_ICONS[t.id]}
            </svg>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.2 }}>
              {t.label}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
