# Railway → Dokploy migration runbook

Moves BenchPilot off Railway (project `gym_tracker`, service `benchpilot`) onto a
self-hosted VM running Dokploy, with Postgres inside the same compose stack.

The app keeps its domain, `gym.samhren.dev`.

## What was added to the repo

| File | Purpose |
| --- | --- |
| `Dockerfile` | Multi-stage build producing a Next.js `standalone` runtime image. |
| `docker-compose.prod.yml` | The Dokploy stack: `app` + `postgres` on a private `app_network`. |
| `.dockerignore` | Keeps `.next`, `node_modules`, screenshots and test output out of the build context. |
| `next.config.ts` | Gained `output: "standalone"`. |

`docker-compose.yml` (the old local dev Postgres on port 5433) is untouched and
still works for local development.

## The one thing that will break everything if you get it wrong

`users.pin_hash` is `HMAC-SHA256(SESSION_SECRET, pin)` (`lib/auth-core.ts`), and
session cookies are JWTs signed with the same secret.

**`SESSION_SECRET` on Dokploy must be byte-for-byte identical to Railway's.**

If it differs, every PIN stops working and every existing 30-day cookie is
invalidated, with no way to recover the old PINs from the hashes.

Read the current values out of Railway with:

```sh
railway link --project gym_tracker
railway variables --service benchpilot
```

Copy `SESSION_SECRET`, `APP_PASSWORD` and `GEMINI_API_KEY` from that output.

## Step 1 — Ship the Docker files

```sh
git add Dockerfile .dockerignore docker-compose.prod.yml next.config.ts lib/version.ts docs/DOKPLOY_DEPLOY.md
git commit -m "Add Docker/Dokploy deploy stack"
git push
```

Railway will redeploy from this push; that is harmless and it gets torn down at
the end anyway.

## Step 2 — Create the Dokploy application

In the Dokploy UI:

1. **Create Project** → **Create Service** → **Compose**.
2. Provider: GitHub → this repository → branch `main`.
3. **Compose Path: `./docker-compose.prod.yml`** — this is not the default.
   Dokploy defaults to `./docker-compose.yml`, which in this repo is the local
   dev Postgres and would deploy a bare database with no app.
4. Compose Type: `Docker Compose`.

## Step 3 — Set the environment

Under the service's **Environment** tab, paste:

```
POSTGRES_USER=benchpilot
POSTGRES_DB=benchpilot
POSTGRES_PASSWORD=<generate: openssl rand -base64 24 | tr -d '/+='>
SESSION_SECRET=<EXACT value from Railway>
APP_PASSWORD=<EXACT value from Railway>
GEMINI_API_KEY=<value from Railway>
```

`GEMINI_MODEL` is optional and only overrides the default model in
`lib/ai/gemini.ts`.

`POSTGRES_PASSWORD` is new and local to the VM, so pick a fresh one; nothing in
the dump depends on it.

## Step 4 — Deploy and let it build

Hit **Deploy**.

The first build takes a few minutes because it installs dependencies and runs
`next build` from scratch.

Wait until both containers report healthy:

```sh
docker ps --filter "name=<dokploy-stack-name>" --format "{{.Names}}\t{{.Status}}"
```

The app comes up against an empty database at this point, which is expected —
the data lands in the next step.

## Step 5 — Move the database

Both sides are Postgres 18, so this is a straight dump and restore.

Take the dump on your laptop, with Railway still running:

```sh
railway link --project gym_tracker
railway run --service Postgres -- \
  sh -c 'pg_dump "$DATABASE_PUBLIC_URL" --no-owner --no-privileges -Fc -f benchpilot.dump'
```

`--no-owner --no-privileges` matters because Railway owns the objects as
`postgres` and the new cluster owns them as `benchpilot`.

Copy it to the VM and restore into the running Postgres container:

```sh
scp benchpilot.dump <user>@<vm-ip>:~/

ssh <user>@<vm-ip>
PG=$(docker ps --filter "name=postgres" --format "{{.Names}}" | head -1)
docker exec -i "$PG" pg_restore -U benchpilot -d benchpilot \
  --no-owner --no-privileges < ~/benchpilot.dump
```

Verify the row counts match Railway exactly:

```sh
docker exec -i "$PG" psql -U benchpilot -d benchpilot -c \
"select (select count(*) from users) users,
        (select count(*) from lifts) lifts,
        (select count(*) from workout_sessions) sessions,
        (select count(*) from workout_sets) sets,
        (select count(*) from program_exercises) prog_ex,
        (select count(*) from exercises) exercises,
        (select count(*) from tm_history) tm,
        (select count(*) from coach_digests) digests;"
```

As of the dry run on 2026-08-06 the expected numbers are:

```
 users | lifts | sessions | sets | prog_ex | exercises | tm | digests
     4 |    16 |      108 | 1516 |    1710 |       103 | 56 |      69
```

Then restart the app container so it reconnects to a populated schema:

```sh
docker restart $(docker ps --filter "name=app" --format "{{.Names}}" | head -1)
```

Delete `~/benchpilot.dump` from the VM afterwards — it contains every user's PIN
hash.

## Step 6 — Domain and TLS

In Dokploy, open the service's **Domains** tab and add:

- Host: `gym.samhren.dev`
- Service: `app`
- Container port: `3000`
- HTTPS: on, certificate provider Let's Encrypt

Then repoint DNS: change the `gym.samhren.dev` record to an `A` record pointing
at the VM's IP, removing the Railway `CNAME`.

Lower the TTL an hour beforehand if you want a fast cutover.

Let's Encrypt cannot issue until DNS resolves to the VM, so the certificate
appears a minute or two after propagation.

## Step 7 — Verify before decommissioning

1. Load `https://gym.samhren.dev` and confirm the certificate is valid.
2. Confirm you are still signed in — the old cookie should survive because
   `SESSION_SECRET` carried over. If you got logged out, the secret does not
   match; fix it before touching Railway.
3. Sign in with your PIN.
4. Check that training maxes, program week and history all look right.
5. View source and confirm `<meta name="app-version">` matches `lib/version.ts`.
6. Log one set and reload to confirm writes persist.

## Step 8 — Decommission Railway

Only after the above passes, and ideally after a few days of running on the VM:

```sh
railway down --service benchpilot
```

Keep the Railway Postgres for a while as a cold backup, then delete the project.

Also delete `PROD_DATABASE_URL` from your local `.env` or repoint it at the VM,
so the `db:*:prod` scripts no longer target Railway.

## Operating it afterwards

**Deploys.** Dokploy rebuilds on push if you enable the GitHub webhook, or you
press Deploy. Keep bumping `APP_VERSION` in `lib/version.ts` on every
user-facing change (see `CLAUDE.md`).

**Schema changes.** Postgres is not exposed to the internet, so run
drizzle-kit through an SSH tunnel:

```sh
ssh -L 5555:localhost:5432 <user>@<vm-ip>
# leave that open, then in another shell:
PROD_DATABASE_URL="postgresql://benchpilot:<POSTGRES_PASSWORD>@localhost:5555/benchpilot" \
  pnpm db:push:prod
```

That requires publishing the container port to the VM's loopback, or tunnelling
to the container IP; alternatively run one-off scripts inside the app container.

**Backups.** Nothing backs this up automatically. A nightly dump on the VM:

```sh
0 4 * * * docker exec $(docker ps --filter "name=postgres" --format "{{.Names}}" | head -1) \
  pg_dump -U benchpilot -d benchpilot -Fc > /var/backups/benchpilot-$(date +\%F).dump
```

Railway was handling this implicitly; on your own VM it is now your job.
