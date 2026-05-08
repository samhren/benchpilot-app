# Build: BenchPilot — Evidence-Based Lifting Tracker

You are building a personal lifting tracker web app for me (Sam). Single user, single password, no signup. Read this entire spec, plan briefly, then execute end-to-end in one pass.

## Mission

Run my 14-week summer training program. The science-based programming logic is the **most important** part — generic gym apps can't do this:

- Bench is programmed as **percentages of a Training Max (TM = 0.9 × current 1RM)** that update across mesocycles based on AMRAP performance.
- The app **resolves percentages to actual prescribed weights at workout time** based on the current TM, and **auto-bumps TM after AMRAP sets per Greg Nuckols' rules**.
- Volume defaults to **2 working sets per accessory exercise** at RIR 1–2 (Krieger 2010, Pelland 2026).
- Running is tracked elsewhere (Strava). Don't build it.

Non-goals: social features, sharing, AI coaching, video form analysis, calorie/nutrition tracking, **running tracking**, multi-user.

## Stack (non-negotiable)

- **Next.js 15** (App Router) + **React 19** + **TypeScript** strict
- **Tailwind CSS** + **shadcn/ui**
- **Postgres 16** in **Docker** (provide `docker-compose.yml`)
- **Drizzle ORM** + `drizzle-kit` for migrations
- **Auth: hardcoded password**. Single env var `APP_PASSWORD`. Sign-in screen has one password field. On submit, set an HTTP-only signed cookie (`iron-session` or just a JWT signed with `SESSION_SECRET`). Middleware gates everything except `/signin`. No NextAuth, no users table, no email.
- **PWA** via `@serwist/next` — installable to iPhone home screen, offline-capable for the active workout view
- **Vitest** for unit tests on the programming math
- **Playwright** for E2E tests, driven via the **Playwright MCP server** during this build to verify the app actually works
- Deploy target: **Vercel** for the app, **Neon** (or any managed Postgres) for production DB

## Database schema (Drizzle)

Single user, so no `users` table. snake_case, plural names.

- `lifts` — id (uuid), name (`'bench_press'` | `'back_squat'` | `'deadlift'` | `'overhead_press'`), current_1rm, training_max, last_tm_bump_at. Used only for percentage-driven main lifts.
- `programs` — id, name, start_date, total_weeks, current_week, current_block, status (`'active'` | `'paused'` | `'completed'`), created_at
- `program_days` — id, program_id, week_number, day_of_week (1–7), session_type (`'upper_a'`, `'lower_a'`, `'upper_b'`, `'upper_c'`, `'lower_b'`, `'rest'`, `'deload'`, `'test'`), display_name. **No running session types.**
- `program_exercises` — id, program_day_id, order_index, exercise_id, prescription_type (`'percentage_tm'` | `'fixed_load'` | `'rir_target'` | `'amrap'`), sets, reps, percentage_of_tm (nullable), rir_target (nullable), is_amrap_top_set (boolean), notes, lift_id (nullable, links to `lifts`)
- `exercises` — id, name, muscle_group, equipment, default_sets, is_main_lift (boolean), notes. Seeded with the full exercise list below.
- `workout_sessions` — id, program_day_id, started_at, completed_at, body_weight_lb, notes, perceived_rir_overall (1–10)
- `workout_sets` — id, session_id, program_exercise_id, exercise_id, set_number, reps_prescribed, reps_completed, weight_prescribed, weight_used, rir, is_amrap, is_warmup, completed_at
- `body_weight_logs` — id, date, weight_lb
- `tm_history` — id, lift_id, training_max, effective_from, reason (`'initial'` | `'amrap_bump'` | `'manual'` | `'reset'`), amrap_reps (nullable), notes

Indexes: workout_sessions(started_at desc); workout_sets(session_id); program_days(program_id, week_number, day_of_week).

## The 14-week program — seed data

On first DB push, seed this exact program. Read carefully — percentages and progression are the science core.

