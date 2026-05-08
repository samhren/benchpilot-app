// BenchPilot — Program calendar + workout preview.

const SESSION_COLORS = {
  'U-A': BP.accent,
  'U-B': '#ff6b47',
  'U-C': '#ffaa3a',
  'L-A': '#3a8dff',
  'L-B': '#6e6cff',
  'rest': null,
};

// 14-week program: rough mock — 4 lift days + rest days
const PROGRAM = (() => {
  const blocks = [
    { name: 'Block 1 · Foundation', range: 'Weeks 1–4', weeks: 4 },
    { name: 'Block 2 · Build', range: 'Weeks 5–8', weeks: 4 },
    { name: 'Block 3 · Intensify', range: 'Weeks 9–12', weeks: 4 },
    { name: 'Deload', range: 'Week 13', weeks: 1 },
    { name: 'Test', range: 'Week 14', weeks: 1 },
  ];
  const pattern = ['U-A', 'rest', 'L-A', 'rest', 'U-B', 'L-B', 'rest']; // weekly pattern
  const amrapPattern = ['rest', 'rest', 'rest', 'rest', 'U-C', 'rest', 'rest']; // wk-end has C-day in some weeks
  const weeks = [];
  let dayIdx = 0;
  for (let w = 0; w < 14; w++) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      let s = pattern[d];
      // add U-C (AMRAP day) on Friday week 3, etc.
      if (w === 2 && d === 4) s = 'U-C';
      if (w === 12) s = d % 2 === 0 && d < 5 ? 'rest' : 'rest'; // deload all rest
      if (w === 12 && (d === 0 || d === 2 || d === 4)) s = 'U-A';
      if (w === 13 && d === 1) s = 'L-A';
      if (w === 13 && d === 3) s = 'U-A';
      if (w === 13 && d === 5) s = 'rest';
      days.push(s);
      dayIdx++;
    }
    weeks.push(days);
  }
  return { blocks, weeks };
})();

