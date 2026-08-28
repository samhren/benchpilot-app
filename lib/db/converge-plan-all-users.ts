import "dotenv/config";
import { users } from "./schema";
import {
  DRY_RUN,
  announce,
  applyAccessoryPlanForUser,
  client,
  db,
  resolveTargetExerciseIds,
} from "./set-accessory-plan";

// Converge EVERY user's future (un-started) program days to the current TARGET
// accessory plan defined in set-accessory-plan.ts — the all-users counterpart of
// that single-user script. Idempotent and future-only: already logged or
// in-progress workouts keep their own snapshot and are never touched, and the
// bench % wave rows are preserved.
//
// Why this exists: the original `set-accessory-plan` migration was hard-scoped to
// the legacy/root user, so friends' accounts never received the new plan. This
// brings them all to the same plan that `lib/programming/seed-program.ts` now
// seeds new users with.
//
//   npm run db:converge-plan-all-users          (dev)
//   DRY_RUN=1 npm run db:converge-plan-all-users:prod   (preview production)
//   npm run db:converge-plan-all-users:prod             (apply to production)

async function main() {
  announce();
  console.log(
    `Converging accessory plan for ALL users (future days of the ACTIVE program only, idempotent)` +
      `${DRY_RUN ? " — DRY RUN, nothing will be written" : ""}…`,
  );

  const exId = await resolveTargetExerciseIds();
  const allUsers = await db.select({ id: users.id, name: users.name }).from(users);
  console.log(`Found ${allUsers.length} user(s).`);

  let totals = { updated: 0, inserted: 0, deleted: 0, days: 0 };
  for (const u of allUsers) {
    console.log(`\n  user ${u.id} (${u.name ?? "unnamed"}):`);
    const s = await applyAccessoryPlanForUser(u.id, exId);
    totals = {
      updated: totals.updated + s.updated,
      inserted: totals.inserted + s.inserted,
      deleted: totals.deleted + s.deleted,
      days: totals.days + s.days,
    };
    console.log(
      `    → ${s.days} future day(s) — ${s.updated} updated, ${s.inserted} inserted, ${s.deleted} deleted`,
    );
  }

  console.log(
    `\nDone${DRY_RUN ? " (DRY RUN — no writes)" : ""}. ${allUsers.length} user(s), ` +
      `${totals.days} future day(s) — ${totals.updated} updated, ${totals.inserted} inserted, ` +
      `${totals.deleted} deleted.`,
  );
  await client.end();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
