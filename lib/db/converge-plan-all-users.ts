import "dotenv/config";
import { db } from "./index";
import { users } from "./schema";
import { applyAccessoryPlanForUser, resolveTargetExerciseIds } from "./set-accessory-plan";

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

async function main() {
  console.log("Converging accessory plan for ALL users (future weeks only, idempotent)…");

  const exId = await resolveTargetExerciseIds();
  const allUsers = await db.select({ id: users.id }).from(users);
  console.log(`Found ${allUsers.length} user(s).`);

  let totals = { updated: 0, inserted: 0, deleted: 0, days: 0 };
  for (const u of allUsers) {
    const s = await applyAccessoryPlanForUser(u.id, exId);
    totals = {
      updated: totals.updated + s.updated,
      inserted: totals.inserted + s.inserted,
      deleted: totals.deleted + s.deleted,
      days: totals.days + s.days,
    };
    console.log(
      `  user ${u.id}: ${s.days} future day(s) — ${s.updated} updated, ${s.inserted} inserted, ${s.deleted} deleted`,
    );
  }

  console.log(
    `Done. ${allUsers.length} user(s), ${totals.days} future day(s) — ${totals.updated} updated, ${totals.inserted} inserted, ${totals.deleted} deleted.`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
