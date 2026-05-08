// BenchPilot — Active workout screens, rest timer, AMRAP TM bump modal.
// This is the hero file.

// ─────────────────────────────────────────────────────────────
// Plate calculator chip — collapsible
// ─────────────────────────────────────────────────────────────
function PlateChip({ weight, expanded = false }) {
  const plates = calcPlates(weight);
  const summary = plates.length
    ? plates.map(p => p % 1 === 0 ? p : p.toFixed(1)).join(' + ') + ' / side'
    : 'Bar only';
  return (
    <div style={{
      background: BP.surface, borderRadius: 14, padding: '12px 14px',
      border: `1px solid ${BP.borderSoft}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: BP.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {/* tiny plate icon */}
          <svg width="16" height="16" viewBox="0 0 16 16">
            <rect x="1" y="3" width="2" height="10" rx="0.5" fill={BP.textMuted}/>
            <rect x="13" y="3" width="2" height="10" rx="0.5" fill={BP.textMuted}/>
            <rect x="3.5" y="6" width="9" height="4" rx="0.5" fill={BP.textMuted}/>
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: BP.textDim, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>Plates · 45 lb bar</div>
          <Mono style={{ fontSize: 13, fontWeight: 600, color: BP.text, marginTop: 2 }}>{summary}</Mono>
        </div>
        <Chevron dir={expanded ? 'down' : 'right'} />
      </div>
      {expanded && (
        <div style={{
          marginTop: 12, paddingTop: 12, borderTop: `1px solid ${BP.borderSoft}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0,
        }}>
          <PlateStack plates={plates} />
        </div>
      )}
    </div>
  );
}

function PlateStack({ plates }) {
  // Render a barbell with plates per side. Mirror left/right.
  const colors = { 45: '#3a4960', 35: '#5a3030', 25: '#3a3a3a', 10: '#2d2d2d', 5: '#202020', 2.5: '#1a1a1a' };
  const sizes = { 45: 56, 35: 48, 25: 42, 10: 32, 5: 26, 2.5: 22 };
  const widths = { 45: 8, 35: 8, 25: 7, 10: 6, 5: 5, 2.5: 4 };
  const left = [...plates].reverse(); // big plates innermost
  const right = plates;
  const Plate = ({ p }) => (
    <div style={{
      width: widths[p], height: sizes[p],
      background: colors[p], borderRadius: 2,
      border: '1px solid rgba(255,255,255,0.1)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: BP.mono, fontSize: 8, color: BP.text, opacity: 0.85,
    }}/>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      {/* sleeve */}
      <div style={{ width: 18, height: 6, background: '#3a3a3a', borderRadius: '2px 0 0 2px' }} />
      {left.map((p, i) => <div key={'l' + i} style={{ marginLeft: 1 }}><Plate p={p} /></div>)}
      {/* bar */}
      <div style={{ width: 36, height: 4, background: '#444' }} />
      {right.map((p, i) => <div key={'r' + i} style={{ marginRight: 1 }}><Plate p={p} /></div>)}
      <div style={{ width: 18, height: 6, background: '#3a3a3a', borderRadius: '0 2px 2px 0' }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Reps stepper — big number + −/+ buttons
// ─────────────────────────────────────────────────────────────
function RepsStepper({ value, onChange, placeholder = '—', dim }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'stretch', gap: 0,
      background: BP.surface, borderRadius: 18,
      border: `1px solid ${BP.borderSoft}`, overflow: 'hidden',
    }}>
      <button onClick={() => onChange && onChange(Math.max(0, (value || 0) - 1))} style={{
        width: 64, background: 'transparent', border: 'none', color: BP.text,
        fontSize: 28, fontFamily: BP.mono, fontWeight: 600, cursor: 'pointer',
      }}>−</button>
      <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 6, padding: '14px 0' }}>
        <Mono style={{
          fontSize: 44, fontWeight: 800, letterSpacing: '-0.04em',
          color: value == null ? BP.textFaint : BP.text,
        }}>{value == null ? placeholder : value}</Mono>
        <Mono style={{ fontSize: 14, fontWeight: 500, color: BP.textDim }}>reps</Mono>
      </div>
      <button onClick={() => onChange && onChange((value || 0) + 1)} style={{
        width: 64, background: 'transparent', border: 'none', color: BP.text,
        fontSize: 28, fontFamily: BP.mono, fontWeight: 600, cursor: 'pointer',
      }}>＋</button>
    </div>
  );
}

