import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const liftNameEnum = pgEnum("lift_name", [
  "bench_press",
  "back_squat",
  "deadlift",
  "overhead_press",
]);

export const sessionTypeEnum = pgEnum("session_type", [
  "upper_a",
  "lower_a",
  "upper_b",
  "upper_c",
  "lower_b",
  "rest",
  "deload",
  "test",
]);

export const programStatusEnum = pgEnum("program_status", [
  "active",
  "paused",
  "completed",
]);

export const prescriptionTypeEnum = pgEnum("prescription_type", [
  "percentage_tm",
  "fixed_load",
  "rir_target",
  "amrap",
]);

export const tmReasonEnum = pgEnum("tm_reason", [
  "initial",
  "amrap_bump",
  "manual",
  "reset",
]);

export const sessionExerciseStatusEnum = pgEnum("session_exercise_status", [
  "pending",
  "completed",
  "skipped",
  "partial",
]);

export const workoutSessionStatusEnum = pgEnum("workout_session_status", [
  "in_progress",
  "completed",
  "partial",
  "abandoned",
]);

export const dayStatusStateEnum = pgEnum("day_status_state", [
  "done",
  "missed",
  "rescheduled",
  "skipped",
]);

// Each account is identified solely by a PIN. `pinHash` is an HMAC of the PIN
// (peppered with SESSION_SECRET) so a DB leak doesn't expose raw PINs, and so
// login can look the user up by a single equality match.
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  pinHash: text("pin_hash").notNull().unique(),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// NOTE on `userId` columns below: they are intentionally nullable at the DB
// level. This keeps `drizzle-kit push` safe to run against the pre-migration
// production database (existing rows have no user yet). The application always
// populates `userId` on insert and always filters by it on read — see
// lib/queries.ts and app/actions.ts. The migrate-multi-user script backfills
// every existing row before the new code is deployed.

export const lifts = pgTable(
  "lifts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    name: liftNameEnum("name").notNull(),
    currentOneRm: real("current_1rm"),
    trainingMax: real("training_max"),
    lastTmBumpAt: timestamp("last_tm_bump_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userNameUq: unique("lifts_user_name_uq").on(t.userId, t.name),
  }),
);

export const exercises = pgTable("exercises", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  muscleGroup: text("muscle_group").notNull(),
  equipment: text("equipment"),
  defaultSets: integer("default_sets").default(2).notNull(),
  isMainLift: boolean("is_main_lift").default(false).notNull(),
  notes: text("notes"),
});

export const programs = pgTable(
  "programs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    startDate: date("start_date").notNull(),
    totalWeeks: integer("total_weeks").default(14).notNull(),
    currentWeek: integer("current_week").default(1).notNull(),
    currentBlock: text("current_block").default("1").notNull(),
    status: programStatusEnum("status").default("active").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("programs_user_idx").on(t.userId),
  }),
);

export const programDays = pgTable(
  "program_days",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    programId: uuid("program_id").notNull().references(() => programs.id, { onDelete: "cascade" }),
    weekNumber: integer("week_number").notNull(),
    dayOfWeek: integer("day_of_week").notNull(),
    sessionType: sessionTypeEnum("session_type").notNull(),
    displayName: text("display_name").notNull(),
  },
  (t) => ({
    weekDayIdx: index("program_days_week_day_idx").on(t.programId, t.weekNumber, t.dayOfWeek),
  }),
);

export const programExercises = pgTable("program_exercises", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  programDayId: uuid("program_day_id")
    .notNull()
    .references(() => programDays.id, { onDelete: "cascade" }),
  orderIndex: integer("order_index").notNull(),
  exerciseId: uuid("exercise_id").notNull().references(() => exercises.id),
  prescriptionType: prescriptionTypeEnum("prescription_type").notNull(),
  sets: integer("sets").notNull(),
  reps: integer("reps").notNull(),
  percentageOfTm: real("percentage_of_tm"),
  rirTarget: integer("rir_target"),
  isAmrapTopSet: boolean("is_amrap_top_set").default(false).notNull(),
  notes: text("notes"),
  liftId: uuid("lift_id").references(() => lifts.id),
  // For wave-loaded sequences within a single exercise: extra prescribed sub-sets
  wavePlan: jsonb("wave_plan"),
});

