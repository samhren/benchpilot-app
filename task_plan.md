# BenchPilot Build Plan

**Goal:** Personal lifting tracker per docs/prompt.md. Single-user, hardcoded password, science-driven 14-week program, PWA.

**Working dir:** /Users/samhren/Code/fun/benchpilot
**Commit author:** current user (samhren), not Claude.

## Phases

- [x] P0: Plan files
- [x] P1: Scaffold
- [x] P2: Drizzle schema + drizzle.config + db client
- [x] P3: Programming logic + Vitest tests (65 passing)
- [x] P4: Seed (98 program days, 28 exercises)
- [x] P5: Auth + /signin + middleware
- [x] P6: Dashboard + /program calendar
- [x] P7: Active workout view (rest timer, plate calc, AMRAP modal, "last time")
- [x] P8: PWA + offline IndexedDB sync
- [x] P9: Lifts, Settings, History
- [x] P10: Playwright E2E (7/7 passing)
- [x] P11: Final README

## Key Decisions

- Session lib: Use `jose` for signed JWT (avoid iron-session dep weight). Cookie `bp_session`, 30d, HttpOnly, SameSite=Lax, Secure in prod.
- Weights: store lb (number), display kg if user prefs.
- Rounding: nearest 5 lb (lb units), nearest 2.5 kg (kg units).
- shadcn/ui: install minimal needed components (button, input, card, dialog, badge, etc).
- IDs: uuid generated via `crypto.randomUUID()` server-side; DB type uuid with default `gen_random_uuid()`.
- Offline: `idb` library, queue mutations to IDB, replay on reconnect.

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|

## Notes
- Don't build running tracking.
- Programming logic is highest priority — never cut.
