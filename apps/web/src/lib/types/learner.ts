// Enrolments, learner quiz, certificates — shared API response types.
// Split out of lib/api.ts; consumed via re-export from @/lib/api.

// ── Learner: enrolments ────────────────────────────────────────────────────────

export interface MyEnrolment {
  enrolmentId: string;
  status: "active" | "completed" | "cancelled";
  enrolledAt: string;
  completedAt: string | null;
  expiresAt: string | null;
  provisionalUntil: string | null;
  isProvisional: boolean;
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
  correctOptionId?: string;
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
