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

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem("praxisa_user");
}

export function isTokenExpired(): boolean {
  const token = getToken();
  if (token === null) return true;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return true;
    // JWT uses base64url — convert to standard base64 for atob
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4;
    if (pad > 0) {
      b64 += "=".repeat(4 - pad);
    }
    const payload = JSON.parse(atob(b64)) as { exp?: number };
    if (typeof payload.exp !== "number") return false;
    return payload.exp * 1000 < Date.now();
  } catch {
    // If we can't decode the token, don't wipe the session —
    // let the API 401 handler deal with truly invalid tokens.
    return false;
  }
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
      clearAuth();
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

export interface UserSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
}

export interface UserSearchResponse {
  users: UserSearchResult[];
}

// ── Courses ────────────────────────────────────────────────────────────────────

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
  status: "active" | "completed" | "cancelled" | "provisional";
  enrolledAt: string;
  completedAt: string | null;
  expiresAt: string | null;
  provisionalUntil: string | null;
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
    status: "active" | "completed" | "cancelled" | "provisional";
    createdAt: string;
    completedAt: string | null;
    provisionalUntil: string | null;
  };
  progress: {
    id: string;
    enrolmentId: string;
    lessonId: string;
    status: "not_started" | "in_progress" | "completed";
    completedAt: string | null;
  }[];
  completionPct: number;
  isProvisional: boolean;
  provisionalUntil: string | null;
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

