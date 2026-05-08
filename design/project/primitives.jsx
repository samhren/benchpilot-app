// BenchPilot primitives — phone frame, theme, type, common UI bits.
// Dark by default. 375×812 phone canvas (iPhone X-class).

const BP = {
  bg: '#0a0a0a',
  surface: '#141414',
  surface2: '#1c1c1c',
  border: '#262626',
  borderSoft: '#1f1f1f',
  text: '#ffffff',
  textMuted: 'rgba(255,255,255,0.58)',
  textDim: 'rgba(255,255,255,0.34)',
  textFaint: 'rgba(255,255,255,0.18)',
  accent: '#FF2F2F',          // powerlifting red — AMRAP / log / commit
  accentSoft: 'rgba(255,47,47,0.14)',
  accentLine: 'rgba(255,47,47,0.4)',
  green: '#2BD05F',           // completed / checkmarks (used sparingly)
  amber: '#FFB020',           // today / warnings (used sparingly)
  font: "'Inter Tight', -apple-system, system-ui, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, Menlo, monospace",
};

// ─────────────────────────────────────────────────────────────
// Phone frame — 375×812, dark, status bar + home indicator. Content scrolls.
// ─────────────────────────────────────────────────────────────
function PhoneFrame({ children, statusDark = false, time = '8:42', battery = 84, scroll = true, hideStatus = false, hideHome = false }) {
  return (
    <div className="bp-screen" style={{
      width: 375, height: 812, position: 'relative',
      background: BP.bg, color: BP.text,
      fontFamily: BP.font,
      overflow: 'hidden',
      letterSpacing: '-0.005em',
    }}>
      {!hideStatus && <PhoneStatusBar time={time} battery={battery} dark={statusDark} />}
      <div style={{
        position: 'absolute', inset: 0, paddingTop: hideStatus ? 0 : 44,
        paddingBottom: hideHome ? 0 : 0,
        overflow: scroll ? 'auto' : 'hidden',
        scrollbarWidth: 'none',
      }}>
        {children}
      </div>
      {!hideHome && <PhoneHomeIndicator />}
    </div>
  );
}

function PhoneStatusBar({ time = '8:42', battery = 84, dark = false }) {
  const c = '#fff';
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, height: 44,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 28px', zIndex: 60,
      pointerEvents: 'none',
    }}>
      <span style={{
        fontFamily: BP.font, fontWeight: 600, fontSize: 15, color: c,
        fontVariantNumeric: 'tabular-nums',
      }}>{time}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: 0.95 }}>
        {/* signal */}
        <svg width="17" height="11" viewBox="0 0 17 11" fill={c}>
          <rect x="0" y="7" width="3" height="4" rx="0.5"/>
          <rect x="4.5" y="5" width="3" height="6" rx="0.5"/>
          <rect x="9" y="2.5" width="3" height="8.5" rx="0.5"/>
          <rect x="13.5" y="0" width="3" height="11" rx="0.5"/>
        </svg>
        {/* wifi */}
        <svg width="16" height="11" viewBox="0 0 16 11" fill={c}>
          <path d="M8 2.5C10.2 2.5 12.2 3.4 13.7 4.8L14.7 3.8C12.9 2.1 10.5 1 8 1C5.5 1 3.1 2.1 1.3 3.8L2.3 4.8C3.8 3.4 5.8 2.5 8 2.5Z"/>
          <path d="M8 5.7C9.3 5.7 10.5 6.2 11.4 7.1L12.4 6.1C11.2 5 9.7 4.3 8 4.3C6.3 4.3 4.8 5 3.6 6.1L4.6 7.1C5.5 6.2 6.7 5.7 8 5.7Z"/>
          <circle cx="8" cy="9.4" r="1.3"/>
        </svg>
        {/* battery */}
        <div style={{ position: 'relative', width: 26, height: 12, marginLeft: 2 }}>
          <div style={{ position: 'absolute', inset: 0, border: `1px solid ${c}`, opacity: 0.4, borderRadius: 3 }} />
          <div style={{ position: 'absolute', top: 1.5, left: 1.5, bottom: 1.5, width: `${(battery / 100) * 21}px`, background: c, borderRadius: 1.5 }} />
          <div style={{ position: 'absolute', right: -2.5, top: 4, width: 1.5, height: 4, background: c, opacity: 0.4, borderRadius: '0 1px 1px 0' }} />
        </div>
      </div>
    </div>
  );
}

