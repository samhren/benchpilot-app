# BenchPilot — agent notes

## Persistence: do NOT use localStorage for durable state

BenchPilot is an installable PWA (added to the iOS/Android home screen). On
home-screen PWAs, **localStorage is not guaranteed to persist** — the OS can
evict it between launches. Therefore:

- **User preferences / settings → the `settings` table** (one row per user) via a
  server action, following the `setUnitsAction` / `setRestTimersAction` pattern
  in `app/actions.ts`. Never store a setting only in localStorage.
- localStorage is acceptable ONLY for best-effort, in-session resilience of
  transient state that is also derivable from the server (e.g. the active
  workout's rest-timer countdown and unsaved-set buffer in
  `app/(app)/workout/[id]/active/active-client.tsx`). Treat it as a cache that
  may vanish, never as the source of truth.

Note: the existing `TempoToggle` in `settings-client.tsx` stores `bp:showTempo`
in localStorage — that predates this rule and should be migrated to the DB if
touched.

## Database / deploys

- Schema lives in `lib/db/schema.ts`; applied with drizzle-kit push.
- `npm run db:push` targets the **local dev** DB (`DATABASE_URL`,
  localhost:5433). `npm run db:push:prod` targets **production**
  (`PROD_DATABASE_URL`, Railway) — never run the `:prod` variants unless the
  user explicitly asks.
- Railway auto-deploys from `origin/main`. Data migrations are manual `*:prod`
  scripts. Default to leaving prod untouched.
