import "dotenv/config";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "./index";
import {
  exercises,
  programDays,
  programExercises,
  type sessionTypeEnum,
} from "./schema";

// Idempotent: applies the plan-v3 accessory updates to existing prod data.
//
//   Tue (Lower A):  swap Hanging Leg Raise → Weighted Hanging Leg Raise (3x10, RIR 1)
//   Wed (Upper B):  insert Cable Lat Pullover (2x13, RIR 1) after Chest-Supported Smith Row
//   Wed (Upper B):  append Ab Wheel Rollout (3x10, RIR 1) at end
//   Sat (Lower B):  swap Cable Crunch → Weighted Cable Crunch (3x12, RIR 1)
//
// Past sets stay pointed at the original exercise rows; only future
// prescriptions change. Safe to run repeatedly.

type SessionType = (typeof sessionTypeEnum.enumValues)[number];

const NEW_EXERCISES = [
  {
    name: "Cable Lat Pullover",
    muscleGroup: "back",
    equipment: "cable",
    defaultSets: 2,
    notes: "Lat in fully lengthened overhead position (Wolf 2023). High pulley, arms nearly straight; pull from overhead to thighs by shoulder extension only.",
  },
  {
    name: "Ab Wheel Rollout",
    muscleGroup: "abs",
    equipment: "ab-wheel",
    defaultSets: 3,
    notes: "Anti-extension, lengthened-position ab loading. Brace abs hard; do not let lower back arch. 2-3 sec slow eccentric, brief pause at full extension.",
  },
  {
    name: "Weighted Hanging Leg Raise",
    muscleGroup: "abs",
    equipment: "pull-up-bar",
    defaultSets: 3,
    notes: "DB between feet or ankle weights. Full hang at bottom; legs above parallel at top; 3-sec eccentric.",
  },
  {
    name: "Weighted Cable Crunch",
    muscleGroup: "abs",
    equipment: "cable",
    defaultSets: 3,
    notes: "Start torso fully extended back (slight arch — abs stretched), crunch from stretched position. Spinal flexion, not arm pull.",
  },
];

async function findByName(name: string) {
  const [row] = await db.select().from(exercises).where(eq(exercises.name, name)).limit(1);
  return row ?? null;
}

async function ensureExercise(def: (typeof NEW_EXERCISES)[number]) {
  const existing = await findByName(def.name);
  if (existing) return existing;
  const [row] = await db
    .insert(exercises)
    .values({
      name: def.name,
      muscleGroup: def.muscleGroup,
      equipment: def.equipment,
      defaultSets: def.defaultSets,
      isMainLift: false,
      notes: def.notes,
    })
    .returning();
  console.log(`  + inserted exercise: ${def.name}`);
  return row;
}

async function daysOfType(sessionType: SessionType) {
  return db
    .select({ id: programDays.id, weekNumber: programDays.weekNumber })
    .from(programDays)
    .where(eq(programDays.sessionType, sessionType));
}

async function swapExercise(opts: {
  sessionType: SessionType;
  fromName: string;
  to: { id: string; name: string };
  sets: number;
  reps: number;
  rirTarget: number;
  notes: string;
}) {
  const from = await findByName(opts.fromName);
  if (!from) {
    console.log(`  swap [${opts.sessionType}]: '${opts.fromName}' not in catalog — skipping`);
    return;
  }
  const days = await daysOfType(opts.sessionType);
  const dayIds = days.map((d) => d.id);
  if (dayIds.length === 0) {
    console.log(`  swap [${opts.sessionType}]: no program days — skipping`);
    return;
  }
  const result = await db
    .update(programExercises)
    .set({
      exerciseId: opts.to.id,
      sets: opts.sets,
      reps: opts.reps,
      rirTarget: opts.rirTarget,
      notes: opts.notes,
    })
    .where(
      and(
        inArray(programExercises.programDayId, dayIds),
        eq(programExercises.exerciseId, from.id),
      ),
    )
    .returning({ id: programExercises.id });
  console.log(
    `  swap [${opts.sessionType}]: ${opts.fromName} → ${opts.to.name} (${result.length} program_exercises updated)`,
  );
}

