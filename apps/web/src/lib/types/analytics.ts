// Admin, teacher and learner analytics — shared API response types.
// Split out of lib/api.ts; consumed via re-export from @/lib/api.

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
