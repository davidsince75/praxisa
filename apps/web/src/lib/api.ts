const API_BASE = "/v1";
const TOKEN_KEY = "praxisa_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token !== null ? { Authorization: `Bearer ${token}` } : {}),
    ...(init.headers as Record<string, string> | undefined),
  };

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (!res.ok) {
    const body = (await res
      .json()
      .catch(() => ({ message: res.statusText }))) as {
      message?: string;
      error?: string;
    };
    const message = body.message ?? body.error ?? res.statusText;
    if (res.status === 401) {
      console.error(`[api] 401 on ${init.method ?? "GET"} ${path}:`, message);
      clearToken();
      window.location.href = "/login";
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

// ── Typed response shapes ──────────────────────────────────────────────────────

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    role: string;
    firstName: string;
    lastName: string;
  };
}

export interface DsrRequest {
  id: string;
  userId: string;
  type: "erasure" | "access" | "portability" | "rectification";
  status: "pending" | "in_progress" | "completed" | "rejected";
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  completedBy: string | null;
  notes: string | null;
}

export interface DsrListResponse {
  requests: DsrRequest[];
}

export interface AuditEvent {
  id: string;
  eventAt: string;
  actorUserId: string | null;
  eventType: string;
  entityType: string;
  entityId: string;
  dataClassification: string;
  requestId: string | null;
  sourceIp: string | null;
  metadata: Record<string, unknown> | null;
}

export interface AuditEventsResponse {
  events: AuditEvent[];
  pagination: { limit: number; offset: number; count: number };
}

// ── Users ──────────────────────────────────────────────────────────────────────

export type UserRole = "admin" | "instructor" | "student" | "migration_lead";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  emailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface UserListResponse {
  users: User[];
  meta: { total: number; page: number; limit: number; pages: number };
}

// ── Courses ────────────────────────────────────────────────────────────────────