### Program metadata
- Name: "Summer 2026 — Bench-Focused Recomp"
- Total weeks: 14
- Structure: 3 mesocycles (Weeks 1–4, 5–8, 9–12) + Week 13 deload + Week 14 test
- start_date: next Monday from seed time (editable in settings)

### Weekly template (Weeks 1–12)

| Day | Session | Type |
|---|---|---|
| 1 (Mon) | Upper A — Heavy Bench | lifting |
| 2 (Tue) | Lower A — Squat focus | lifting |
| 3 (Wed) | Upper B — Volume Bench + Incline | lifting |
| 4 (Thu) | Rest | rest |
| 5 (Fri) | Upper C — Bench AMRAP + Arms | lifting |
| 6 (Sat) | Lower B — Hinge focus | lifting |
| 7 (Sun) | Rest | rest |

(Thu and Sun are rest days as far as this app cares — I run on those days but Strava handles it.)

### Bench loading — % of TM, where TM = 0.9 × current bench 1RM

Block 1 (Wk 1–4), Block 2 (Wk 5–8), Block 3 (Wk 9–12) — same percentages each block; TM bump rule changes the TM between blocks.

| Day | Wk 1/5/9 | Wk 2/6/10 | Wk 3/7/11 | Wk 4/8/12 (deload) |
|---|---|---|---|---|
| Mon (Heavy) | 75% × 5×5 | 80% × 3×4, then 75% × 6×3 | 85% × 4×3, then 75% × 8×3 | 80% × 2×3, 75% × 5×3 |
| Wed (Volume wave) | 50/60/70/80% × 8/6/4×2/3×2 | 50/60/60/70/70/75/75/80/80/80% × 8/6/6/5/5/4/4/3/3/3 | 50/60/60/70/70/80/80/90/90% × 8/6/6/5/5/3/3/1/1 | 50/60/70/75/80% × 5/4/3/3/2 |
| Fri (AMRAP) | 80% × 1 × AMRAP | 80% × 1 × AMRAP | 80% × 1 × AMRAP | 85% × 1 × AMRAP **OR** 1RM test (Block 3 only) |

**TM bump rule (after Friday AMRAP at 80% TM, applies end of Wk 3, 7, 11):**
- AMRAP < 8 reps → hold TM
- AMRAP exactly 8 → hold (treat as edge case; log warning)
- AMRAP 9–11 reps → TM += 5 lb
- AMRAP > 11 reps → TM += 10 lb

The bumped TM is used for the next block.

**Week 13 deload:** Mon bench 60% × 3×5; skip Wed bench; Fri bench 70% × 3×3. Accessories: 1 set RIR 3.

**Week 14 test:** Mon light primer (bench 70% × 3×3). **Wed: bench 1RM test** (warm-up: 50% × 5, 70% × 3, 80% × 1, 90% × 1, 95% × 1, attempt). Optional squat 1RM after. Fri optional deadlift 1RM. Sat optional 5×5 hypertrophy upper.

### Accessories (default 2 working sets, RIR noted)

**Upper A (Mon)** after bench:
1. Weighted Pull-up OR Lat Pulldown — 3 × 6–8, RIR 1–2
2. Seated Cable Row (chest-supported) — 2 × 10–12, RIR 1
3. Incline DB Press (~30°) — 2 × 8–10, RIR 1 *(Chaves 2020 — upper pec)*
4. Hammer Curl — 2 × 10–12, RIR 0–1
5. Cable Face Pull — 2 × 12–15, RIR 1

**Lower A (Tue):**
1. Back Squat — 4 × 5 @ 75% 1RM (linear progression: +5 lb when all reps clean)
2. Bulgarian Split Squat — 2 × 8–10/leg, RIR 1
3. Seated Leg Curl — 2 × 10–12, RIR 0–1 *(Maeo 2021)*
4. Standing Calf Raise (deep stretch, pause bottom) — 3 × 8–12, RIR 0–1 *(Kassiano 2023)*
5. Hanging Leg Raise — 2 × 12–15, RIR 1

