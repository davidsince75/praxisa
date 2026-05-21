import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { courses } from "./learning.js";

export const CAMPAIGN_STATUSES = [
  "draft",
  "sending",
  "sent",
  "failed",
] as const;
export const campaignStatusEnum = pgEnum("campaign_status", CAMPAIGN_STATUSES);

export const CAMPAIGN_TARGETS = ["all_students", "course_enrolled"] as const;
export const campaignTargetEnum = pgEnum("campaign_target", CAMPAIGN_TARGETS);

export const campaigns = pgTable("campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  subject: varchar("subject", { length: 500 }).notNull(),
  body: text("body").notNull(),
  targetType: campaignTargetEnum("target_type")
    .notNull()
    .default("all_students"),
  targetCourseId: uuid("target_course_id").references(() => courses.id),
  status: campaignStatusEnum("status").notNull().default("draft"),
  recipientCount: integer("recipient_count"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
