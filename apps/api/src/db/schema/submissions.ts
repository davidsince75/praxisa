import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { exercises, enrolments } from "./learning.js";

export const SUBMISSION_STATUSES = ["submitted", "grading", "graded"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];
export const submissionStatusEnum = pgEnum(
  "submission_status",
  SUBMISSION_STATUSES,
);

export const submissions = pgTable("submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  exerciseId: uuid("exercise_id")
    .notNull()
    .references(() => exercises.id),
  enrolmentId: uuid("enrolment_id")
    .notNull()
    .references(() => enrolments.id),
  studentId: uuid("student_id")
    .notNull()
    .references(() => users.id),
  body: text("body").notNull(),
  fileUrl: text("file_url"),
  status: submissionStatusEnum("status").notNull().default("submitted"),
  score: integer("score"),
  feedback: text("feedback"),
  gradedBy: uuid("graded_by").references(() => users.id),
  gradedAt: timestamp("graded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Submission = typeof submissions.$inferSelect;
export type NewSubmission = typeof submissions.$inferInsert;
