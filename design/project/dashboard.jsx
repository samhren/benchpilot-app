// BenchPilot — Dashboard, Sign-in, Lifts, Settings, Manual TM dialog.

function SignInScreen() {
  const [pw, setPw] = React.useState('••••••');
  return (
    <PhoneFrame>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        padding: '120px 28px 60px', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <BPLogo size={36} />
            <div style={{ fontFamily: BP.font, fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>BenchPilot</div>
          </div>
          <div style={{ color: BP.textMuted, fontSize: 14, marginLeft: 1 }}>Lifting tracker</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Eyebrow style={{ marginLeft: 4 }}>Password</Eyebrow>
          <div style={{
            background: BP.surface, border: `1px solid ${BP.border}`,
            borderRadius: 16, height: 64,
            display: 'flex', alignItems: 'center', padding: '0 22px',
            fontFamily: BP.mono, fontSize: 28, letterSpacing: 6, color: BP.text,
          }}>{pw}<span style={{ marginLeft: 'auto', width: 2, height: 24, background: BP.accent, animation: 'blink 1s infinite' }} /></div>
          <BigButton kind="primary" height={64}>Unlock</BigButton>
        </div>
        <div style={{ textAlign: 'center', color: BP.textFaint, fontSize: 11, fontFamily: BP.mono }}>v1.0 · single user</div>
      </div>
      <BottomNav active="" />
    </PhoneFrame>
  );
}

function BPLogo({ size = 36 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 8,
      background: BP.accent, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: BP.mono, fontWeight: 800, fontSize: size * 0.5,
      letterSpacing: -1,
    }}>BP</div>
  );
}

