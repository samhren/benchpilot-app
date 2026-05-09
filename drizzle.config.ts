import type { Config } from "drizzle-kit";

const target = process.env.DRIZZLE_TARGET ?? "dev";
const url =
  target === "prod"
    ? process.env.PROD_DATABASE_URL
    : process.env.DATABASE_URL ?? "postgresql://benchpilot:benchpilot_dev@localhost:5432/benchpilot";

if (!url) {
  throw new Error(
    target === "prod"
      ? "PROD_DATABASE_URL is not set. Add it to .env (or your shell) before running db:*:prod."
      : "DATABASE_URL is not set.",
  );
}

if (target === "prod") {
  console.log("\x1b[33m⚠  Targeting PRODUCTION database\x1b[0m");
}

export default {
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
} satisfies Config;
