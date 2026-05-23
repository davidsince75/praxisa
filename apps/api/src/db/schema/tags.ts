import {
  pgTable,
  uuid,
  text,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { studentDocuments } from "./documents.js";

export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#0d9488"),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const documentTags = pgTable(
  "document_tags",
  {
    documentId: uuid("document_id")
      .notNull()
      .references(() => studentDocuments.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.documentId, t.tagId] })],
);

export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type DocumentTag = typeof documentTags.$inferSelect;
