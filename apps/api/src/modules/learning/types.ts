import { z } from "zod";

// ── Course ─────────────────────────────────────────────────────────────────────

export const createCourseSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "slug must be lowercase alphanumeric with hyphens"),
  title: z.string().min(1).max(200).trim(),
  description: z.string().max(5000).trim().optional(),
  instructorId: z.string().uuid().optional(),
  language: z.string().min(2).max(10).default("fr"),
  thumbnailUrl: z.string().url().optional(),
});

export const updateCourseSchema = createCourseSchema.partial();

export type CreateCourseBody = z.infer<typeof createCourseSchema>;
export type UpdateCourseBody = z.infer<typeof updateCourseSchema>;

// ── Module ─────────────────────────────────────────────────────────────────────

export const createModuleSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  description: z.string().max(2000).trim().optional(),
  position: z.number().int().min(0).default(0),
});

export const updateModuleSchema = createModuleSchema.partial();

export const reorderModulesSchema = z.object({
  order: z
    .array(
      z.object({ id: z.string().uuid(), position: z.number().int().min(0) }),
    )
    .min(1),
});

export type CreateModuleBody = z.infer<typeof createModuleSchema>;
export type UpdateModuleBody = z.infer<typeof updateModuleSchema>;
export type ReorderModulesBody = z.infer<typeof reorderModulesSchema>;

// ── Lesson ─────────────────────────────────────────────────────────────────────

export const createLessonSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  description: z.string().max(2000).trim().optional(),
  position: z.number().int().min(0).default(0),
  contentType: z
    .enum(["video", "text", "pdf", "audio", "live"])
    .default("text"),
  contentUrl: z.string().url().optional(),
  durationMinutes: z.number().int().min(0).optional(),
  isFreePreview: z.boolean().default(false),
});

export const updateLessonSchema = createLessonSchema.partial();

export type CreateLessonBody = z.infer<typeof createLessonSchema>;
export type UpdateLessonBody = z.infer<typeof updateLessonSchema>;

// ── Exercise ───────────────────────────────────────────────────────────────────

export const createExerciseSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  description: z.string().max(5000).trim().optional(),
  position: z.number().int().min(0).default(0),
  type: z.enum(["quiz", "assignment", "reflection"]),
  maxScore: z.number().int().min(0).optional(),
  isRequired: z.boolean().default(true),
});

export const updateExerciseSchema = createExerciseSchema.partial();

export type CreateExerciseBody = z.infer<typeof createExerciseSchema>;
export type UpdateExerciseBody = z.infer<typeof updateExerciseSchema>;

// ── Enrolment ──────────────────────────────────────────────────────────────────

export const createEnrolmentSchema = z.object({
  courseId: z.string().uuid(),
  // studentId present = admin enrolling someone else; absent = self-enrol
  studentId: z.string().uuid().optional(),
  expiresAt: z.string().datetime().optional(),
});

export type CreateEnrolmentBody = z.infer<typeof createEnrolmentSchema>;

// ── Progress ───────────────────────────────────────────────────────────────────

export const upsertProgressSchema = z.object({
  status: z.enum(["not_started", "in_progress", "completed"]),
  timeSpentSeconds: z.number().int().min(0).optional(),
});

export type UpsertProgressBody = z.infer<typeof upsertProgressSchema>;