function ProgramScreen() {
  const currentWeek = 2; // 0-indexed → week 3
  const currentDay = 0;  // Monday
  return (
    <PhoneFrame>
      <div style={{ padding: '12px 20px 110px' }}>
        <Eyebrow style={{ paddingTop: 4 }}>14 weeks · 5/3/1 derived</Eyebrow>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 4, marginBottom: 8 }}>
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em' }}>Program</div>
          <Mono style={{ fontSize: 12, color: BP.textMuted, marginBottom: 6 }}>Wk {currentWeek + 1} of 14</Mono>
        </div>

        {/* Day-of-week header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '32px repeat(7, 1fr)', gap: 6,
          padding: '14px 4px 10px', position: 'sticky', top: 0,
          background: BP.bg, zIndex: 10,
          borderBottom: `1px solid ${BP.borderSoft}`, marginBottom: 8,
        }}>
          <div />
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <div key={i} style={{
              fontSize: 11, color: BP.textDim, fontWeight: 600,
              textAlign: 'center', letterSpacing: 0.6,
            }}>{d}</div>
          ))}
        </div>

        {(() => {
          const out = [];
          let weekIdx = 0;
          for (const block of PROGRAM.blocks) {
            out.push(
              <div key={'b' + block.name} style={{ marginTop: weekIdx === 0 ? 0 : 22, marginBottom: 10, padding: '0 4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: BP.text, letterSpacing: '-0.01em' }}>{block.name}</div>
                  <Mono style={{ fontSize: 11, color: BP.textDim }}>{block.range}</Mono>
                </div>
              </div>,
            );
            for (let bw = 0; bw < block.weeks; bw++) {
              const w = weekIdx;
              const isCurrent = w === currentWeek;
              const isPast = w < currentWeek;
              out.push(<WeekRow key={'w' + w} week={w} days={PROGRAM.weeks[w]} currentDay={isCurrent ? currentDay : -1} isPast={isPast} isCurrent={isCurrent} />);
              weekIdx++;
            }
          }
          return out;
        })()}
      </div>
      <BottomNav active="program" />
    </PhoneFrame>
  );
}

function WeekRow({ week, days, currentDay, isPast, isCurrent }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '32px repeat(7, 1fr)', gap: 6,
      padding: '6px 4px',
      borderLeft: isCurrent ? `2px solid ${BP.accent}` : '2px solid transparent',
      paddingLeft: isCurrent ? 8 : 10,
      marginLeft: -10,
      background: isCurrent ? 'linear-gradient(90deg, rgba(255,47,47,0.06), transparent 60%)' : 'transparent',
      borderRadius: 8,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
        fontSize: 12, fontFamily: BP.mono, fontWeight: 600,
        color: isCurrent ? BP.accent : isPast ? BP.textDim : BP.textMuted,
      }}>{String(week + 1).padStart(2, '0')}</div>
      {days.map((s, i) => (
        <DayChip key={i} session={s} state={isPast ? 'done' : i === currentDay && isCurrent ? 'today' : 'future'} />
      ))}
    </div>
  );
}

function DayChip({ session, state }) {
  if (session === 'rest') {
    return (
      <div style={{
        height: 40, borderRadius: 8,
        background: 'transparent', border: `1px dashed ${BP.borderSoft}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ width: 4, height: 4, borderRadius: 2, background: BP.textFaint }} />
      </div>
    );
  }
  const color = SESSION_COLORS[session] || BP.textMuted;
  const isDone = state === 'done';
  const isToday = state === 'today';
  return (
    <div style={{
      height: 40, borderRadius: 8,
      background: isToday ? color : isDone ? 'rgba(255,255,255,0.04)' : BP.surface,
      border: isToday ? 'none' : isDone ? `1px solid ${BP.borderSoft}` : `1px solid ${BP.borderSoft}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
      boxShadow: isToday ? `0 0 0 3px rgba(255,47,47,0.18), 0 0 20px rgba(255,47,47,0.3)` : 'none',
    }}>
      <Mono style={{
        fontSize: 11, fontWeight: 700,
        color: isToday ? '#fff' : isDone ? BP.textDim : color,
        opacity: isDone ? 0.7 : 1,
      }}>{session}</Mono>
      {isDone && (
        <div style={{ position: 'absolute', top: 2, right: 2 }}>
          <Check size={10} color={BP.textDim} />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Workout preview — tap a day from program
// ─────────────────────────────────────────────────────────────
function WorkoutPreviewScreen() {
  const exercises = [
    { name: 'Bench press', main: true, sets: '5 × 5', weight: '215 lb', sub: '75% of 295 = 220 lb (rounded down)', muscle: 'Chest · Triceps' },
    { name: 'Barbell row',   main: false, sets: '4 × 8', weight: '155 lb', sub: 'Pendlay style', muscle: 'Upper back' },
    { name: 'Overhead press', main: false, sets: '3 × 6', weight: '115 lb', sub: 'Strict, no leg drive', muscle: 'Shoulders' },
    { name: 'Chin-up',        main: false, sets: '3 × AMRAP', weight: 'BW', sub: 'Add weight if 12+ reps', muscle: 'Lats · Biceps' },
    { name: 'Triceps pushdown', main: false, sets: '3 × 12', weight: '60 lb', sub: 'Slow eccentric', muscle: 'Triceps' },
  ];
  return (
    <PhoneFrame>
      <div style={{ padding: '12px 20px 130px' }}>
        {/* Back */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, color: BP.textMuted }}>
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M9 3l-4 4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Program</span>
        </div>

        <Eyebrow style={{ paddingTop: 18 }}>Wk 3 · Mon · May 11</Eyebrow>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 6 }}>
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em' }}>Upper A</div>
          <Pill bg={BP.surface} color={BP.accent} style={{ background: BP.accentSoft }}>U-A</Pill>
        </div>
        <div style={{ fontSize: 14, color: BP.textMuted, marginTop: 4 }}>Heavy bench · Chest · Back · Triceps</div>

        {/* Resolved weight callout */}
        <div style={{
          marginTop: 18, padding: 16, borderRadius: 16,
          background: BP.surface, border: `1px solid ${BP.borderSoft}`,
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <div>
            <Eyebrow>Top set</Eyebrow>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 6 }}>
              <Mono style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.03em' }}>215</Mono>
              <Mono style={{ fontSize: 14, color: BP.textDim }}>lb</Mono>
            </div>
            <Mono style={{ fontSize: 11, color: BP.textDim, marginTop: 4, display: 'block' }}>= 75% × 295 TM</Mono>
          </div>
          <div style={{ flex: 1, height: 56, position: 'relative', borderLeft: `1px solid ${BP.borderSoft}`, paddingLeft: 16 }}>
            <Eyebrow>Volume</Eyebrow>
            <Mono style={{ fontSize: 18, fontWeight: 700, marginTop: 6, display: 'block' }}>5,375 lb</Mono>
            <Mono style={{ fontSize: 11, color: BP.textDim, marginTop: 2, display: 'block' }}>5 × 5 working</Mono>
          </div>
        </div>

        {/* Exercises */}
        <div style={{ marginTop: 22 }}>
          <Eyebrow style={{ marginLeft: 4, marginBottom: 10 }}>Exercises · {exercises.length}</Eyebrow>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {exercises.map((e, i) => (
              <div key={i} style={{
                background: BP.surface, borderRadius: 14,
                border: `1px solid ${BP.borderSoft}`,
                padding: '14px 16px',
                display: 'flex', alignItems: 'flex-start', gap: 14,
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: e.main ? BP.accentSoft : BP.surface2,
                  color: e.main ? BP.accent : BP.textMuted,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: BP.mono, fontSize: 12, fontWeight: 700, flexShrink: 0,
                }}>{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{e.name}</div>
                    <Mono style={{ fontSize: 13, fontWeight: 700, color: e.main ? BP.text : BP.textMuted, whiteSpace: 'nowrap' }}>
                      {e.weight}
                    </Mono>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, gap: 8 }}>
                    <div style={{ fontSize: 12, color: BP.textDim }}>{e.muscle}</div>
                    <Mono style={{ fontSize: 12, color: BP.textMuted }}>{e.sets}</Mono>
                  </div>
                  {e.sub && <div style={{ fontSize: 11, color: BP.textFaint, marginTop: 6, fontStyle: 'italic' }}>{e.sub}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sticky CTA */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        padding: '14px 20px 36px',
        background: 'linear-gradient(to top, #0a0a0a 70%, rgba(10,10,10,0))',
      }}>
        <BigButton kind="primary" height={64} icon={
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 2l11 6-11 6V2z" fill="#fff"/></svg>
        }>Start this workout</BigButton>
      </div>
    </PhoneFrame>
  );
}

Object.assign(window, { ProgramScreen, WorkoutPreviewScreen });