**Upper B (Wed)** after bench:
1. Chest-Supported T-Bar Row — 3 × 8–10, RIR 1
2. Incline DB Bench (~30°) — 2 × 10–12, RIR 1
3. One-Arm Lat Pulldown (kneeling) — 2 × 10–12, RIR 1
4. Cable Lateral Raise (lean-away) — 3 × 10–15, RIR 0–1
5. Cable Triceps Pushdown (rope) — 2 × 12–15, RIR 0

**Upper C (Fri)** after bench AMRAP:
1. Close-Grip Bench Press — 2 × 6–8, RIR 2
2. Weighted Dip OR Machine Chest Press — 2 × 8–10, RIR 1
3. Overhead Cable Triceps Extension (rope) — 3 × 10–12, RIR 0–1 *(Maeo 2023 — long head)*
4. Incline DB Curl — 2 × 10–12, RIR 0–1
5. Cable Lateral Raise — 2 × 12–15, RIR 0

**Lower B (Sat):**
1. Romanian Deadlift — 3 × 6–8, RIR 2
2. Hack Squat OR Leg Press — 2 × 8–10, RIR 1
3. Leg Extension (paused at top, lengthened ROM) — 2 × 10–12, RIR 0–1 *(Pedrosa 2022)*
4. Seated Leg Curl — 2 × 10–12, RIR 0–1
5. Seated/Donkey Calf Raise — 3 × 10–15, RIR 0–1
6. Cable Crunch — 2 × 10–15, RIR 1

## Core programming logic — pure functions in `lib/programming/` with Vitest tests

### `resolveTrainingMax(currentOneRm: number): number`
Returns `currentOneRm * 0.9`, rounded to nearest 5 lb.

### `resolveBenchPrescription(percentage: number, trainingMax: number, units: 'lb' | 'kg'): number`
Returns prescribed working weight, **rounded to nearest 5 lb (or 2.5 kg)**. Always round, never truncate. Test: 75% of 285 → 215; 80% of 245 → 195.

### `applyAmrapBump(currentTm: number, amrapReps: number): { newTm: number; bumpAmount: number; reason: string }`
Spec strictly:
- `< 8`: hold, reason "Hold TM (AMRAP under 8 reps)"
- `=== 8`: hold (edge case), reason "Hold TM (AMRAP at 8 — borderline, holding for safety)"
- `>= 9 && <= 11`: +5, reason "Standard +5 lb (9–11 AMRAP reps)"
- `> 11`: +10, reason "Aggressive +10 lb (12+ AMRAP reps)"

Test cases: `[5, 7, 8, 9, 10, 11, 12, 15]`.

### `getCurrentBlock(weekNumber: number): 1 | 2 | 3 | 'deload' | 'test'`
Weeks 1–4 → 1; 5–8 → 2; 9–12 → 3; 13 → 'deload'; 14 → 'test'.

### `getBenchPrescriptionForDay(weekInBlock: 1|2|3|4, day: 'mon'|'wed'|'fri'): Array<{percentage, sets, reps, isAmrap, waveStep?: number}>`
Returns ordered list of prescribed sets per the loading table.

### `getNextScheduledWorkout(programId): ProgramDay`
Next uncompleted day relative to today. Surface skipped days as "skipped" with options to make up or skip forward.

## UI/UX requirements

This app gets used at the gym, one-handed, sweaty fingers. Optimize for that. Dark mode default.

### Routes
- `/signin` — single password field
- `/` — dashboard: today's session, current TM cards, recent history, bodyweight sparkline
- `/workout/[programDayId]` — preview of an upcoming workout
- `/workout/[programDayId]/active` — set-by-set logger (the hero screen)
- `/program` — full 14-week calendar
- `/lifts` — TM history per lift, manual adjustment with confirmation
- `/history` — past sessions
- `/settings` — units, bodyweight log, default rest timers, reset program

