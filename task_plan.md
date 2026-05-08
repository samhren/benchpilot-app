# BenchPilot Build Plan

**Goal:** Personal lifting tracker per docs/prompt.md. Single-user, hardcoded password, science-driven 14-week program, PWA.

**Working dir:** /Users/samhren/Code/fun/benchpilot
**Commit author:** current user (samhren), not Claude.

## Phases

- [x] P0: Plan files
- [ ] P1: Scaffold (Next 15, TS, Tailwind, shadcn, Drizzle, PWA, Vitest, Playwright deps); docker-compose; .env.example; README skeleton
- [ ] P2: Drizzle schema + drizzle.config + db client
- [ ] P3: **Programming logic + Vitest tests** (training-max, amrap, blocks, prescription) — must pass
- [ ] P4: Seed script (program + exercises + program_days + program_exercises)
- [ ] P5: Auth (cookie session) + /signin + middleware
- [ ] P6: Dashboard + /program calendar (match ./design/ visual)
- [ ] P7: Active workout view (rest timer, plate calc, AMRAP modal, "last time") — pixel-match design
- [ ] P8: PWA (@serwist/next), manifest, offline IndexedDB sync
- [ ] P9: Lifts page (TM history), Settings (1RM input, bodyweight), History
- [ ] P10: Playwright E2E tests + run via MCP if available
- [ ] P11: Final README, polish

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