async function insertAfter(opts: {
  sessionType: SessionType;
  afterName: string;
  insert: { id: string; name: string };
  sets: number;
  reps: number;
  rirTarget: number;
  notes: string;
}) {
  const days = await daysOfType(opts.sessionType);
  if (days.length === 0) {
    console.log(`  insert [${opts.sessionType}]: no program days — skipping`);
    return;
  }
  let inserted = 0;
  let skipped = 0;
  for (const d of days) {
    const rows = await db
      .select()
      .from(programExercises)
      .where(eq(programExercises.programDayId, d.id));
    const already = rows.some((r) => r.exerciseId === opts.insert.id);
    if (already) {
      skipped += 1;
      continue;
    }
    const anchor = await findByName(opts.afterName);
    const anchorRow = anchor ? rows.find((r) => r.exerciseId === anchor.id) ?? null : null;
    if (!anchorRow) {
      console.log(
        `  insert [${opts.sessionType}, w${d.weekNumber}]: anchor '${opts.afterName}' not present — appending at end`,
      );
    }
    const insertIdx = anchorRow
      ? anchorRow.orderIndex + 1
      : rows.reduce((m, r) => Math.max(m, r.orderIndex), 0) + 1;
    // Shift existing rows >= insertIdx by +1.
    const toShift = rows.filter((r) => r.orderIndex >= insertIdx).sort((a, b) => b.orderIndex - a.orderIndex);
    for (const r of toShift) {
      await db
        .update(programExercises)
        .set({ orderIndex: r.orderIndex + 1 })
        .where(eq(programExercises.id, r.id));
    }
    await db.insert(programExercises).values({
      programDayId: d.id,
      orderIndex: insertIdx,
      exerciseId: opts.insert.id,
      prescriptionType: "rir_target",
      sets: opts.sets,
      reps: opts.reps,
      rirTarget: opts.rirTarget,
      isAmrapTopSet: false,
      notes: opts.notes,
    });
    inserted += 1;
  }
  console.log(
    `  insert [${opts.sessionType}]: ${opts.insert.name} after '${opts.afterName}' — added to ${inserted} day(s), skipped ${skipped} already-applied`,
  );
}

async function appendAtEnd(opts: {
  sessionType: SessionType;
  insert: { id: string; name: string };
  sets: number;
  reps: number;
  rirTarget: number;
  notes: string;
}) {
  const days = await daysOfType(opts.sessionType);
  if (days.length === 0) {
    console.log(`  append [${opts.sessionType}]: no program days — skipping`);
    return;
  }
  let inserted = 0;
  let skipped = 0;
  for (const d of days) {
    const rows = await db
      .select()
      .from(programExercises)
      .where(eq(programExercises.programDayId, d.id));
    if (rows.some((r) => r.exerciseId === opts.insert.id)) {
      skipped += 1;
      continue;
    }
    const nextIdx = rows.reduce((m, r) => Math.max(m, r.orderIndex), 0) + 1;
    await db.insert(programExercises).values({
      programDayId: d.id,
      orderIndex: nextIdx,
      exerciseId: opts.insert.id,
      prescriptionType: "rir_target",
      sets: opts.sets,
      reps: opts.reps,
      rirTarget: opts.rirTarget,
      isAmrapTopSet: false,
      notes: opts.notes,
    });
    inserted += 1;
  }
  console.log(
    `  append [${opts.sessionType}]: ${opts.insert.name} at end — added to ${inserted} day(s), skipped ${skipped} already-applied`,
  );
}

async function main() {
  console.log("Applying plan-v3 tweaks (idempotent)…");

  // Step 1 — ensure new exercise rows exist.
  const exMap = new Map<string, { id: string; name: string }>();
  for (const def of NEW_EXERCISES) {
    const row = await ensureExercise(def);
    exMap.set(def.name, { id: row.id, name: row.name });
  }

  // Step 2 — swap Hanging Leg Raise → Weighted Hanging Leg Raise on Lower A (Tue).
  await swapExercise({
    sessionType: "lower_a",
    fromName: "Hanging Leg Raise",
    to: exMap.get("Weighted Hanging Leg Raise")!,
    sets: 3,
    reps: 10,
    rirTarget: 1,
    notes:
      "DB between feet or ankle weights. Full hang at bottom; legs above parallel at top; 3-sec eccentric.",
  });

  // Step 3 — insert Cable Lat Pullover into Upper B (Wed) after Chest-Supported Smith Row.
  await insertAfter({
    sessionType: "upper_b",
    afterName: "Chest-Supported Smith Row",
    insert: exMap.get("Cable Lat Pullover")!,
    sets: 2,
    reps: 13,
    rirTarget: 1,
    notes:
      "Lat in fully lengthened overhead position (Wolf 2023). High pulley, arms nearly straight; pull from overhead to thighs by shoulder extension only.",
  });

  // Step 4 — append Ab Wheel Rollout at end of Upper B (Wed).
  await appendAtEnd({
    sessionType: "upper_b",
    insert: exMap.get("Ab Wheel Rollout")!,
    sets: 3,
    reps: 10,
    rirTarget: 1,
    notes:
      "Anti-extension, lengthened-position ab loading. Brace abs hard; do not let lower back arch. 2-3 sec slow eccentric, brief pause at full extension.",
  });

  // Step 5 — swap Cable Crunch → Weighted Cable Crunch on Lower B (Sat).
  await swapExercise({
    sessionType: "lower_b",
    fromName: "Cable Crunch",
    to: exMap.get("Weighted Cable Crunch")!,
    sets: 3,
    reps: 12,
    rirTarget: 1,
    notes:
      "Start torso fully extended back (slight arch — abs stretched), crunch from stretched position. Spinal flexion, not arm pull.",
  });

  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
