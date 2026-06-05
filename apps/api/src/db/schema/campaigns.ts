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

export const CAMPAIGN_DELIVERY_TYPES = [
  "internal",
  "external",
  "targeted",
] as const;
export type CampaignDeliveryType = (typeof CAMPAIGN_DELIVERY_TYPES)[number];
export const campaignDeliveryTypeEnum = pgEnum(
  "campaign_delivery_type",
  CAMPAIGN_DELIVERY_TYPES,
);

export const campaigns = pgTable("campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  subject: varchar("subject", { length: 500 }),
  body: text("body").notNull(),
  deliveryType: campaignDeliveryTypeEnum("delivery_type")
    .notNull()
    .default("external"),
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
