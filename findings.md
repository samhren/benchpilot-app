# Findings

## Spec ambiguities resolved
- Session lib: `jose` (lightweight JWT) instead of iron-session.
- Wave loading e.g. "50/60/70/80% × 8/6/4×2/3×2" interpreted as parallel arrays of (pct, reps) pairs; "4×2" = 4 reps × 2 sets. We'll model as ordered prescription rows.
- "75% × 5×5" = 5 sets × 5 reps at 75% TM.
- Squat / deadlift TM: spec only mandates bench TM auto-bumps. Squat lower-A is "75% 1RM linear progression" — store current_1rm and add ad-hoc.
- TM rounding: nearest 5 lb.

## Wave loading prescriptions parsed

Mon (Heavy):
- W1: 5 sets × 5 reps @ 75%
- W2: 3 sets × 4 reps @ 80%; 6 sets × 3 reps @ 75%
- W3: 4 sets × 3 reps @ 85%; 8 sets × 3 reps @ 75%
- W4 (deload): 2 sets × 3 reps @ 80%; 5 sets × 3 reps @ 75%

Wed (Volume wave) — sequential sets:
- W1: 8@50, 6@60, 4@70, 2×2@80 (i.e., 2 sets of 2 @80) — interpreting "8/6/4×2/3×2" as: 1 set 8@50, 1 set 6@60, 1 set 4×2 means "4 then 2"? Re-read: "50/60/70/80% × 8/6/4×2/3×2". Best interpretation: 50%×8, 60%×6, 70%×4, 80%×2, 80%×2, 80%×3?? Ambiguous. Going with: each pct/rep paired left-to-right, "Nx2" = N reps × 2 sets:
  - W1: 50%×8, 60%×6, 70%×4 (×2 sets), 80%×3 (×2 sets) — 6 working sets
  - W2: 50%×8, 60%×6, 60%×6, 70%×5, 70%×5, 75%×4, 75%×4, 80%×3, 80%×3, 80%×3
  - W3: 50%×8, 60%×6, 60%×6, 70%×5, 70%×5, 80%×3, 80%×3, 90%×1, 90%×1
  - W4 deload: 50%×5, 60%×4, 70%×3, 75%×3, 80%×2

Fri:
- W1/W2/W3 of each block: 80% × 1 × AMRAP
- W4 of each block: 85% × 1 × AMRAP (Block 3 = optional 1RM test)

Wk13 deload:
- Mon bench: 60% × 5 sets × 3 reps
- Wed bench: skip
- Fri bench: 70% × 3 sets × 3 reps

Wk14 test:
- Mon: 70% × 3 sets × 3 reps (primer)
- Wed: 1RM test (warmups: 50%×5, 70%×3, 80%×1, 90%×1, 95%×1, attempt)

## Design system (from ./design/)
Source: Claude Design bundle, primitives.jsx + dashboard/workout/program JSX. Pixel-recreate, do not copy structure.

**Palette (CSS vars in dark mode):**
- bg `#0a0a0a`, surface `#141414`, surface2 `#1c1c1c`
- border `#262626`, borderSoft `#1f1f1f`
- text `#ffffff`, textMuted `rgba(255,255,255,0.58)`, textDim `rgba(255,255,255,0.34)`, textFaint `rgba(255,255,255,0.18)`
- accent `#FF2F2F` (powerlifting red — AMRAP / log / commit), accentSoft `rgba(255,47,47,0.14)`, accentLine `rgba(255,47,47,0.4)`
- green `#2BD05F` (rare, completed), amber `#FFB020` (rare)

**Typography:**
- UI: Inter Tight, letterSpacing -0.005em base, -0.03em on big numbers
- Numerals/Mono: JetBrains Mono, tabular-nums, used for all weights/reps/timers
- Eyebrow: 11px, weight 600, letter-spacing 1.4px, uppercase, textDim
- Section title: 13px 600 0.6 uppercase textMuted
- Big numbers: 132–148px on workout, 64px on TM, 28px on dashboard stats

**Layout:**
- Mobile-first 375 width target
- Border radius: cards 16–22, buttons 16, pills 999
- Min tap 56–64px; BigButton height 64
- Bottom nav 5 tabs: Home / Workout / Program / Lifts / Settings; active tab uses accent

**Components implied:**
- BigButton (primary red / dark / ghost)
- StatCard, Card, Pill, StepDots, Sparkline
- PlateChip + PlateStack (visual barbell), RepsStepper, RIRPicker
- WorkoutHeader with X close, session label, elapsed time pill
- RestBanner (anchored bottom, ring), full RestTimerScreen with BigRing
- AMRAPBumpModal: pill "+10 lb bump", was/new before-after, rule footer, two-button stack

**Screens (16 mocked):** sign-in, dashboard, lifts (tabbed bench/squat/deadlift + chart + history), settings, program calendar (sticky day header, blocks, current-week red border-left, day chips colored by session type), workout preview, active workout (AMRAP idle/logged, plate calc expanded, standard set), rest timer full screen, AMRAP bump modal, manual TM dialog.

## Stack choices
- pnpm
- Drizzle: postgres-js driver
- shadcn: button, input, card, dialog, badge, separator, label, toast (sonner)
- icons: lucide-react
