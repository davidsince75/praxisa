import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const gmailConnections = pgTable("gmail_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  tokenExpiresAt: timestamp("token_expires_at").notNull(),
  emailAddress: text("email_address").notNull(),
  connectedAt: timestamp("connected_at").notNull().defaultNow(),
});
