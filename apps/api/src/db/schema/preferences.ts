import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export interface EmailNotificationPrefs {
  messages: boolean;
  grading: boolean;
  campaigns: boolean;
  forums: boolean;
}

export const userPreferences = pgTable("user_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  theme: text("theme").notNull().default("system"),
  locale: text("locale").notNull().default("fr"),
  emailNotifications: jsonb("email_notifications")
    .notNull()
    .$type<EmailNotificationPrefs>()
    .default({
      messages: true,
      grading: true,
      campaigns: true,
      forums: true,
    }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type UserPreference = typeof userPreferences.$inferSelect;
export type NewUserPreference = typeof userPreferences.$inferInsert;