export const workoutSessions = pgTable(
  "workout_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    programDayId: uuid("program_day_id").references(() => programDays.id),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    firstSetAt: timestamp("first_set_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    bodyWeightLb: real("body_weight_lb"),
    notes: text("notes"),
    perceivedRirOverall: integer("perceived_rir_overall"),
    status: workoutSessionStatusEnum("status").default("in_progress").notNull(),
    deloadFactor: real("deload_factor").default(1).notNull(),
    isExtra: boolean("is_extra").default(false).notNull(),
  },
  (t) => ({
    startedIdx: index("workout_sessions_started_idx").on(t.startedAt),
    userIdx: index("workout_sessions_user_idx").on(t.userId),
  }),
);

export const sessionExercises = pgTable(
  "session_exercises",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => workoutSessions.id, { onDelete: "cascade" }),
    programExerciseId: uuid("program_exercise_id").references(() => programExercises.id),
    exerciseId: uuid("exercise_id").notNull().references(() => exercises.id),
    swappedFromExerciseId: uuid("swapped_from_exercise_id").references(() => exercises.id),
    orderIndex: integer("order_index").notNull(),
    prescriptionType: prescriptionTypeEnum("prescription_type").notNull(),
    sets: integer("sets").notNull(),
    reps: integer("reps").notNull(),
    weightPrescribed: real("weight_prescribed"),
    percentageOfTm: real("percentage_of_tm"),
    rirTarget: integer("rir_target"),
    liftId: uuid("lift_id").references(() => lifts.id),
    wavePlan: jsonb("wave_plan"),
    isAmrapTopSet: boolean("is_amrap_top_set").default(false).notNull(),
    status: sessionExerciseStatusEnum("status").default("pending").notNull(),
    notes: text("notes"),
  },
  (t) => ({
    sessionIdx: index("session_exercises_session_idx").on(t.sessionId, t.orderIndex),
  }),
);

export const dayStatus = pgTable("day_status", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  programDayId: uuid("program_day_id")
    .notNull()
    .references(() => programDays.id, { onDelete: "cascade" })
    .unique(),
  state: dayStatusStateEnum("state").notNull(),
  rescheduledTo: date("rescheduled_to"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const workoutSets = pgTable(
  "workout_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => workoutSessions.id, { onDelete: "cascade" }),
    sessionExerciseId: uuid("session_exercise_id").references(() => sessionExercises.id, {
      onDelete: "cascade",
    }),
    programExerciseId: uuid("program_exercise_id").references(() => programExercises.id),
    exerciseId: uuid("exercise_id").notNull().references(() => exercises.id),
    setNumber: integer("set_number").notNull(),
    repsPrescribed: integer("reps_prescribed"),
    repsCompleted: integer("reps_completed"),
    weightPrescribed: real("weight_prescribed"),
    weightUsed: real("weight_used"),
    rir: integer("rir"),
    isAmrap: boolean("is_amrap").default(false).notNull(),
    isWarmup: boolean("is_warmup").default(false).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    sessionIdx: index("workout_sets_session_idx").on(t.sessionId),
    exerciseIdx: index("workout_sets_exercise_idx").on(t.userId, t.exerciseId),
  }),
);

export const bodyWeightLogs = pgTable(
  "body_weight_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    weightLb: real("weight_lb").notNull(),
  },
  (t) => ({
    userDateIdx: index("body_weight_logs_user_date_idx").on(t.userId, t.date),
  }),
);

export const tmHistory = pgTable("tm_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  liftId: uuid("lift_id").notNull().references(() => lifts.id, { onDelete: "cascade" }),
  trainingMax: real("training_max").notNull(),
  effectiveFrom: timestamp("effective_from", { withTimezone: true }).defaultNow().notNull(),
  reason: tmReasonEnum("reason").notNull(),
  amrapReps: integer("amrap_reps"),
  notes: text("notes"),
});

// Settings — one row per user.
export const settings = pgTable("settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  units: text("units").default("lb").notNull(),
  timezone: text("timezone").default("UTC").notNull(),
  defaultRestMainSec: integer("default_rest_main_sec").default(180).notNull(),
  defaultRestAccessorySec: integer("default_rest_accessory_sec").default(90).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const _meta = sql`select 1`;
