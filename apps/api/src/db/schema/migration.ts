import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";

// ── Enums ──────────────────────────────────────────────────────────────────────

export const MIGRATION_BATCH_STATUSES = [
  "draft",
  "validating",
  "validated",
  "loading",
  "loaded",
  "failed",
] as const;
export type MigrationBatchStatus = (typeof MIGRATION_BATCH_STATUSES)[number];
export const migrationBatchStatusEnum = pgEnum(
  "migration_batch_status",
  MIGRATION_BATCH_STATUSES,
);

export const MIGRATION_ROW_STATUSES = [
  "pending",
  "accepted",
  "rejected",
  "loaded",
] as const;
export type MigrationRowStatus = (typeof MIGRATION_ROW_STATUSES)[number];
export const migrationRowStatusEnum = pgEnum(
  "migration_row_status",
  MIGRATION_ROW_STATUSES,
);

export const MIGRATION_ISSUE_SEVERITIES = ["error", "warning"] as const;
export type MigrationIssueSeverity =
  (typeof MIGRATION_ISSUE_SEVERITIES)[number];
export const migrationIssueSeverityEnum = pgEnum(
  "migration_issue_severity",
  MIGRATION_ISSUE_SEVERITIES,
);

// ── Tables ─────────────────────────────────────────────────────────────────────

export const migrationBatches = pgTable("migration_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceFile: text("source_file").notNull(),
  sha256: text("sha256"),
  rowCount: integer("row_count").notNull().default(0),
  status: migrationBatchStatusEnum("status").notNull().default("draft"),
  errorsCount: integer("errors_count").notNull().default(0),
  warningsCount: integer("warnings_count").notNull().default(0),
  importedBy: uuid("imported_by")
    .notNull()
    .references(() => users.id),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type MigrationBatch = typeof migrationBatches.$inferSelect;
export type NewMigrationBatch = typeof migrationBatches.$inferInsert;

export const migrationRows = pgTable("migration_rows", {
  id: uuid("id").primaryKey().defaultRandom(),
  batchId: uuid("batch_id")
    .notNull()
    .references(() => migrationBatches.id),
  rowRef: text("row_ref").notNull(),
  rawData: jsonb("raw_data").notNull(),
  normalizedData: jsonb("normalized_data"),
  status: migrationRowStatusEnum("status").notNull().default("pending"),
  targetUserId: uuid("target_user_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type MigrationRow = typeof migrationRows.$inferSelect;

export const migrationIssues = pgTable("migration_issues", {
  id: uuid("id").primaryKey().defaultRandom(),
  batchId: uuid("batch_id")
    .notNull()
    .references(() => migrationBatches.id),
  rowId: uuid("row_id").references(() => migrationRows.id),
  severity: migrationIssueSeverityEnum("severity").notNull(),
  ruleId: text("rule_id").notNull(),
  field: text("field"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type MigrationIssue = typeof migrationIssues.$inferSelect;