### Active workout view (most important)
- Min 56×56 px tap targets. Massive prescribed weight: "Set 3 of 5 — **215 lb × 5 reps**".
- Auto-fill weight used = prescribed.
- Rest timer after every set tap. Default 3 min main lifts, 90 sec accessories. Must work when phone locked or backgrounded — Web Audio API + Wake Lock API + service worker notification. **Test on iOS Safari.**
- AMRAP set visually distinct (red badge). After logging, show modal: "Based on X reps, new bench TM will be Y lb (+Z lb). Apply now?" → confirms updates `lifts.training_max` and writes `tm_history`.
- "Last time" reference above each input: "Last: 3×8 @ 145 lb, RIR 1". Pull from most recent `workout_sets` for that exercise.
- Plate calculator chip next to weight (45 lb bar; plates 45/35/25/10/5/2.5).
- Offline support: queue mutations to IndexedDB (`idb` library), sync on reconnect, show sync status indicator.

### Dashboard
- "Today's session: Upper A — Bench Heavy" + "Start Workout" button.
- Bench TM card: "295 lb (last bumped 12 days ago, +5 lb)". Tap → TM history.
- Bodyweight sparkline (4 weeks) + "+ Log weight" button.

### Mobile-first
- Test at 375 px width.
- Bottom nav: Home / Workout / Program / Lifts / Settings.
- Dark mode default.
- I have screen designs from Claude design at `./design/` — match the visual style there if files exist; otherwise infer the vibe from this spec (utility-first, gym-focused, big tabular numerals, high-contrast).

## Auth — hardcoded password

- Env var `APP_PASSWORD`. Default in `.env.example`: `APP_PASSWORD=changeme`.
- `/signin` page: single password input → POST `/api/auth/signin`.
- On match: set HTTP-only signed cookie `bp_session` (signed with `SESSION_SECRET`), expires in 30 days, `SameSite=Lax`.
- Middleware (`middleware.ts`) gates all routes except `/signin` and `/api/auth/signin`. Redirects unauthenticated requests to `/signin`.
- No registration. No password reset. No users table.

## Setup

`docker-compose.yml`:
```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: benchpilot
      POSTGRES_PASSWORD: benchpilot_dev
      POSTGRES_DB: benchpilot
    ports:
      - "5432:5432"
    volumes:
      - benchpilot_pg_data:/var/lib/postgresql/data
volumes:
  benchpilot_pg_data:
```

`.env.example`:
```
DATABASE_URL=postgresql://benchpilot:benchpilot_dev@localhost:5432/benchpilot
APP_PASSWORD=changeme
SESSION_SECRET=replace-with-32-byte-random-string
```

README setup: `docker compose up -d && pnpm install && pnpm db:push && pnpm db:seed && pnpm dev`.

## Testing — use Playwright MCP

### Vitest (must pass before E2E)
- `lib/programming/training-max.test.ts` — `resolveTrainingMax`, `resolveBenchPrescription` rounding edges
- `lib/programming/amrap.test.ts` — `applyAmrapBump` for `[5, 7, 8, 9, 10, 11, 12, 15]`
- `lib/programming/blocks.test.ts` — `getCurrentBlock` for weeks 1, 4, 5, 8, 9, 12, 13, 14
- `lib/programming/prescription.test.ts` — `getBenchPrescriptionForDay` for every (block-week, day) combo

### Playwright E2E (commit as `tests/e2e/*.spec.ts`)
1. **Sign-in**: wrong password → blocked. Right password → redirected to `/`.
2. **Initial setup**: set bench 1RM = 225 in settings → verify `lifts.training_max = 205` (225 × 0.9 = 202.5 → 205).
3. **Block 1 Wk 1 Mon**: prescribed sets = 5×5 @ 75% of 205 = 155 lb. Verify UI shows "155 lb × 5 reps". Log all 5. Session completes.
4. **AMRAP +10 bump**: jump to Block 1 Wk 3 Fri. Bench 80% × 1 AMRAP. Log 12 reps. Modal shows "+10 lb", new TM 215 after confirm. `tm_history` row created with reason `'amrap_bump'`, `amrap_reps = 12`.
5. **AMRAP hold**: same setup, log 6 reps. Modal says "Hold TM". TM stays 205. No `tm_history` row.
6. **Plate calc** at 215 lb: shows correct breakdown per side (215 - 45 bar = 170 / 2 = 85 → 45+25+10+5).
7. **Offline**: simulate offline, log a set, verify queued. Restore online, verify synced.