// ─────────────────────────────────────────────────────────────
// Dashboard — overrides allow showing post-AMRAP-bump state
// ─────────────────────────────────────────────────────────────
function DashboardScreen({ benchTM = 295, benchSub = 'last bumped +5 lb · 12 days ago', highlight = false }) {
  const bw = [187.4, 188.2, 187.8, 187.2, 186.9, 186.5, 186.0, 186.2, 185.8, 185.4, 185.6, 185.0];
  return (
    <PhoneFrame>
      <div style={{ padding: '12px 20px 110px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingTop: 4 }}>
          <div>
            <Eyebrow>Week 3 · Day 1 · Mon</Eyebrow>
            <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', marginTop: 6 }}>Mon, May 11</div>
          </div>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: BP.surface, border: `1px solid ${BP.borderSoft}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: BP.textMuted,
            fontFamily: BP.mono, fontWeight: 600, fontSize: 13,
          }}>JD</div>
        </div>

        {/* Today's session — hero card */}
        <div style={{
          marginTop: 22,
          background: BP.surface, borderRadius: 22,
          border: `1px solid ${BP.borderSoft}`,
          padding: 20, position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160,
            background: 'radial-gradient(circle, rgba(255,47,47,0.12), transparent 70%)' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Pill>Today</Pill>
              <span style={{ fontSize: 12, color: BP.textMuted }}>≈ 48 min</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, marginTop: 14, letterSpacing: '-0.025em', lineHeight: 1.1 }}>
              Upper A
            </div>
            <div style={{ fontSize: 14, color: BP.textMuted, marginTop: 4 }}>Heavy bench · 5 × 5 @ 80%</div>

            <div style={{ display: 'flex', gap: 16, marginTop: 16, alignItems: 'center' }}>
              <ExerciseChip label="Bench" main="235" sub="× 5 × 5" />
              <ExerciseChip label="Row" main="155" sub="× 8 × 4" />
              <ExerciseChip label="OHP" main="115" sub="× 6 × 3" />
            </div>

            <div style={{ marginTop: 20 }}>
              <BigButton kind="primary" height={64} icon={
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 2l11 6-11 6V2z" fill="#fff"/></svg>
              }>Start workout</BigButton>
            </div>
          </div>
        </div>

        {/* Lifts row */}
        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: '0 2px' }}>
            <Eyebrow>Training maxes</Eyebrow>
            <span style={{ fontSize: 11, color: BP.textDim }}>tap to see history</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 8 }}>
            <StatCard
              label="Bench"
              value={benchTM}
              sub={benchSub}
              accent={highlight ? BP.accent : BP.text}
              style={highlight ? { border: `1px solid ${BP.accentLine}`, background: 'linear-gradient(180deg, rgba(255,47,47,0.08), rgba(255,47,47,0) 60%), #141414' } : undefined}
            />
            <StatCard label="Squat" value="365" sub="1RM" />
            <StatCard label="Deadlift" value="445" sub="1RM" />
          </div>
        </div>

        {/* Bodyweight card */}
        <div style={{ marginTop: 16 }}>
          <Card>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <Eyebrow>Bodyweight · 4 wk</Eyebrow>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 8 }}>
                  <Mono style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>185.0</Mono>
                  <Mono style={{ fontSize: 12, color: BP.textDim }}>lb</Mono>
                  <Mono style={{ fontSize: 12, color: BP.green, marginLeft: 8 }}>−2.4</Mono>
                </div>
              </div>
              <Sparkline data={bw} width={150} height={48} />
            </div>
            <button style={{
              width: '100%', marginTop: 14, height: 44,
              background: 'transparent', border: `1px solid ${BP.border}`,
              borderRadius: 12, color: BP.text, fontFamily: BP.font, fontSize: 14, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 18, lineHeight: 0, color: BP.textMuted }}>＋</span>
              Log weight
            </button>
          </Card>
        </div>
      </div>
      <BottomNav active="home" />
    </PhoneFrame>
  );
}

function ExerciseChip({ label, main, sub }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <div style={{ fontSize: 11, color: BP.textDim, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <Mono style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>{main}</Mono>
        <Mono style={{ fontSize: 11, color: BP.textDim }}>{sub}</Mono>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Lifts — TM history for one of bench/squat/deadlift
// ─────────────────────────────────────────────────────────────
function LiftsScreen() {
  const [tab, setTab] = React.useState('bench');
  const tabs = ['bench', 'squat', 'deadlift'];
  const data = {
    bench:    { current: 295, history: [{ d: 'May 2',  bump: '+10', note: 'AMRAP · 13 reps @ 80%' }, { d: 'Apr 11', bump: '+5',  note: 'AMRAP · 10 reps @ 80%' }, { d: 'Mar 28', bump: '+5',  note: 'AMRAP · 9 reps @ 80%' }, { d: 'Mar 7',  bump: '+10', note: 'AMRAP · 12 reps @ 80%' }, { d: 'Feb 18', bump: '+5',  note: 'AMRAP · 11 reps @ 80%' }], series: [260, 265, 265, 270, 275, 275, 280, 285, 285, 290, 295] },
    squat:    { current: 365, history: [{ d: 'Apr 28', bump: '+10', note: 'AMRAP · 12 reps @ 80%' }, { d: 'Apr 7',  bump: '+10', note: 'AMRAP · 13 reps @ 80%' }], series: [330, 340, 345, 350, 355, 355, 360, 360, 365, 365, 365] },
    deadlift: { current: 445, history: [{ d: 'May 5',  bump: '+10', note: 'AMRAP · 12 reps @ 80%' }, { d: 'Apr 14', bump: '+5',  note: 'AMRAP · 9 reps @ 80%' }],  series: [410, 415, 420, 425, 425, 430, 435, 440, 440, 445, 445] },
  };
  const d = data[tab];
  return (
    <PhoneFrame>
      <div style={{ padding: '12px 20px 110px' }}>
        <Eyebrow style={{ paddingTop: 4 }}>Training maxes</Eyebrow>
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', marginTop: 4, marginBottom: 18 }}>Lifts</div>

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: 4,
          background: BP.surface, padding: 4, borderRadius: 12,
          border: `1px solid ${BP.borderSoft}`,
        }}>
          {tabs.map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, height: 38, borderRadius: 9, border: 'none',
              background: tab === t ? BP.surface2 : 'transparent',
              color: tab === t ? BP.text : BP.textMuted,
              fontFamily: BP.font, fontSize: 14, fontWeight: 600,
              cursor: 'pointer', textTransform: 'capitalize',
              boxShadow: tab === t ? '0 1px 2px rgba(0,0,0,0.4)' : 'none',
            }}>{t}</button>
          ))}
        </div>

        {/* Big TM */}
        <div style={{ marginTop: 22, textAlign: 'left' }}>
          <Eyebrow>Current TM</Eyebrow>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
            <Mono style={{ fontSize: 64, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 0.95 }}>{d.current}</Mono>
            <Mono style={{ fontSize: 18, color: BP.textDim, fontWeight: 500 }}>lb</Mono>
          </div>
        </div>

        {/* Chart */}
        <div style={{
          marginTop: 24, padding: '18px 16px 14px',
          background: BP.surface, borderRadius: 18, border: `1px solid ${BP.borderSoft}`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Eyebrow>14 weeks</Eyebrow>
            <Mono style={{ fontSize: 11, color: BP.green }}>+35 lb</Mono>
          </div>
          <TMChart data={d.series} />
        </div>

        {/* History */}
        <div style={{ marginTop: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 2px 12px' }}>
            <Eyebrow>History</Eyebrow>
            <span style={{ fontSize: 11, color: BP.textDim, fontFamily: BP.mono }}>{d.history.length} bumps</span>
          </div>
          <div style={{ background: BP.surface, borderRadius: 16, border: `1px solid ${BP.borderSoft}`, overflow: 'hidden' }}>
            {d.history.map((h, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                borderBottom: i < d.history.length - 1 ? `1px solid ${BP.borderSoft}` : 'none',
              }}>
                <Mono style={{
                  fontSize: 14, fontWeight: 700, color: BP.accent,
                  width: 44,
                }}>{h.bump}</Mono>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: BP.text, fontWeight: 500 }}>{h.note}</div>
                  <Mono style={{ fontSize: 11, color: BP.textDim, marginTop: 2 }}>{h.d}</Mono>
                </div>
                <Chevron />
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <BigButton kind="ghost" height={52}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 12l8-8M5 4h5v5" stroke={BP.text} strokeWidth="1.5" strokeLinecap="round"/></svg>
            Manually adjust TM
          </BigButton>
        </div>
      </div>
      <BottomNav active="lifts" />
    </PhoneFrame>
  );
}

function TMChart({ data }) {
  const w = 295, h = 110;
  const min = Math.min(...data) - 5, max = Math.max(...data) + 5;
  const range = max - min;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => [i * step, h - ((v - min) / range) * h]);
  const path = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
  // Fill area
  const area = path + ` L${w},${h} L0,${h} Z`;
  return (
    <svg width="100%" height={h + 24} viewBox={`0 -8 ${w} ${h + 24}`} style={{ marginTop: 10 }}>
      <defs>
        <linearGradient id="tmgrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={BP.accent} stopOpacity="0.35"/>
          <stop offset="1" stopColor={BP.accent} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={area} fill="url(#tmgrad)" />
      <path d={path} stroke={BP.accent} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === pts.length - 1 ? 4 : 2} fill={i === pts.length - 1 ? BP.accent : '#fff'} stroke={BP.accent} strokeWidth={i === pts.length - 1 ? 0 : 1} />
      ))}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// Settings
// ─────────────────────────────────────────────────────────────
function SettingsScreen() {
  const [units, setUnits] = React.useState(true); // true = lb
  return (
    <PhoneFrame>
      <div style={{ padding: '12px 20px 110px' }}>
        <Eyebrow style={{ paddingTop: 4 }}>Account</Eyebrow>
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', marginTop: 4, marginBottom: 18 }}>Settings</div>

        <SettingsGroup label="Units">
          <SettingsRow title="Weight units">
            <div style={{ display: 'flex', gap: 4, background: BP.surface2, padding: 3, borderRadius: 8 }}>
              {['lb', 'kg'].map((u, i) => {
                const on = (units && i === 0) || (!units && i === 1);
                return (
                  <button key={u} onClick={() => setUnits(i === 0)} style={{
                    height: 28, padding: '0 12px', borderRadius: 6, border: 'none',
                    background: on ? BP.accent : 'transparent',
                    color: on ? '#fff' : BP.textMuted,
                    fontFamily: BP.mono, fontSize: 12, fontWeight: 700,
                    cursor: 'pointer',
                  }}>{u.toUpperCase()}</button>
                );
              })}
            </div>
          </SettingsRow>
        </SettingsGroup>

        <SettingsGroup label="Logging">
          <SettingsRow title="Log bodyweight" sub="Today: 185.0 lb"><Chevron /></SettingsRow>
          <SettingsRow title="Default rest — main lifts" sub="3 minutes"><Chevron /></SettingsRow>
          <SettingsRow title="Default rest — accessories" sub="90 seconds" last><Chevron /></SettingsRow>
        </SettingsGroup>

        <SettingsGroup label="Program">
          <SettingsRow title="Current program" sub="14-week strength block · Wk 3"><Chevron /></SettingsRow>
          <SettingsRow title="Restart from week 1" sub="All bumps preserved" last><Chevron /></SettingsRow>
        </SettingsGroup>

        <SettingsGroup label="">
          <SettingsRow title="Reset program" danger last><Chevron color={BP.accent} /></SettingsRow>
        </SettingsGroup>

        <SettingsGroup label="">
          <SettingsRow title="Sign out" danger last />
        </SettingsGroup>

        <div style={{ textAlign: 'center', marginTop: 28, color: BP.textFaint, fontSize: 11, fontFamily: BP.mono }}>
          BenchPilot v1.0 · 5/3/1 derived
        </div>
      </div>
      <BottomNav active="settings" />
    </PhoneFrame>
  );
}

function SettingsGroup({ label, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      {label && <div style={{ fontSize: 11, color: BP.textDim, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase', padding: '0 6px 8px' }}>{label}</div>}
      <div style={{ background: BP.surface, borderRadius: 16, border: `1px solid ${BP.borderSoft}`, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}

function SettingsRow({ title, sub, children, last, danger }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', minHeight: 56, padding: '10px 16px',
      borderBottom: last ? 'none' : `1px solid ${BP.borderSoft}`,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, color: danger ? BP.accent : BP.text, fontWeight: 500 }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: BP.textDim, marginTop: 2 }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Manual TM adjust dialog
// ─────────────────────────────────────────────────────────────
function ManualTMDialog() {
  return (
    <PhoneFrame>
      <DashboardScreen />
      {/* Backdrop */}
      <div style={{
        position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(8px)', zIndex: 100,
      }} />
      {/* Dialog */}
      <div style={{
        position: 'absolute', left: 16, right: 16, bottom: 36,
        background: '#1a1a1a', borderRadius: 24, padding: 24, zIndex: 101,
        border: `1px solid ${BP.border}`,
        boxShadow: '0 -20px 60px rgba(0,0,0,0.6)',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: '#444', margin: '0 auto 18px' }} />
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase', color: BP.textDim }}>Bench TM</div>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 6 }}>Adjust manually?</div>
        <div style={{ fontSize: 14, color: BP.textMuted, marginTop: 10, lineHeight: 1.45 }}>
          BenchPilot bumps your TM automatically based on AMRAP performance. Manual edits skip the rule and may lead to overreach.
        </div>
        <div style={{
          marginTop: 18, padding: 16, background: '#0d0d0d', borderRadius: 14,
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <button style={{
            width: 44, height: 44, borderRadius: 22, border: `1px solid ${BP.border}`,
            background: 'transparent', color: BP.text, fontSize: 20, fontFamily: BP.mono, fontWeight: 700, cursor: 'pointer',
          }}>−</button>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <Mono style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.03em' }}>295</Mono>
            <Mono style={{ fontSize: 13, color: BP.textDim, marginLeft: 4 }}>lb</Mono>
          </div>
          <button style={{
            width: 44, height: 44, borderRadius: 22, border: `1px solid ${BP.border}`,
            background: 'transparent', color: BP.text, fontSize: 20, fontFamily: BP.mono, fontWeight: 700, cursor: 'pointer',
          }}>＋</button>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <BigButton kind="dark" height={56} style={{ flex: 1 }}>Cancel</BigButton>
          <BigButton kind="primary" height={56} style={{ flex: 1.4 }}>Save TM</BigButton>
        </div>
      </div>
    </PhoneFrame>
  );
}

Object.assign(window, {
  SignInScreen, DashboardScreen, LiftsScreen, SettingsScreen, ManualTMDialog, BPLogo,
});
