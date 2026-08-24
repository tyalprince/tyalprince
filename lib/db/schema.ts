import {
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  integer,
  numeric,
  primaryKey,
  index,
  jsonb,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

// ---------------------------------------------------------------------------
// Auth.js core tables (Drizzle adapter shape)
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  // Login password (separate from the vault master password).
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

// ---------------------------------------------------------------------------
// Password Manager (zero-knowledge: encrypted_blob/iv are opaque ciphertext,
// the server and DB never see plaintext or the derived key)
// ---------------------------------------------------------------------------

export const vaultSettings = pgTable("vault_settings", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  kdfSalt: text("kdf_salt").notNull(), // base64
  kdfIterations: integer("kdf_iterations").notNull().default(600_000),
  // Used only to verify the master password was entered correctly on unlock
  // (a small known-plaintext blob encrypted with the derived key). Never a
  // way to recover the key server-side.
  verifierBlob: text("verifier_blob").notNull(),
  verifierIv: text("verifier_iv").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const vaultCategories = pgTable(
  "vault_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("vault_categories_user_id_idx").on(t.userId)],
);

export const vaultEntries = pgTable(
  "vault_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Non-sensitive-ish metadata kept in the clear for list/search UX.
    // (Spec allows encrypting username too; site name/url stay plaintext so
    // search/filter/favicon lookups work without unlocking.)
    siteName: text("site_name").notNull(),
    siteUrl: text("site_url"),
    category: text("category"),
    // Ciphertext of a JSON blob { username, password, notes } — AES-256-GCM.
    encryptedBlob: text("encrypted_blob").notNull(),
    iv: text("iv").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (t) => [
    index("vault_entries_user_id_idx").on(t.userId),
    index("vault_entries_user_site_idx").on(t.userId, t.siteName),
  ],
);

// ---------------------------------------------------------------------------
// Receipts / Tax Tracker
// ---------------------------------------------------------------------------

export const receiptCategories = pgTable(
  "receipt_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    businessOrPersonal: text("business_or_personal", {
      enum: ["business", "personal"],
    }).notNull(),
    isDefault: boolean("is_default").notNull().default(false),
  },
  (t) => [index("receipt_categories_user_id_idx").on(t.userId)],
);

export const receipts = pgTable(
  "receipts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    s3Key: text("s3_key").notNull(),
    vendorName: text("vendor_name"),
    receiptDate: timestamp("receipt_date", { mode: "date" }),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 }),
    taxAmount: numeric("tax_amount", { precision: 12, scale: 2 }),
    currency: text("currency").notNull().default("USD"),
    businessOrPersonal: text("business_or_personal", {
      enum: ["business", "personal"],
    }),
    category: text("category"),
    subcategory: text("subcategory"),
    notes: text("notes"),
    ocrRawText: text("ocr_raw_text"),
    ocrConfidence: numeric("ocr_confidence", { precision: 5, scale: 4 }),
    lineItems: jsonb("line_items").$type<
      { description: string; amount: number }[]
    >(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("receipts_user_id_idx").on(t.userId),
    index("receipts_user_date_idx").on(t.userId, t.receiptDate),
    index("receipts_user_vendor_idx").on(t.userId, t.vendorName),
  ],
);

export const receiptVendorRules = pgTable(
  "receipt_vendor_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    vendorPattern: text("vendor_pattern").notNull(),
    defaultCategory: text("default_category").notNull(),
    defaultBusinessFlag: text("default_business_flag", {
      enum: ["business", "personal"],
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("receipt_vendor_rules_user_id_idx").on(t.userId)],
);

// ---------------------------------------------------------------------------
// Fitness Tracker
// ---------------------------------------------------------------------------

export const exercises = pgTable(
  "exercises",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    category: text("category", {
      enum: [
        "strength",
        "cardio",
        "basketball",
        "cycling",
        "running",
        "mobility",
      ],
    }).notNull(),
    muscleGroups: text("muscle_groups").array().notNull().default([]),
    equipment: text("equipment"),
    instructions: text("instructions"),
    isCustom: boolean("is_custom").notNull().default(false),
    // null = global library entry, set = user-created custom exercise
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("exercises_user_id_idx").on(t.userId),
    index("exercises_category_idx").on(t.category),
    index("exercises_name_idx").on(t.name),
  ],
);