// RIR slider (0–4)
function RIRPicker({ value = 2, onChange }) {
  return (
    <div style={{
      background: BP.surface, borderRadius: 14, padding: '12px 14px 14px',
      border: `1px solid ${BP.borderSoft}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: BP.textDim, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>RIR · reps in reserve</div>
        <Mono style={{ fontSize: 14, color: BP.text, fontWeight: 700 }}>{value}</Mono>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {[0, 1, 2, 3, 4, '4+'].map((n, i) => {
          const active = i === value || (n === '4+' && value === 5);
          return (
            <button key={n} onClick={() => onChange && onChange(n === '4+' ? 5 : i)} style={{
              flex: 1, height: 46, borderRadius: 10, border: 'none',
              background: active ? BP.accent : BP.surface2,
              color: active ? '#fff' : BP.textMuted,
              fontFamily: BP.mono, fontSize: 14, fontWeight: 700,
              cursor: 'pointer', transition: 'background 0.12s',
            }}>{n}</button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Workout screen header — session name + set dots + close
// ─────────────────────────────────────────────────────────────
function WorkoutHeader({ session, dotTotal, dotDone }) {
  return (
    <div style={{ padding: '8px 20px 14px', display: 'flex', alignItems: 'center', gap: 14 }}>
      <button style={{
        width: 36, height: 36, borderRadius: 10, border: `1px solid ${BP.borderSoft}`,
        background: BP.surface, color: BP.textMuted, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
      </button>
      <div style={{ flex: 1, textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: BP.textDim, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase' }}>{session.split(' · ')[0]}</div>
        <div style={{ fontSize: 14, color: BP.text, fontWeight: 600, marginTop: 1 }}>{session.split(' · ')[1] || ''}</div>
      </div>
      <Mono style={{
        fontSize: 12, color: BP.textMuted, fontWeight: 600,
        background: BP.surface, padding: '6px 10px', borderRadius: 8,
        border: `1px solid ${BP.borderSoft}`,
      }}>14:32</Mono>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Active workout — AMRAP set (the hero screen)
// variant: 'idle' | 'logged' (shows rest banner)
// ─────────────────────────────────────────────────────────────
function WorkoutAMRAPScreen({ variant = 'idle', expandPlates = false, prefillReps = null }) {
  const [reps, setReps] = React.useState(prefillReps);
  const weight = 215;
  const logged = variant === 'logged';
  return (
    <PhoneFrame>
      <div style={{ paddingTop: 4 }}>
        <WorkoutHeader session="Upper C · Bench AMRAP" dotTotal={5} dotDone={4} />

        {/* Set progress */}
        <div style={{ padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Pill>AMRAP</Pill>
            <span style={{ fontSize: 13, color: BP.textMuted }}>Bench · 1 × max</span>
          </div>
          <StepDots total={5} done={4} accent={BP.accent} />
        </div>

        {/* Massive weight */}
        <div style={{ padding: '0 20px', textAlign: 'center', marginTop: 4 }}>
          <Eyebrow>Top set · 80% TM</Eyebrow>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 10, marginTop: 8, lineHeight: 0.85 }}>
            <Mono style={{
              fontSize: 148, fontWeight: 800, letterSpacing: '-0.06em',
              color: BP.text,
              textShadow: '0 0 60px rgba(255,47,47,0.18)',
            }}>{weight}</Mono>
            <Mono style={{ fontSize: 28, fontWeight: 600, color: BP.textDim, marginBottom: 12 }}>lb</Mono>
          </div>
          <div style={{ marginTop: 10, fontSize: 14, color: BP.textMuted }}>
            Last time: <Mono style={{ color: BP.text, fontWeight: 600 }}>12 reps</Mono> @ 210 lb
          </div>
        </div>

        {/* Plate calc */}
        <div style={{ padding: '24px 20px 0' }}>
          <PlateChip weight={weight} expanded={expandPlates} />
        </div>

        {/* Reps input */}
        <div style={{ padding: '16px 20px 0' }}>
          <div style={{ fontSize: 12, color: BP.textDim, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>
            Reps performed
          </div>
          <RepsStepper value={reps} onChange={setReps} placeholder="—" />
        </div>

        {/* Weight override (collapsed link) */}
        <div style={{ padding: '12px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: BP.textMuted }}>Weight: <Mono style={{ color: BP.text, fontWeight: 600 }}>{weight} lb</Mono></span>
          <button style={{
            background: 'transparent', border: 'none', color: BP.accent,
            fontFamily: BP.font, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>Override</button>
        </div>

        {/* CTA */}
        <div style={{ padding: '20px 20px 0' }}>
          <BigButton kind="primary" height={64}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 9l4 4 8-9" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Log AMRAP set
          </BigButton>
        </div>

        <div style={{ height: logged ? 130 : 60 }} />
      </div>

      {/* Rest timer banner (logged variant) */}
      {logged && <RestBanner remaining="2:14" total={180} />}
    </PhoneFrame>
  );
}

// ─────────────────────────────────────────────────────────────
// Active workout — Standard working set
// ─────────────────────────────────────────────────────────────
function WorkoutStandardScreen({ setNum = 3, totalSets = 5, prefilledReps = 5, rir = 2, variant = 'idle' }) {
  const [reps, setReps] = React.useState(prefilledReps);
  const [rirVal, setRir] = React.useState(rir);
  const weight = 215;
  const logged = variant === 'logged';
  return (
    <PhoneFrame>
      <div style={{ paddingTop: 4 }}>
        <WorkoutHeader session={`Upper A · Heavy Bench`} dotTotal={totalSets} dotDone={setNum - 1} />

        <div style={{ padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <div>
            <span style={{ fontSize: 13, color: BP.textMuted }}>Bench · </span>
            <Mono style={{ fontSize: 13, color: BP.text, fontWeight: 600 }}>Set {setNum} of {totalSets}</Mono>
          </div>
          <StepDots total={totalSets} done={setNum - 1} accent={BP.accent} />
        </div>

        <div style={{ padding: '0 20px', textAlign: 'center' }}>
          <Eyebrow>Working set · 80% TM</Eyebrow>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 10, marginTop: 8, lineHeight: 0.85 }}>
            <Mono style={{ fontSize: 132, fontWeight: 800, letterSpacing: '-0.05em' }}>{weight}</Mono>
            <Mono style={{ fontSize: 26, fontWeight: 600, color: BP.textDim, marginBottom: 10 }}>lb</Mono>
          </div>
          <div style={{ marginTop: 8, fontSize: 14, color: BP.textMuted }}>
            Prescribed: <Mono style={{ color: BP.text, fontWeight: 600 }}>5 reps</Mono> · RPE ~7
          </div>
        </div>

        <div style={{ padding: '20px 20px 0' }}>
          <PlateChip weight={weight} />
        </div>

        <div style={{ padding: '14px 20px 0' }}>
          <div style={{ fontSize: 12, color: BP.textDim, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>
            Reps performed
          </div>
          <RepsStepper value={reps} onChange={setReps} />
        </div>

        <div style={{ padding: '12px 20px 0' }}>
          <RIRPicker value={rirVal} onChange={setRir} />
        </div>

        <div style={{ padding: '16px 20px 0' }}>
          <BigButton kind="primary" height={64}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 9l4 4 8-9" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Log set
          </BigButton>
        </div>
        <div style={{ height: logged ? 130 : 60 }} />
      </div>
      {logged && <RestBanner remaining="2:48" total={180} nextSet={`Set ${setNum + 1} · 215 × 5`} />}
    </PhoneFrame>
  );
}

// ─────────────────────────────────────────────────────────────
// Rest banner (slim, anchored bottom)
// ─────────────────────────────────────────────────────────────
function RestBanner({ remaining = '2:14', total = 180, nextSet = 'AMRAP done · Squat next' }) {
  const [m, s] = remaining.split(':');
  const elapsed = total - (parseInt(m, 10) * 60 + parseInt(s, 10));
  const pct = Math.max(0, Math.min(1, elapsed / total));
  return (
    <div style={{
      position: 'absolute', left: 16, right: 16, bottom: 36,
      background: '#181818', borderRadius: 18, padding: 14,
      border: `1px solid ${BP.border}`,
      boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
      zIndex: 30,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <RestRing pct={pct} size={56} accent={BP.accent} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <Eyebrow>Rest</Eyebrow>
            <Mono style={{ fontSize: 11, color: BP.textDim }}>of 3:00</Mono>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <Mono style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>{remaining}</Mono>
          </div>
          <div style={{ fontSize: 11, color: BP.textDim, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nextSet}</div>
        </div>
        <button style={{
          height: 40, padding: '0 14px', borderRadius: 10,
          background: BP.surface2, border: `1px solid ${BP.border}`, color: BP.text,
          fontFamily: BP.font, fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>Skip</button>
      </div>
    </div>
  );
}

function RestRing({ pct, size = 56, accent = BP.accent }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke={BP.border} strokeWidth="3" fill="none" />
      <circle cx={size / 2} cy={size / 2} r={r} stroke={accent} strokeWidth="3" fill="none"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// Full-screen rest timer
// ─────────────────────────────────────────────────────────────
function RestTimerScreen() {
  const total = 180;
  const remaining = 134;
  const pct = (total - remaining) / total;
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  return (
    <PhoneFrame>
      <div style={{ position: 'absolute', inset: 0, paddingTop: 44, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Eyebrow>Resting</Eyebrow>
            <div style={{ fontSize: 13, color: BP.textMuted, marginTop: 2 }}>Upper A · Bench</div>
          </div>
          <button style={{
            width: 36, height: 36, borderRadius: 10, border: `1px solid ${BP.borderSoft}`,
            background: BP.surface, color: BP.textMuted, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>

        {/* Big ring */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <BigRing pct={pct} size={300} stroke={14} accent={BP.accent}>
            <Mono style={{ fontSize: 80, fontWeight: 800, letterSpacing: '-0.05em', lineHeight: 1 }}>
              {m}:{String(s).padStart(2, '0')}
            </Mono>
            <div style={{ marginTop: 8, fontSize: 13, color: BP.textDim, fontWeight: 500 }}>of 3:00</div>
          </BigRing>
        </div>

        {/* Next set preview */}
        <div style={{ padding: '0 20px 20px' }}>
          <div style={{
            background: BP.surface, borderRadius: 18, padding: 18,
            border: `1px solid ${BP.borderSoft}`,
          }}>
            <Eyebrow>Up next · Set 4 of 5</Eyebrow>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 8 }}>
              <Mono style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.03em' }}>215</Mono>
              <Mono style={{ fontSize: 16, color: BP.textDim }}>lb</Mono>
              <Mono style={{ fontSize: 16, color: BP.textMuted, marginLeft: 'auto' }}>× 5</Mono>
            </div>
            <div style={{ fontSize: 12, color: BP.textDim, fontFamily: BP.mono, marginTop: 6 }}>45 + 25 + 10 + 5 / side</div>
          </div>
        </div>

        <div style={{ padding: '0 20px 60px', display: 'flex', gap: 10 }}>
          <BigButton kind="dark" height={56} style={{ flex: 1 }}>+30s</BigButton>
          <BigButton kind="ghost" height={56} style={{ flex: 1.6, background: BP.surface2, border: 'none' }}>Skip rest</BigButton>
        </div>
      </div>
    </PhoneFrame>
  );
}

function BigRing({ pct, size = 300, stroke = 14, accent = BP.accent, children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <linearGradient id="ringgrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={accent}/>
            <stop offset="1" stopColor="#FF6B47"/>
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={BP.border} strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke="url(#ringgrad)" strokeWidth={stroke} fill="none"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div style={{ position: 'relative', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// AMRAP TM Bump modal — overlays the AMRAP screen
// ─────────────────────────────────────────────────────────────
function AMRAPBumpModal() {
  return (
    <PhoneFrame>
      {/* Background screen */}
      <div style={{ position: 'absolute', inset: 0, paddingTop: 44 }}>
        <WorkoutHeader session="Upper C · Bench AMRAP" dotTotal={5} dotDone={5} />
        <div style={{ padding: '0 20px', textAlign: 'center', marginTop: 30, opacity: 0.4 }}>
          <Mono style={{ fontSize: 96, fontWeight: 800, letterSpacing: '-0.05em' }}>215</Mono>
        </div>
      </div>

      {/* Backdrop */}
      <div style={{
        position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(10px)', zIndex: 100,
      }} />

      {/* Sheet */}
      <div style={{
        position: 'absolute', left: 12, right: 12, bottom: 28, zIndex: 101,
        background: 'linear-gradient(180deg, #1a1a1a 0%, #141414 100%)',
        borderRadius: 28, padding: '20px 22px 22px',
        border: `1px solid ${BP.border}`,
        boxShadow: '0 -30px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,47,47,0.15)',
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: '#3a3a3a', margin: '0 auto 14px' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Pill>+10 lb bump</Pill>
          <Eyebrow>Bench TM</Eyebrow>
        </div>

        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.2 }}>
          You hit <Mono style={{ color: BP.accent }}>13 reps</Mono> at 80% TM
        </div>
        <div style={{ fontSize: 14, color: BP.textMuted, marginTop: 8, lineHeight: 1.5 }}>
          That puts your projected 1RM around 290 lb — your training max moves up.
        </div>

        {/* Before / after */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          marginTop: 22, padding: 18, borderRadius: 18,
          background: '#0d0d0d', border: `1px solid ${BP.borderSoft}`,
        }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <Eyebrow>Was</Eyebrow>
            <Mono style={{ fontSize: 30, fontWeight: 700, color: BP.textMuted, marginTop: 4, display: 'block', letterSpacing: '-0.02em' }}>285</Mono>
            <Mono style={{ fontSize: 11, color: BP.textDim }}>lb</Mono>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40 }}>
            <svg width="24" height="20" viewBox="0 0 24 20" fill="none"><path d="M3 10h17m0 0l-6-6m6 6l-6 6" stroke={BP.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <Eyebrow style={{ color: BP.accent, opacity: 0.9 }}>New</Eyebrow>
            <Mono style={{ fontSize: 38, fontWeight: 800, color: BP.text, marginTop: 4, display: 'block', letterSpacing: '-0.03em' }}>295</Mono>
            <Mono style={{ fontSize: 11, color: BP.textDim }}>lb</Mono>
          </div>
        </div>

        {/* Rule */}
        <div style={{
          marginTop: 14, padding: '10px 14px',
          background: 'rgba(255,255,255,0.025)', borderRadius: 10,
          fontSize: 12, color: BP.textMuted, fontFamily: BP.mono,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ color: BP.textDim }}>RULE</span>
          <span>9–11 reps → +5 lb · &gt;11 reps → +10 lb</span>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 18 }}>
          <BigButton kind="primary" height={60}>Apply new TM</BigButton>
          <BigButton kind="dark" height={52}>Hold for now</BigButton>
        </div>
      </div>
    </PhoneFrame>
  );
}

Object.assign(window, {
  WorkoutAMRAPScreen, WorkoutStandardScreen, RestTimerScreen, AMRAPBumpModal,
  PlateChip, RepsStepper, RIRPicker, WorkoutHeader, RestBanner, BigRing,
});