export interface Course {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: "draft" | "published" | "archived";
  instructorId: string | null;
  language: string;
  thumbnailUrl: string | null;
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

// ── Learner: enrolments ────────────────────────────────────────────────────────

export interface MyEnrolment {
  enrolmentId: string;
  status: "active" | "completed" | "cancelled";
  enrolledAt: string;
  completedAt: string | null;
  expiresAt: string | null;
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  courseDescription: string | null;
  courseThumbnailUrl: string | null;
  courseLanguage: string;
  completionPct: number;
}

export interface MyEnrolmentsResponse {
  enrolments: MyEnrolment[];
}

export interface EnrolmentDetail {
  enrolment: {
    id: string;
    courseId: string;
    studentId: string;
    status: "active" | "completed" | "cancelled";
    createdAt: string;
    completedAt: string | null;
  };
  progress: {
    id: string;
    enrolmentId: string;
    lessonId: string;
    status: "not_started" | "in_progress" | "completed";
    completedAt: string | null;
  }[];
  completionPct: number;
}

// ── Learner: quiz ──────────────────────────────────────────────────────────────

export interface QuizOption {
  id: string;
  text: string;
}

export interface QuizQuestion {
  id: string;
  position: number;
  questionText: string;
  options: QuizOption[];
  explanation: string | null;
}

export interface ExerciseWithQuestions {
  exercise: {
    id: string;
    lessonId: string;
    title: string;
    description: string | null;
    type: string;
    maxScore: number | null;
    isRequired: boolean;
  };
  questions: QuizQuestion[];
}

export interface QuizAttemptResult {
  score: number;
  maxScore: number;
  passed: boolean;
  completedAt: string;
  feedback: {
    questionId: string;
    correct: boolean;
    explanation: string | null;
  }[];
}

// ── Analytics ──────────────────────────────────────────────────────────────────

export interface AdminOverviewResponse {
  totalUsers: number;
  usersByRole: Record<string, number>;
  totalCourses: number;
  totalEnrolled: number;
  totalCompleted: number;
  completionRate: number;
  enrolmentTrend: { month: string; count: number }[];
  courseStats: {
    id: string;
    title: string;
    status: string;
    enrolled: number;
    active: number;
    completed: number;
  }[];
}

export interface CourseAnalyticsResponse {
  enrolments: { enrolled: number; active: number; completed: number };
  lessonFunnel: {
    lesson_id: string;
    title: string;
    position: number;
    completed_count: number;
  }[];
  quizStats: {
    exercise_id: string;
    title: string;
    max_score: number;
    attempt_count: number;
    avg_score: number;
    pass_count: number;
  }[];
  progressDistribution: { bucket: string; count: number }[];
}

export interface MyAnalyticsResponse {
  totalEnrolled: number;
  totalCompleted: number;
  totalLessonsCompleted: number;
  courseProgress: {
    enrolmentId: string;
    courseTitle: string;
    status: string;
    enrolledAt: string;
    totalLessons: number;
    completedLessons: number;
    completionPct: number;
  }[];
  quizHistory: {
    exerciseTitle: string;
    courseTitle: string;
    score: number;
    maxScore: number;
    passed: boolean;
    completedAt: string;
  }[];
}

// ── Certificates & Enrollment Management ──────────────────────────────────────

export interface CertificateData {
  enrolmentId: string;
  studentName: string;
  courseTitle: string;
  courseId: string;
  completedAt: string | null;
  issuedAt: string;
}

export interface CertificateResponse {
  certificate: CertificateData;
}

export interface TeacherEnrolResponse {
  enrolment: {
    id: string;
    studentId: string;
    courseId: string;
    status: string;
    enrolledAt: string;
  };
}

// ── Messaging ──────────────────────────────────────────────────────────────────

export interface MessageParticipant {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}

export interface MessageItem {
  id: string;
  threadId: string;
  senderId: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface MessageThread {
  id: string;
  courseId: string | null;
  updatedAt: string;
  other: MessageParticipant | null;
  lastMessage: MessageItem | null;
  unreadCount: number;
}

export interface MessageThreadsResponse {
  threads: MessageThread[];
}

export interface MessageThreadDetailResponse {
  thread: {
    id: string;
    participantA: string;
    participantB: string;
    courseId: string | null;
    createdAt: string;
    updatedAt: string;
  };
  messages: MessageItem[];
}

export interface SendMessageResponse {
  threadId: string;
  message: MessageItem;
}

export interface UnreadCountResponse {
  unread: number;
}

// ── Submissions & Grading ──────────────────────────────────────────────────────

export type SubmissionStatus = "submitted" | "grading" | "graded";

export interface Submission {
  id: string;
  exerciseId: string;
  enrolmentId: string;
  studentId: string;
  body: string;
  fileUrl: string | null;
  status: SubmissionStatus;
  score: number | null;
  feedback: string | null;
  gradedBy: string | null;
  gradedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubmissionResponse {
  submission: Submission;
}

export interface CourseSubmissionRow {
  id: string;
  status: SubmissionStatus;
  score: number | null;
  feedback: string | null;
  createdAt: string;
  updatedAt: string;
  gradedAt: string | null;
  exerciseId: string;
  exerciseTitle: string;
  exerciseType: string;
  maxScore: number | null;
  enrolmentId: string;
  studentId: string;
  studentFirstName: string;
  studentLastName: string;
  studentEmail: string;
}

export interface CourseSubmissionsResponse {
  submissions: CourseSubmissionRow[];
}

export interface SubmissionDetailResponse {
  submission: Submission;
  exerciseTitle: string;
  exerciseType: string;
  maxScore: number | null;
}

export interface SubmissionStatsResponse {
  stats: { submitted: number; grading: number; graded: number };
}

// ── AI Assistant ───────────────────────────────────────────────────────────────

export interface AiQueryChunk {
  lessonId: string;
  chunkIndex: number;
  chunkText: string;
  similarity: number;
}

export interface AiQueryResponse {
  answer: string;
  chunks: AiQueryChunk[];
  escalated: boolean;
}

export interface AiIngestResponse {
  lessonId: string;
  chunkCount: number;
}

export interface AiAdminDraft {
  draft: string;
  intentClassification: string;
  requiresReview: true;
  policyPassed: boolean;
}

export interface AiAdminDraftResponse {
  draft: AiAdminDraft;
}