export interface AiGradeSuggestion {
  suggestedScore: number;
  suggestedFeedback: string;
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

// ── Campaigns ──────────────────────────────────────────────────────────────────

export type CampaignStatus = "draft" | "sending" | "sent" | "failed";
export type CampaignTarget = "all_students" | "course_enrolled";
export type CampaignDeliveryType = "internal" | "external" | "targeted";

export interface Campaign {
  id: string;
  name: string;
  subject: string | null;
  body: string;
  deliveryType: CampaignDeliveryType;
  targetType: CampaignTarget;
  targetCourseId: string | null;
  status: CampaignStatus;
  recipientCount: number | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignsResponse {
  campaigns: Campaign[];
}

export interface CampaignResponse {
  campaign: Campaign;
}

export interface CampaignSendResponse {
  sent: number;
  recipientCount: number;
}

// ── Notifications ─────────────────────────────────────────────────────────────

export type NotificationType =
  | "new_message"
  | "grading_returned"
  | "campaign_sent"
  | "enrolment_created";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}

// ── Course Ratings ────────────────────────────────────────────────────────────

export interface CourseRating {
  id: string;
  courseId: string;
  studentId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CourseRatingsResponse {
  ratings: CourseRating[];
  averageRating: number;
  totalCount: number;
}

export interface MyRatingResponse {
  rating: CourseRating | null;
}

// Student Detail (teacher forensic view)
export interface StudentDetailLesson {
  id: string;
  title: string;
  contentType: string;
  durationMinutes: number | null;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  timeSpentSeconds: number;
}

export interface StudentDetailModule {
  id: string;
  title: string;
  position: number;
  lessons: StudentDetailLesson[];
}

export interface StudentDetailQuiz {
  attemptId: string;
  exerciseId: string;
  exerciseTitle: string;
  score: number;
  maxScore: number;
  completedAt: string | null;
}

export interface StudentDetailEnrolment {
  enrolmentId: string;
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  status: string;
  enrolledAt: string;
  completedAt: string | null;
  completionPct: number;
  totalTimeSeconds: number;
  modules: StudentDetailModule[];
  quizAttempts: StudentDetailQuiz[];
}

export interface StudentDetailResponse {
  student: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    createdAt: string;
  };
  enrolments: StudentDetailEnrolment[];
}

// Import
export interface ImportUsersResponse {
  created: number;
  skipped: number;
  skippedEmails: string[];
}

export interface ImportEnrolmentsResponse {
  created: number;
  errors: { row: number; reason: string }[];
}
// ── Student Submissions (teacher view) ───────────────────────────────────────

export interface StudentSubmission {
  id: string;
  body: string;
  status: SubmissionStatus;
  score: number | null;
  feedback: string | null;
  createdAt: string;
  gradedAt: string | null;
  exerciseId: string;
  exerciseTitle: string;
  exerciseType: string;
  maxScore: number | null;
  enrolmentId: string;
  courseTitle: string;
}

export interface StudentSubmissionsResponse {
  submissions: StudentSubmission[];
}

// ── Student Documents ────────────────────────────────────────────────────────

export type DocumentStatus = "draft" | "published" | "evaluated";

export interface StudentDocumentRow {
  id: string;
  title: string;
  status: DocumentStatus;
  courseId: string | null;
  moduleId: string | null;
  lessonId: string | null;
  exerciseId: string | null;
  score: number | null;
  publishedAt: string | null;
  evaluatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  studentId: string;
  studentFirstName: string;
  studentLastName: string;
}

export interface StudentDocumentDetail {
  id: string;
  studentId: string;
  courseId: string | null;
  moduleId: string | null;
  lessonId: string | null;
  exerciseId: string | null;
  title: string;
  body: string;
  status: DocumentStatus;
  publishedAt: string | null;
  evaluatedAt: string | null;
  evaluatedBy: string | null;
  feedback: string | null;
  score: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentsResponse {
  documents: StudentDocumentRow[];
}

export interface DocumentResponse {
  document: StudentDocumentDetail;
}

// ── Tags ─────────────────────────────────────────────────────────────────────

export interface TagRow {
  id: string;
  name: string;
  color: string;
  userId: string;
  createdAt: string;
}

export interface TagsResponse {
  tags: TagRow[];
}

// ── Discussion Forums ────────────────────────────────────────────────────────

export interface ForumThreadRow {
  id: string;
  courseId: string;
  lessonId: string | null;
  title: string;
  body: string;
  isPinned: boolean;
  isLocked: boolean;
  createdAt: string;
  authorId: string;
  authorFirstName: string;
  authorLastName: string;
  authorRole: string;
  replyCount: number;
}

export interface ForumReplyRow {
  id: string;
  body: string;
  createdAt: string;
  authorId: string;
  authorFirstName: string;
  authorLastName: string;
  authorRole: string;
}

export interface ForumThreadsResponse {
  threads: ForumThreadRow[];
}

export interface ForumThreadDetailResponse {
  thread: ForumThreadRow & { replyCount?: number };
  replies: ForumReplyRow[];
}

// ── Settings ─────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  createdAt: string;
}

export interface ProfileResponse {
  profile: UserProfile;
}

export interface EmailNotificationPrefs {
  messages: boolean;
  grading: boolean;
  campaigns: boolean;
  forums: boolean;
}

export interface UserPreferencesData {
  theme: string;
  locale: string;
  emailNotifications: EmailNotificationPrefs;
}

export interface PreferencesResponse {
  preferences: UserPreferencesData;
}

// ── Gmail ───────────────────────────────────────────────────────────────────────

export interface GmailStatus {
  connected: boolean;
  email?: string;
  connectedAt?: string;
}

export interface GmailAuthUrlResponse {
  url: string;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  from: string;
  subject: string;
  date: string;
  labelIds: string[];
  isUnread: boolean;
}

export interface GmailMessagesResponse {
  messages: GmailMessage[];
  nextPageToken: string | null;
}

export interface GmailMessageDetail {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  body: string;
  labelIds: string[];
}

export interface GmailAiDraftResponse {
  draft: string;
}

// ── Payments (GoCardless) ───────────────────────────────────────────────────────

export interface PaymentStatusResponse {
  connected: boolean;
}

export interface PaymentItem {
  id: string;
  amount: number;
  currency: string;
  status: string;
  description: string | null;
  reference: string | null;
  createdAt: string;
  chargeDate: string | null;
  metadata: Record<string, string>;
}

export interface PaymentsListResponse {
  payments: PaymentItem[];
  nextCursor: string | null;
}

export interface PaymentLinkResponse {
  id: string;
  paymentUrl: string;
}
