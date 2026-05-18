// One-time data migration to multi-user.
//
// Run AFTER `drizzle-kit push` has added the `users` table and the nullable
// `user_id` columns, and BEFORE the multi-user application code is deployed.
//
//   Local:  pnpm db:migrate-multi-user
//   Prod:   pnpm db:migrate-multi-user:prod
//
// What it does:
//   1. Creates the "legacy user" — the single account that existed before
//      multi-user — with a fixed id (LEGACY_USER_ID) and a PIN equal to the
//      current APP_PASSWORD.
//   2. Backfills `user_id` on every existing row to that legacy user.
//
// It is idempotent: re-running only touches rows whose `user_id` is still NULL,
// and refreshes the legacy user's pin hash.
//
// IMPORTANT: the legacy user's PIN hash is HMAC(SESSION_SECRET, APP_PASSWORD).
// Run this with the SAME `SESSION_SECRET` and `APP_PASSWORD` the production app
// uses, or the legacy user won't be able to sign in by PIN once their current
// session cookie expires. Their cookie keeps them logged in for 30 days
// regardless, so a wrong hash can be corrected by re-running with the right env.
import "dotenv/config";
import { isNull } from "drizzle-orm";
import { db } from "./index";
import {
  bodyWeightLogs,
  dayStatus,
  lifts,
  programDays,
  programExercises,
  programs,
  sessionExercises,
  settings,
  tmHistory,
  users,
  workoutSessions,
  workoutSets,
} from "./schema";
import { hashPin, LEGACY_USER_ID } from "../auth-core";

async function main() {
  const pin = process.env.APP_PASSWORD;
  if (!pin) {
    throw new Error(
      "APP_PASSWORD must be set — it becomes the legacy user's PIN. Set it to the value the app currently uses.",
    );
  }
  const dbUrl = process.env.DATABASE_URL ?? "(default localhost)";
  const host = dbUrl.replace(/\/\/[^@]*@/, "//***@");
  const pinHash = hashPin(pin);

  console.log("BenchPilot — multi-user data migration");
  console.log(`  target DB:            ${host}`);
  console.log(`  legacy user id:       ${LEGACY_USER_ID}`);
  console.log(`  legacy PIN length:    ${pin.trim().length} chars (from APP_PASSWORD)`);
  console.log(`  pin hash fingerprint: ${pinHash.slice(0, 16)}…`);
  console.log("");

  // 1. Legacy user. onConflictDoUpdate so a re-run refreshes the hash if the
  //    env (SESSION_SECRET / APP_PASSWORD) changed.
  await db
    .insert(users)
    .values({ id: LEGACY_USER_ID, pinHash, name: "Sam" })
    .onConflictDoUpdate({ target: users.id, set: { pinHash } });
  console.log("  legacy user upserted");

  // 2. Backfill every per-user table. Only rows whose user_id is still NULL are
  //    touched, so re-running never reassigns data created after the migration.
  const u = LEGACY_USER_ID;
  const counts = {
    lifts: (await db.update(lifts).set({ userId: u }).where(isNull(lifts.userId)).returning({ id: lifts.id })).length,
    programs: (await db.update(programs).set({ userId: u }).where(isNull(programs.userId)).returning({ id: programs.id })).length,
    program_days: (await db.update(programDays).set({ userId: u }).where(isNull(programDays.userId)).returning({ id: programDays.id })).length,
    program_exercises: (await db.update(programExercises).set({ userId: u }).where(isNull(programExercises.userId)).returning({ id: programExercises.id })).length,
    workout_sessions: (await db.update(workoutSessions).set({ userId: u }).where(isNull(workoutSessions.userId)).returning({ id: workoutSessions.id })).length,
    session_exercises: (await db.update(sessionExercises).set({ userId: u }).where(isNull(sessionExercises.userId)).returning({ id: sessionExercises.id })).length,
    workout_sets: (await db.update(workoutSets).set({ userId: u }).where(isNull(workoutSets.userId)).returning({ id: workoutSets.id })).length,
    day_status: (await db.update(dayStatus).set({ userId: u }).where(isNull(dayStatus.userId)).returning({ id: dayStatus.id })).length,
    body_weight_logs: (await db.update(bodyWeightLogs).set({ userId: u }).where(isNull(bodyWeightLogs.userId)).returning({ id: bodyWeightLogs.id })).length,
    tm_history: (await db.update(tmHistory).set({ userId: u }).where(isNull(tmHistory.userId)).returning({ id: tmHistory.id })).length,
    settings: (await db.update(settings).set({ userId: u }).where(isNull(settings.userId)).returning({ id: settings.id })).length,
  };

  for (const [table, n] of Object.entries(counts)) {
    console.log(`  ${table}: ${n} row(s) assigned to legacy user`);
  }

  console.log("");
  console.log("Migration complete. All pre-existing data now belongs to the legacy user.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