function PhoneHomeIndicator() {
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      height: 28, display: 'flex', justifyContent: 'center', alignItems: 'flex-end',
      paddingBottom: 8, zIndex: 60, pointerEvents: 'none',
    }}>
      <div style={{ width: 134, height: 5, borderRadius: 100, background: 'rgba(255,255,255,0.55)' }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Bottom tab nav — used on Dashboard, Program, Lifts, Settings.
// ─────────────────────────────────────────────────────────────
const TAB_ICONS = {
  home: <path d="M3 11.5L12 4l9 7.5V20a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1v-8.5z" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinejoin="round"/>,
  workout: (
    <g stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="9" width="3" height="6" rx="0.5"/>
      <rect x="19" y="9" width="3" height="6" rx="0.5"/>
      <rect x="5" y="7" width="2" height="10" rx="0.5"/>
      <rect x="17" y="7" width="2" height="10" rx="0.5"/>
      <line x1="7" y1="12" x2="17" y2="12"/>
    </g>
  ),
  program: (
    <g stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
      <line x1="8" y1="3" x2="8" y2="7"/>
      <line x1="16" y1="3" x2="16" y2="7"/>
    </g>
  ),
  lifts: (
    <g stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 17l5-6 4 4 4-6 5 7"/>
      <circle cx="8" cy="11" r="0.8" fill="currentColor"/>
      <circle cx="12" cy="15" r="0.8" fill="currentColor"/>
      <circle cx="16" cy="9" r="0.8" fill="currentColor"/>
    </g>
  ),
  settings: (
    <g stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 2v3M12 19v3M22 12h-3M5 12H2M19 5l-2 2M7 17l-2 2M19 19l-2-2M7 7L5 5"/>
    </g>
  ),
};

function BottomNav({ active = 'home' }) {
  const tabs = [
    { id: 'home', label: 'Home' },
    { id: 'workout', label: 'Workout' },
    { id: 'program', label: 'Program' },
    { id: 'lifts', label: 'Lifts' },
    { id: 'settings', label: 'Settings' },
  ];
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      paddingTop: 6, paddingBottom: 28,
      background: 'linear-gradient(to top, #0a0a0a 70%, rgba(10,10,10,0))',
      borderTop: `0.5px solid ${BP.borderSoft}`,
      display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end',
      zIndex: 50,
    }}>
      {tabs.map((t) => {
        const isActive = t.id === active;
        return (
          <div key={t.id} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            color: isActive ? BP.accent : BP.textDim,
            padding: '6px 4px',
            minWidth: 56,
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24">{TAB_ICONS[t.id]}</svg>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.2 }}>{t.label}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Type & layout primitives
// ─────────────────────────────────────────────────────────────
const Mono = ({ children, style }) => (
  <span style={{ fontFamily: BP.mono, fontVariantNumeric: 'tabular-nums', ...style }}>{children}</span>
);

const Eyebrow = ({ children, style }) => (
  <div style={{
    fontSize: 11, fontWeight: 600, letterSpacing: 1.4,
    textTransform: 'uppercase', color: BP.textDim, ...style,
  }}>{children}</div>
);

const SectionTitle = ({ children, style }) => (
  <div style={{
    fontSize: 13, fontWeight: 600, letterSpacing: 0.6,
    textTransform: 'uppercase', color: BP.textMuted,
    padding: '24px 20px 10px', ...style,
  }}>{children}</div>
);

// Stat card used on dashboard
function StatCard({ label, value, unit = 'lb', sub, accent, style }) {
  return (
    <div style={{
      background: BP.surface, borderRadius: 16, padding: '14px 16px 16px',
      border: `1px solid ${BP.borderSoft}`,
      display: 'flex', flexDirection: 'column', gap: 4,
      ...style,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.6, color: BP.textMuted, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 2 }}>
        <Mono style={{ fontSize: 28, fontWeight: 700, color: accent || BP.text, letterSpacing: '-0.03em' }}>{value}</Mono>
        <Mono style={{ fontSize: 13, fontWeight: 500, color: BP.textDim }}>{unit}</Mono>
      </div>
      {sub && <div style={{ fontSize: 11, color: BP.textDim, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// Big primary CTA (red, full-width)
function BigButton({ children, onClick, kind = 'primary', height = 64, style, icon }) {
  const styles = {
    primary: { background: BP.accent, color: '#fff' },
    dark:    { background: BP.surface2, color: '#fff', border: `1px solid ${BP.border}` },
    ghost:   { background: 'transparent', color: BP.text, border: `1px solid ${BP.border}` },
  }[kind];
  return (
    <button onClick={onClick} style={{
      width: '100%', height, borderRadius: 16, border: 'none',
      fontFamily: BP.font, fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      cursor: 'pointer', transition: 'transform 0.08s, filter 0.15s',
      ...styles, ...style,
    }}
    onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.985)')}
    onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
    onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}>
      {icon}
      {children}
    </button>
  );
}

// Pill — "AMRAP" badge etc.
function Pill({ children, color = BP.accent, bg, style }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '4px 10px', borderRadius: 999,
      background: bg ?? `color-mix(in oklab, ${color} 14%, transparent)`,
      color, fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase',
      ...style,
    }}>{children}</span>
  );
}

// Step dots (set progress) — solid for done, ring for current, faint for todo
function StepDots({ total, current, done, accent = BP.accent }) {
  // current is 1-indexed, done is count of completed
  const out = [];
  for (let i = 0; i < total; i++) {
    const isDone = i < done;
    const isCurrent = i === done;
    out.push(
      <div key={i} style={{
        width: isCurrent ? 18 : 8, height: 8, borderRadius: 4,
        background: isDone ? accent : isCurrent ? accent : BP.borderSoft,
        opacity: isDone ? 1 : isCurrent ? 1 : 1,
        transition: 'all 0.2s',
      }} />,
    );
  }
  return <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>{out}</div>;
}

// Sparkline — simple polyline. Pass numeric array.
function Sparkline({ data, width = 180, height = 40, color = BP.text, accent = BP.accent }) {
  if (!data || !data.length) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const points = data.map((v, i) => `${i * step},${height - ((v - min) / range) * (height - 6) - 3}`).join(' ');
  const last = data[data.length - 1];
  const lx = (data.length - 1) * step;
  const ly = height - ((last - min) / range) * (height - 6) - 3;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeOpacity="0.65" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="3" fill={accent} />
    </svg>
  );
}

// Card — surface with optional padding
const Card = ({ children, style, padding = 16 }) => (
  <div style={{
    background: BP.surface, borderRadius: 18, padding,
    border: `1px solid ${BP.borderSoft}`,
    ...style,
  }}>{children}</div>
);

// Toggle
function Toggle({ value, onChange }) {
  return (
    <div onClick={() => onChange && onChange(!value)} style={{
      width: 48, height: 28, borderRadius: 999, padding: 2,
      background: value ? BP.accent : '#2a2a2a', cursor: 'pointer',
      transition: 'background 0.15s',
    }}>
      <div style={{
        width: 24, height: 24, borderRadius: '50%', background: '#fff',
        transform: value ? 'translateX(20px)' : 'translateX(0)',
        transition: 'transform 0.18s cubic-bezier(.2,.8,.4,1)',
        boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
      }} />
    </div>
  );
}

// Plate calc — given weight, return list of plates per side (assumes 45 lb bar)
function calcPlates(weight, bar = 45) {
  const plates = [45, 35, 25, 10, 5, 2.5];
  const perSide = (weight - bar) / 2;
  if (perSide <= 0) return [];
  let remaining = perSide;
  const result = [];
  for (const p of plates) {
    while (remaining >= p - 0.001) {
      result.push(p);
      remaining -= p;
    }
  }
  return result;
}

// Small chevron
const Chevron = ({ size = 12, color = BP.textDim, dir = 'right' }) => (
  <svg width={size} height={size * 1.5} viewBox="0 0 8 12" fill="none">
    <path d={dir === 'right' ? 'M1 1l5 5-5 5' : 'M7 1L2 6l5 5'} stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Check = ({ size = 14, color = BP.green }) => (
  <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
    <path d="M2.5 7.5l3 3 6-7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

Object.assign(window, {
  BP, PhoneFrame, PhoneStatusBar, PhoneHomeIndicator, BottomNav,
  Mono, Eyebrow, SectionTitle,
  StatCard, BigButton, Pill, StepDots, Sparkline, Card, Toggle,
  calcPlates, Chevron, Check,
});
