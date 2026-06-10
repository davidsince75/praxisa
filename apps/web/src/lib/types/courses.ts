// Courses, modules, lessons, quiz authoring — shared API response types.
// Split out of lib/api.ts; consumed via re-export from @/lib/api.

import type { QuizQuestion } from "./learner.js";

export interface Course {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: "draft" | "published" | "archived";
  instructorId: string | null;
  instructorName: string | null;
  averageRating: number;
  totalRatings: number;
  language: string;
  thumbnailUrl: string | null;
  coursePdfId: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface CourseListResponse {
  courses: Course[];
}

export interface SarExport {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    isActive: boolean;
    createdAt: string;
  };
  enrolments: { id: string; courseId: string; enrolledAt: string }[];
  lessonProgress: { lessonId: string; completedAt: string | null }[];
  policyConsents: { policyId: string; consentedAt: string }[];
  auditEvents: { id: string; eventType: string; eventAt: string }[];
}

// ── Learning: modules + lessons ────────────────────────────────────────────────

export interface CourseModule {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export type LessonContentType = "text" | "video" | "pdf" | "audio" | "quiz";

export interface LessonExercise {
  id: string;
  title: string;
  type: string;
  position: number;
  dueAt: string | null;
}

export interface LessonItem {
  id: string;
  moduleId: string;
  title: string;
  description: string | null;
  position: number;
  contentType: LessonContentType;
  contentUrl: string | null;
  contentBody: string | null;
  durationMinutes: number | null;
  isFreePreview: boolean;
  exercises: LessonExercise[];
  createdAt: string;
  updatedAt: string;
}

export interface ModuleWithLessons extends CourseModule {
  lessons: LessonItem[];
}

export interface CourseDetail extends Course {
  modules: ModuleWithLessons[];
}

export interface CourseDetailResponse {
  course: CourseDetail;
}

// GET /v1/courses/:courseId/students
export interface CourseStudent {
  enrolmentId: string;
  status: "active" | "completed" | "cancelled";
  provisionalUntil: string | null;
  enrolledAt: string;
  completedAt: string | null;
  studentId: string;
  email: string;
  firstName: string;
  lastName: string;
  completionPct: number;
}

export interface CourseStudentsResponse {
  students: CourseStudent[];
}

// GET /v1/courses/:courseId/progress
export interface CourseProgressTotals {
  enrolled: number;
  completed: number;
  active: number;
  cancelled: number;
}

export interface CourseProgressStats {
  totals: CourseProgressTotals;
  lessonCompletions: { lessonId: string; completedCount: number }[];
}

// ── Quiz Question Management ──────────────────────────────────────────────────

export interface CreateQuestionsResponse {
  questions: QuizQuestion[];
}
