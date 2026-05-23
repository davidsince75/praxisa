import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { courses, courseModules, lessons, exercises } from "./learning.js";

export const DOCUMENT_STATUSES = ["draft", "published", "evaluated"] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];
export const documentStatusEnum = pgEnum(
  "student_document_status",
  DOCUMENT_STATUSES,
);

export const studentDocuments = pgTable("student_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  courseId: uuid("course_id").references(() => courses.id, {
    onDelete: "set null",
  }),
  moduleId: uuid("module_id").references(() => courseModules.id, {
    onDelete: "set null",
  }),
  lessonId: uuid("lesson_id").references(() => lessons.id, {
    onDelete: "set null",
  }),
  exerciseId: uuid("exercise_id").references(() => exercises.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  status: documentStatusEnum("status").notNull().default("draft"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  evaluatedAt: timestamp("evaluated_at", { withTimezone: true }),
  evaluatedBy: uuid("evaluated_by").references(() => users.id, {
    onDelete: "set null",
  }),
  feedback: text("feedback"),
  score: integer("score"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type StudentDocument = typeof studentDocuments.$inferSelect;
export type NewStudentDocument = typeof studentDocuments.$inferInsert;
