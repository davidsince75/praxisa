// Submissions, grading, student documents — shared API response types.
// Split out of lib/api.ts; consumed via re-export from @/lib/api.

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
