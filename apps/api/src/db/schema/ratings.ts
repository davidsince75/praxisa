import {
  pgTable,
  uuid,
  integer,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { courses } from "./learning.js";

export const courseRatings = pgTable(
  "course_ratings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.courseId, t.studentId)],
);
