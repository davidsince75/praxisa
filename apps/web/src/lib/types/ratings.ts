// Course ratings — shared API response types.
// Split out of lib/api.ts; consumed via re-export from @/lib/api.

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