export const fitnessGoals = pgTable(
  "fitness_goals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    goalType: text("goal_type", {
      enum: ["strength", "endurance", "weight", "skill", "sport"],
    }).notNull(),
    targetMetric: text("target_metric"),
    targetValue: numeric("target_value", { precision: 10, scale: 2 }),
    targetDate: timestamp("target_date", { mode: "date" }),
    status: text("status", {
      enum: ["active", "completed", "abandoned"],
    })
      .notNull()
      .default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("fitness_goals_user_id_idx").on(t.userId)],
);

export const fitnessPlans = pgTable(
  "fitness_plans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    goalId: uuid("goal_id").references(() => fitnessGoals.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    description: text("description"),
    sportFocus: text("sport_focus", {
      enum: ["basketball", "lifting", "running", "biking", "mixed"],
    }).notNull(),
    startDate: timestamp("start_date", { mode: "date" }),
    endDate: timestamp("end_date", { mode: "date" }),
    status: text("status", {
      enum: ["draft", "active", "completed", "archived"],
    })
      .notNull()
      .default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("fitness_plans_user_id_idx").on(t.userId)],
);

export const planDays = pgTable(
  "plan_days",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => fitnessPlans.id, { onDelete: "cascade" }),
    sequenceNumber: integer("sequence_number").notNull(),
    title: text("title").notNull(),
  },
  (t) => [index("plan_days_plan_id_idx").on(t.planId)],
);

export const planDayExercises = pgTable(
  "plan_day_exercises",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    planDayId: uuid("plan_day_id")
      .notNull()
      .references(() => planDays.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "restrict" }),
    orderIndex: integer("order_index").notNull().default(0),
    targetSets: integer("target_sets"),
    targetReps: integer("target_reps"),
    targetWeight: numeric("target_weight", { precision: 8, scale: 2 }),
    targetDurationSeconds: integer("target_duration_seconds"),
    targetDistance: numeric("target_distance", { precision: 10, scale: 3 }),
  },
  (t) => [index("plan_day_exercises_plan_day_id_idx").on(t.planDayId)],
);

export const workoutLogs = pgTable(
  "workout_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    planId: uuid("plan_id").references(() => fitnessPlans.id, {
      onDelete: "set null",
    }),
    planDayId: uuid("plan_day_id").references(() => planDays.id, {
      onDelete: "set null",
    }),
    date: timestamp("date", { mode: "date" }).notNull(),
    startTime: timestamp("start_time", { withTimezone: true }),
    endTime: timestamp("end_time", { withTimezone: true }),
    notes: text("notes"),
    overallRpe: integer("overall_rpe"),
    status: text("status", {
      enum: ["planned", "completed", "skipped"],
    })
      .notNull()
      .default("completed"),
    activityType: text("activity_type"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("workout_logs_user_id_idx").on(t.userId),
    index("workout_logs_user_date_idx").on(t.userId, t.date),
  ],
);

export const loggedExercises = pgTable(
  "logged_exercises",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workoutLogId: uuid("workout_log_id")
      .notNull()
      .references(() => workoutLogs.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "restrict" }),
    orderIndex: integer("order_index").notNull().default(0),
    notes: text("notes"),
  },
  (t) => [
    index("logged_exercises_workout_log_id_idx").on(t.workoutLogId),
    index("logged_exercises_exercise_id_idx").on(t.exerciseId),
  ],
);

export const loggedSets = pgTable(
  "logged_sets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    loggedExerciseId: uuid("logged_exercise_id")
      .notNull()
      .references(() => loggedExercises.id, { onDelete: "cascade" }),
    setNumber: integer("set_number").notNull(),
    reps: integer("reps"),
    weight: numeric("weight", { precision: 8, scale: 2 }),
    weightUnit: text("weight_unit", { enum: ["lb", "kg"] }).default("lb"),
    durationSeconds: integer("duration_seconds"),
    distance: numeric("distance", { precision: 10, scale: 3 }),
    distanceUnit: text("distance_unit", { enum: ["mi", "km", "m"] }),
    restSeconds: integer("rest_seconds"),
    rpe: integer("rpe"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("logged_sets_logged_exercise_id_idx").on(t.loggedExerciseId)],
);
