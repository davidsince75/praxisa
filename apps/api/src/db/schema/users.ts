import {
  boolean,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// ── Role enum ──────────────────────────────────────────────────────────────────

export const USER_ROLES = [
  "admin",
  "instructor",
  "student",
  "migration_lead",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const userRoleEnum = pgEnum("user_role", USER_ROLES);

// ── Users table ────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Contact
  email: text("email").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),

  // Auth
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("student"),

  // Status
  isActive: boolean("is_active").notNull().default(true),
  emailVerified: boolean("email_verified").notNull().default(false),

  // GDPR: soft delete — rows are never hard-deleted; DSR erasure zeroes PII fields
  deletedAt: timestamp("deleted_at", { withTimezone: true }),

  // Audit timestamps
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