### Run the MCP yourself

After scaffolding and `pnpm dev` in background:
1. Add Playwright MCP: `claude mcp add playwright npx @playwright/mcp@latest`
2. Use the MCP (say "use playwright mcp") to drive Chromium against `http://localhost:3000`
3. Walk through critical flows. Fix any failures before declaring done.

## Project structure

```
.
├── app/
│   ├── (app)/
│   │   ├── workout/[id]/active/
│   │   ├── program/
│   │   ├── lifts/
│   │   ├── history/
│   │   └── settings/
│   ├── signin/
│   ├── api/auth/signin/
│   └── layout.tsx
├── lib/
│   ├── db/
│   │   ├── schema.ts
│   │   ├── index.ts
│   │   └── seed.ts
│   ├── programming/      # Pure functions. CORE LOGIC. Fully tested.
│   │   ├── training-max.ts
│   │   ├── amrap.ts
│   │   ├── blocks.ts
│   │   ├── prescription.ts
│   │   ├── seed-program.ts
│   │   └── *.test.ts
│   ├── auth.ts           # Cookie session helpers
│   └── offline/          # IndexedDB sync
├── components/
│   ├── workout/
│   ├── ui/               # shadcn/ui
│   └── ...
├── tests/e2e/
├── public/manifest.json
├── middleware.ts
├── docker-compose.yml
├── drizzle.config.ts
├── playwright.config.ts
├── vitest.config.ts
├── .env.example
├── README.md
└── package.json
```

## Standards

- TypeScript strict. No `any`. `zod` for runtime validation of all API inputs.
- Server Components by default; Client Components for forms/timers/IndexedDB.
- All mutations through Server Actions or `/api` route handlers; validate with zod.
- DB access through Drizzle only (raw SQL only in migrations).
- All weights stored in lb; convert at display if `units='kg'`.
- Dates UTC; convert at display.
- `lib/programming/` is framework-agnostic, no DB calls.
- Tailwind only; no CSS-in-JS.
- Conventional commits.

## Execution order

1. Scaffold Next.js + TS + Tailwind + shadcn + Drizzle + PWA.
2. `docker-compose.yml`, `.env.example`, README.
3. Schema + `drizzle-kit push`.
4. **Programming logic + Vitest tests.** Tests must pass.
5. Seed function — generates ~70 program_days and ~350+ program_exercises in one transaction.
6. Auth (cookie session) + `/signin` + middleware.
7. Dashboard + program calendar.
8. **Active workout view** — hardest, most important. Make it bulletproof.
9. PWA offline + service worker rest timer.
10. Add Playwright MCP, write E2E tests, run them, fix issues.
11. Final README.

## What "done" looks like

1. `docker compose up -d && pnpm install && cp .env.example .env && pnpm db:push && pnpm db:seed && pnpm dev` works.
2. Visit localhost:3000 → password page → unlock with `changeme` → dashboard.
3. Set bench 1RM in settings → today's workout shows resolved weights.
4. `pnpm test` passes all Vitest.
5. `pnpm test:e2e` passes all Playwright.
6. Phone test: install as PWA, log a workout, rest timer fires while phone locked.

## Final instructions

- Plan briefly first (markdown, before code). Note any choices on ambiguous spec points. Then build.
- Git commit between tasks as the current user of this computer and not as claude.
- Where ambiguous, choose what serves "Sam, gym, sweaty fingers, science-driven."
- Don't ask me — execute in one pass.
- After build, **actually run Playwright MCP against the live local app** and show test results.
- Science logic (TM, percentages, AMRAP bumps, prescribed weights) is the most important thing. If anything is cut for time, cut polish on `/history` or `/settings`. Never cut programming logic.

Go.
