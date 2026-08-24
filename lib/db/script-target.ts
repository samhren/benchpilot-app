import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Explicit dev/prod target resolution for standalone `db:*` migration scripts.
//
// The older `db:*:prod` scripts shell-substitute `DATABASE_URL=$PROD_DATABASE_URL`.
// That expands to an EMPTY string whenever the variable lives in `.env` but was
// never exported into the shell — and an empty `DATABASE_URL` makes
// `lib/db/index.ts` silently fall back to its localhost default. A migration
// that quietly retargets the dev database while reporting success is the worst
// failure mode these scripts have, so newer scripts name the target explicitly
// (mirroring `DRIZZLE_TARGET` in drizzle.config.ts) and print the resolved host
// before writing anything.
export function resolveScriptTarget(envName: string) {
  const target = process.env[envName] ?? "dev";
  const url =
    target === "prod"
      ? process.env.PROD_DATABASE_URL
      : process.env.DATABASE_URL ??
        "postgresql://benchpilot:benchpilot_dev@localhost:5432/benchpilot";

  if (!url) {
    throw new Error(
      target === "prod"
        ? `PROD_DATABASE_URL is not set. Add it to .env before running with ${envName}=prod.`
        : "DATABASE_URL is not set.",
    );
  }

  const client = postgres(url, { prepare: false });
  const db = drizzle(client, { schema });

  function describe(): string {
    try {
      const u = new URL(url!);
      return `${u.hostname}:${u.port || "5432"}${u.pathname}`;
    } catch {
      return "(unparseable url)";
    }
  }

  function announce(): void {
    if (target === "prod") {
      console.log("\x1b[33m⚠  Targeting PRODUCTION database\x1b[0m");
    }
    console.log(`Target: ${target} → ${describe()}`);
  }

  return { target, client, db, describe, announce };
}
