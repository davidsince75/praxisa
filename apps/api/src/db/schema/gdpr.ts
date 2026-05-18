import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users.js";

// ── Enums ──────────────────────────────────────────────────────────────────────

export const GDPR_REQUEST_TYPES = [
  "erasure",
  "export",
  "rectification",
] as const;
export type GdprRequestType = (typeof GDPR_REQUEST_TYPES)[number];
export const gdprRequestTypeEnum = pgEnum(
  "gdpr_request_type",
  GDPR_REQUEST_TYPES,
);

export const GDPR_REQUEST_STATUSES = [
  "pending",
  "in_progress",
  "completed",
  "rejected",
] as const;
export type GdprRequestStatus = (typeof GDPR_REQUEST_STATUSES)[number];
export const gdprRequestStatusEnum = pgEnum(
  "gdpr_request_status",
  GDPR_REQUEST_STATUSES,
);

// ── GDPR requests ──────────────────────────────────────────────────────────────

export const gdprRequests = pgTable("gdpr_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  type: gdprRequestTypeEnum("type").notNull(),
  status: gdprRequestStatusEnum("status").notNull().default("pending"),
  // Free-text note from the requesting user or completing admin
  notes: text("notes"),
  completedBy: uuid("completed_by").references(() => users.id),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type GdprRequest = typeof gdprRequests.$inferSelect;
export type NewGdprRequest = typeof gdprRequests.$inferInsert;
