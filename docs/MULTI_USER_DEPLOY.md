# Multi-user (PIN) — production deploy runbook

BenchPilot now supports multiple accounts, each identified solely by a PIN.
This document is the exact sequence to deploy the change to production
**without losing any data and without disrupting the existing user**.

## What changed

- New `users` table. Each account is one PIN.
- Every per-user table (`lifts`, `programs`, `program_days`, `program_exercises`,
  `workout_sessions`, `session_exercises`, `workout_sets`, `day_status`,
  `body_weight_logs`, `tm_history`, `settings`) gained a `user_id` column.
  `exercises` stays a shared global library.
- All queries and mutations are scoped to the signed-in user.
- Sign-in takes a PIN. A known PIN logs in; an unknown PIN offers to create a
  new account (fresh 14-week program).

## How the existing user is preserved

- The migration creates a **legacy user** with a fixed id
  (`00000000-0000-0000-0000-000000000001`) and a PIN equal to the current
  `APP_PASSWORD`.
- Every existing row is reassigned to that legacy user.
- Old session cookies carry `sub: "sam"`; the app maps that to the legacy
  user id, so the existing user is **not even logged out** — their 30-day
  cookie keeps working and every page shows exactly the same data.

## Ordering constraint (important)

The new code reads/writes `user_id`. The columns must exist **and be
backfilled before** the new code is live. Railway auto-deploys from
`origin/main`, so the schema + data migration must happen **before** the code
is pushed.

```
1. db:push:prod        adds users table + nullable user_id columns
2. db:migrate-multi-user:prod   backfills user_id, creates legacy user
3. git push            Railway deploys the new code
```

Between step 1 and step 3 the *old* code is still running. It ignores the new
nullable columns, so there is no broken window.

## Steps

### 0. Pre-flight

Confirm your shell has the production values. The migration computes the
legacy user's PIN hash as `HMAC(SESSION_SECRET, APP_PASSWORD)`, so these two
must match what Railway uses:

```sh
# .env must contain the SAME SESSION_SECRET and APP_PASSWORD as Railway,
# plus PROD_DATABASE_URL.
grep -E 'SESSION_SECRET|APP_PASSWORD|PROD_DATABASE_URL' .env
```

If the legacy user's PIN hash ends up wrong, it can be fixed later by simply
re-running step 2 with the correct env — their cookie keeps them logged in for
30 days regardless.

### 1. Push the schema

```sh
pnpm db:push:prod
```

drizzle-kit will print **one** prompt:

> You're about to add `lifts_user_name_uq` unique constraint to the table,
> which contains 4 items. … Do you want to truncate lifts table?

**Answer "No" / the option that does _not_ truncate.** The 4 existing lift
rows already satisfy the new `unique(user_id, name)` constraint, so adding it
succeeds without truncation. Never choose truncate, and never run this with
`--force` (force would truncate).

### 2. Backfill the data

```sh
pnpm db:migrate-multi-user:prod
```

This is idempotent — it only touches rows whose `user_id` is still NULL and
upserts the legacy user. It prints a per-table count; verify every existing
row was assigned.

### 3. Deploy the code

```sh
git push        # (merge the multi-user branch into main first)
```

Railway builds and deploys automatically.

### 4. Verify

- Open the app — the existing user should still be signed in and see all
  their data unchanged (same training maxes, program week, history).
- Sign out, sign in with the old `APP_PASSWORD` value as the PIN — should log
  back into the same account.
- Enter a new PIN → "Create account" → should land on a fresh Week 1 program.

## Rollback

If the new code misbehaves, reverting the deploy is safe: the `user_id`
columns are nullable and the legacy data is intact, so the previous
single-user code runs fine against the migrated database. The `users` table
and `user_id` columns can stay; they are simply unused by old code.
