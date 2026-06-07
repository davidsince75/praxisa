import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";

// ── Enums ──────────────────────────────────────────────────────────────────────

export const COURSE_STATUSES = ["draft", "published", "archived"] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];
export const courseStatusEnum = pgEnum("course_status", COURSE_STATUSES);

export const CONTENT_TYPES = ["video", "text", "pdf", "audio", "live"] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];
export const contentTypeEnum = pgEnum("content_type", CONTENT_TYPES);

export const EXERCISE_TYPES = ["quiz", "assignment", "reflection"] as const;
export type ExerciseType = (typeof EXERCISE_TYPES)[number];
export const exerciseTypeEnum = pgEnum("exercise_type", EXERCISE_TYPES);

export const ENROLMENT_STATUSES = [
  "active",
  "completed",
  "cancelled",
  "paused",
  "expired",
] as const;
export type EnrolmentStatus = (typeof ENROLMENT_STATUSES)[number];
export const enrolmentStatusEnum = pgEnum(
  "enrolment_status",
  ENROLMENT_STATUSES,
);

export const PROGRESS_STATUSES = [
  "not_started",
  "in_progress",
  "completed",
] as const;
export type ProgressStatus = (typeof PROGRESS_STATUSES)[number];
export const progressStatusEnum = pgEnum("progress_status", PROGRESS_STATUSES);

// ── Courses ────────────────────────────────────────────────────────────────────

export const courses = pgTable("courses", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  instructorId: uuid("instructor_id").references(() => users.id),

  status: courseStatusEnum("status").notNull().default("draft"),
  language: text("language").notNull().default("fr"),
  thumbnailUrl: text("thumbnail_url"),
  totalDurationMinutes: integer("total_duration_minutes"),

  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export type Course = typeof courses.$inferSelect;
export type NewCourse = typeof courses.$inferInsert;

// ── Course modules ─────────────────────────────────────────────────────────────

export const courseModules = pgTable("course_modules", {
  id: uuid("id").primaryKey().defaultRandom(),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id),
  title: text("title").notNull(),
  description: text("description"),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type CourseModule = typeof courseModules.$inferSelect;
export type NewCourseModule = typeof courseModules.$inferInsert;

// ── Lessons ────────────────────────────────────────────────────────────────────

export const lessons = pgTable("lessons", {
  id: uuid("id").primaryKey().defaultRandom(),
  moduleId: uuid("module_id")
    .notNull()
    .references(() => courseModules.id),
  title: text("title").notNull(),
  description: text("description"),
  position: integer("position").notNull().default(0),
  contentType: contentTypeEnum("content_type").notNull().default("text"),
  contentUrl: text("content_url"),
  contentBody: text("content_body"),
  durationMinutes: integer("duration_minutes"),
  isFreePreview: boolean("is_free_preview").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Lesson = typeof lessons.$inferSelect;
export type NewLesson = typeof lessons.$inferInsert;

// ── Exercises ──────────────────────────────────────────────────────────────────

export const exercises = pgTable("exercises", {
  id: uuid("id").primaryKey().defaultRandom(),
  lessonId: uuid("lesson_id")
    .notNull()
    .references(() => lessons.id),
  title: text("title").notNull(),
  description: text("description"),
  position: integer("position").notNull().default(0),
  type: exerciseTypeEnum("type").notNull(),
  maxScore: integer("max_score"),
  isRequired: boolean("is_required").notNull().default(true),
  dueAt: timestamp("due_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Exercise = typeof exercises.$inferSelect;
export type NewExercise = typeof exercises.$inferInsert;

// ── Enrolments ─────────────────────────────────────────────────────────────────

export const enrolments = pgTable(
  "enrolments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id),
    // null = student self-enrolled; uuid = admin who enrolled the student
    enrolledBy: uuid("enrolled_by").references(() => users.id),

    status: enrolmentStatusEnum("status").notNull().default("active"),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    provisionalUntil: timestamp("provisional_until", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    unique("enrolments_student_course_unique").on(t.studentId, t.courseId),
  ],
);

export type Enrolment = typeof enrolments.$inferSelect;
export type NewEnrolment = typeof enrolments.$inferInsert;

// ── Lesson progress ────────────────────────────────────────────────────────────

export const lessonProgress = pgTable(
  "lesson_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    enrolmentId: uuid("enrolment_id")
      .notNull()
      .references(() => enrolments.id),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id),
    status: progressStatusEnum("status").notNull().default("not_started"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    timeSpentSeconds: integer("time_spent_seconds").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("lesson_progress_enrolment_lesson_unique").on(
      t.enrolmentId,
      t.lessonId,
    ),
  ],
);

export type LessonProgress = typeof lessonProgress.$inferSelect;
export type NewLessonProgress = typeof lessonProgress.$inferInsert;

// ── Quiz questions ─────────────────────────────────────────────────────────────

export const quizQuestions = pgTable("quiz_questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  exerciseId: uuid("exercise_id")
    .notNull()
    .references(() => exercises.id),
  position: integer("position").notNull().default(0),
  questionText: text("question_text").notNull(),
  // JSON array of { id: string, text: string }
  options: text("options").notNull().default("[]"),
  correctOptionId: text("correct_option_id").notNull(),
  explanation: text("explanation"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type QuizQuestion = typeof quizQuestions.$inferSelect;
export type NewQuizQuestion = typeof quizQuestions.$inferInsert;

// ── Quiz attempts ──────────────────────────────────────────────────────────────

export const quizAttempts = pgTable("quiz_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  exerciseId: uuid("exercise_id")
    .notNull()
    .references(() => exercises.id),
  studentId: uuid("student_id")
    .notNull()
    .references(() => users.id),
  enrolmentId: uuid("enrolment_id")
    .notNull()
    .references(() => enrolments.id),
  // JSON object: { [questionId]: selectedOptionId }
  answers: text("answers").notNull().default("{}"),
  score: integer("score").notNull().default(0),
  maxScore: integer("max_score").notNull().default(0),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type QuizAttempt = typeof quizAttempts.$inferSelect;
export type NewQuizAttempt = typeof quizAttempts.$inferInsert;
