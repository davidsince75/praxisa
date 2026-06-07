import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "../../db/index.js";
import {
  courseModules,
  courses,
  enrolments,
  lessonProgress,
  lessons,
} from "../../db/schema/index.js";

// ── Course helpers ─────────────────────────────────────────────────────────────

/**
 * Verify a course exists and is not soft-deleted.
 * Returns the course row or undefined.
 */
export async function findActiveCourse(db: Db, courseId: string) {
  const rows = await db
    .select()
    .from(courses)
    .where(and(eq(courses.id, courseId), isNull(courses.deletedAt)))
    .limit(1);
  return rows[0];
}

/**
 * Verify that a user is the assigned instructor for a course,
 * or that the caller is an admin (checked separately by the route).
 */
export function isInstructor(
  course: { instructorId: string | null },
  userId: string,
): boolean {
  return course.instructorId === userId;
}

// ── Module helpers ─────────────────────────────────────────────────────────────

export async function findModule(db: Db, moduleId: string, courseId: string) {
  const rows = await db
    .select()
    .from(courseModules)
    .where(
      and(eq(courseModules.id, moduleId), eq(courseModules.courseId, courseId)),
    )
    .limit(1);
  return rows[0];
}

// ── Lesson helpers ─────────────────────────────────────────────────────────────

export async function findLesson(db: Db, lessonId: string, moduleId: string) {
  const rows = await db
    .select()
    .from(lessons)
    .where(and(eq(lessons.id, lessonId), eq(lessons.moduleId, moduleId)))
    .limit(1);
  return rows[0];
}

// ── Enrolment helpers ──────────────────────────────────────────────────────────

export async function findActiveEnrolment(db: Db, enrolmentId: string) {
  const rows = await db
    .select()
    .from(enrolments)
    .where(and(eq(enrolments.id, enrolmentId), isNull(enrolments.deletedAt)))
    .limit(1);
  return rows[0];
}

/**
 * Check whether a student already has an active enrolment for a course.
 */
export async function findExistingEnrolment(
  db: Db,
  studentId: string,
  courseId: string,
) {
  const rows = await db
    .select({ id: enrolments.id, status: enrolments.status })
    .from(enrolments)
    .where(
      and(
        eq(enrolments.studentId, studentId),
        eq(enrolments.courseId, courseId),
        isNull(enrolments.deletedAt),
      ),
    )
    .limit(1);
  return rows[0];
}

// ── Provisional helpers ───────────────────────────────────────────────────────

/**
 * Check whether an enrolment is in the 14-day trial period.
 * Provisional = provisionalUntil is non-null and in the future.
 */
export function isProvisionalEnrolment(enrolment: {
  provisionalUntil: Date | null;
}): boolean {
  return (
    enrolment.provisionalUntil !== null &&
    enrolment.provisionalUntil > new Date()
  );
}

/**
 * If the trial period has elapsed, clear provisionalUntil so the student
 * gets full access going forward. Returns the (possibly updated) enrolment.
 */
export async function maybeClearExpiredProvisional(
  db: Db,
  enrolment: { id: string; provisionalUntil: Date | null },
) {
  if (
    enrolment.provisionalUntil !== null &&
    enrolment.provisionalUntil <= new Date()
  ) {
    await db
      .update(enrolments)
      .set({ provisionalUntil: null, updatedAt: new Date() })
      .where(eq(enrolments.id, enrolment.id));
    return { ...enrolment, provisionalUntil: null };
  }
  return enrolment;
}

// ── Progress helpers ───────────────────────────────────────────────────────────

/**
 * Compute overall course completion percentage for an enrolment.
 * Returns 0–100.
 */
export function computeCompletion(progress: { status: string }[]): number {
  if (progress.length === 0) return 0;
  const done = progress.filter((p) => p.status === "completed").length;
  return Math.round((done / progress.length) * 100);
}

/**
 * Upsert lesson progress record (insert or update on conflict).
 */
export async function upsertLessonProgress(
  db: Db,
  enrolmentId: string,
  lessonId: string,
  status: "not_started" | "in_progress" | "completed",
  timeSpentSeconds?: number,
) {
  const now = new Date();
  const startedAt = status !== "not_started" ? now : undefined;
  const completedAt = status === "completed" ? now : undefined;

  const existing = await db
    .select()
    .from(lessonProgress)
    .where(
      and(
        eq(lessonProgress.enrolmentId, enrolmentId),
        eq(lessonProgress.lessonId, lessonId),
      ),
    )
    .limit(1);

  if (existing[0] === undefined) {
    const rows = await db
      .insert(lessonProgress)
      .values({
        enrolmentId,
        lessonId,
        status,
        startedAt: startedAt ?? null,
        completedAt: completedAt ?? null,
        timeSpentSeconds: timeSpentSeconds ?? 0,
      })
      .returning();
    return rows[0];
  }

  const rows = await db
    .update(lessonProgress)
    .set({
      status,
      ...(startedAt !== undefined &&
        existing[0].startedAt === null && { startedAt }),
      ...(completedAt !== undefined && { completedAt }),
      ...(timeSpentSeconds !== undefined && { timeSpentSeconds }),
      updatedAt: now,
    })
    .where(
      and(
        eq(lessonProgress.enrolmentId, enrolmentId),
        eq(lessonProgress.lessonId, lessonId),
      ),
    )
    .returning();
  return rows[0];
}
