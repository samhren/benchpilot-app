# BenchPilot

A personal, single-user, evidence-based lifting tracker. Runs a 14-week bench-focused program with science-driven Training Max (TM) progression: percentages of TM that auto-bump after AMRAP top sets per Greg Nuckols' rules. Built for Sam, gym, sweaty fingers.

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript strict
- Tailwind CSS, custom design system from `./design/` (Inter Tight + JetBrains Mono, dark mode, accent `#FF2F2F`)
- Postgres 16 (Docker) + Drizzle ORM
- Cookie session auth via `jose` (signed JWT) — single password, no users table
- PWA via `@serwist/next` (installable, offline IndexedDB queue)
- Vitest (programming math) + Playwright (E2E)

## Setup

```sh
docker compose up -d
pnpm install
cp .env.example .env
pnpm db:push
pnpm db:seed
pnpm dev
```

App: http://localhost:3000 — password from `.env` `APP_PASSWORD` (default: `changeme`).

> **Postgres port note:** The container publishes on `5433` (not 5432) to avoid conflicts with any local Postgres install. The `.env.example` `DATABASE_URL` matches.

## Setting up your TMs

1. Sign in.
2. Open **Settings** → tap **Edit** next to *Bench press* (and squat / deadlift / OHP).
3. Enter your current 1RM. The app computes `TM = round(0.9 × 1RM)` and writes a `tm_history` row.
4. Open the **Dashboard** — today's session resolves prescribed weights from your TM.

## How the programming logic works (the science)

All in `lib/programming/`, framework-agnostic, fully Vitest-tested:

- `resolveTrainingMax(oneRm)` → 0.9 × 1RM, rounded to nearest 5 lb / 2.5 kg.
- `resolveBenchPrescription(percentage, tm)` → working weight, rounded.
- `applyAmrapBump(currentTm, amrapReps)` → Greg Nuckols rules:
  - `< 8` reps → hold TM
  - `= 8` reps → hold (borderline, log warning)
  - `9–11` reps → +5 lb
  - `> 11` reps → +10 lb
- `getCurrentBlock(week)` / `getWeekInBlock(week)` → maps absolute week to (block, week-in-block).
- `getBenchPrescriptionForWeek(week, day)` → ordered prescribed sets per the loading table for any (week, mon/wed/fri) including Wk13 deload and Wk14 1RM test.

The 14-week program is seeded into the DB by `pnpm db:seed`: 98 program days, 28 distinct exercises, ~350+ program_exercises with wave-loaded bench plans embedded as JSONB.

## Testing

### Vitest (run before E2E)

```sh
pnpm test
```

5 files, 65 tests covering training-max rounding, AMRAP bump rules at edge cases (5/7/8/9/10/11/12/15), block boundaries, every (block-week × mon/wed/fri) prescription, and the plate calculator.

### Playwright E2E

```sh
pnpm test:e2e
```

Covers all 7 spec scenarios:

1. **Sign-in** — wrong password blocked; right password reaches dashboard.
2. **Initial setup** — bench 1RM = 225 → TM = 205 (rounding 202.5).
3. **Block 1 Wk 1 Mon** — bench prescribed = 5 × 5 @ 75% × 205 = 155 lb; logs all sets.
4. **AMRAP +10 bump** — 12 reps at 80% TM → modal "+10 lb", new TM 215; persists.
5. **AMRAP hold** — 6 reps → modal "Hold TM"; TM stays 205.
6. **Plate calc at 215 lb** — shows `45 + 25 + 10 + 5 / side` (45 lb bar).
7. **Offline** — logging while offline queues to IndexedDB; reconnects without losing data.

## Project structure

```
app/
  (app)/                  # Auth-gated routes
    page.tsx              # Dashboard
    workout/[id]/         # Preview
    workout/[id]/active/  # Active workout (the hero)
    program/              # 14-week calendar
    lifts/                # TM history per lift
    settings/             # 1RM, units, reset
    history/
  signin/                 # Single password gate
  api/auth/[signin|signout]/route.ts
  actions.ts              # Server actions (1RM, log set, AMRAP bump, etc.)
  layout.tsx
  sw.ts                   # @serwist/next service worker
lib/
  programming/            # Pure functions + tests
  db/                     # Drizzle schema, client, seed
  auth.ts                 # Cookie session helpers
  plates.ts               # Plate calculator (also pure)
  offline.ts              # IndexedDB mutation queue
  queries.ts              # SSR data loaders
components/
  ui/primitives.tsx       # BP design system
  bottom-nav.tsx
tests/e2e/                # Playwright specs
design/                   # Source design bundle from claude.ai/design
docker-compose.yml
drizzle.config.ts
playwright.config.ts
vitest.config.ts
middleware.ts             # Gates everything except /signin
```

## Auth

Single password in `APP_PASSWORD`. POST `/api/auth/signin` validates and sets an HTTP-only signed JWT cookie (`bp_session`, 30 d, `SameSite=Lax`). `middleware.ts` redirects everything else to `/signin`.

## PWA

`public/manifest.webmanifest` + `app/sw.ts` (Serwist) → installable to iPhone home screen, dark theme `#0a0a0a`. The active workout view acquires a screen Wake Lock and uses Web Audio API to beep when the rest timer ends — works while the phone is locked.

## Standards

- TypeScript strict, no `any`.
- Server Components by default; client components only for forms, timers, IndexedDB.
- All mutations through Server Actions, validated with `zod`.
- DB access through Drizzle only.
- All weights stored in lb; converted at display when units = kg.
