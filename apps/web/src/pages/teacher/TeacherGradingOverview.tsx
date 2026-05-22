import { useQuery, useQueries } from "@tanstack/react-query";
import { ClipboardList, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api.js";
import type { CourseListResponse, SubmissionStatsResponse } from "@/lib/api.js";
import { useAuth } from "@/hooks/useAuth.js";
import { Badge } from "@/components/ui/badge.js";
import { Card, CardContent } from "@/components/ui/card.js";

export function TeacherGradingOverviewPage() {
  const { user } = useAuth();

  const { data: coursesData, isLoading: coursesLoading } = useQuery({
    queryKey: ["courses"],
    queryFn: () => api.get<CourseListResponse>("/courses"),
  });

  const myCourses = (coursesData?.courses ?? []).filter(
    (c) => c.instructorId === user?.id,
  );

  const statsQueries = useQueries({
    queries: myCourses.map((course) => ({
      queryKey: ["submission-stats", course.id],
      queryFn: () =>
        api.get<SubmissionStatsResponse>(
          `/courses/${course.id}/submissions/stats`,
        ),
    })),
  });

  const isLoading = coursesLoading || statsQueries.some((q) => q.isLoading);

  const courseRows = myCourses.map((course, idx) => {
    const stats = statsQueries[idx]?.data?.stats;
    return {
      ...course,
      submitted: stats?.submitted ?? 0,
      grading: stats?.grading ?? 0,
      graded: stats?.graded ?? 0,
    };
  });

  const totalPending = courseRows.reduce(
    (sum, c) => sum + c.submitted + c.grading,
    0,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-dark">Travaux</h1>
        <p className="text-meta text-sm mt-1">
          {isLoading
            ? "Chargement…"
            : `${String(totalPending)} travau${totalPending !== 1 ? "x" : ""} en attente de correction`}
        </p>
      </div>

      {isLoading ? (
        <p className="text-meta text-sm">Chargement…</p>
      ) : myCourses.length === 0 ? (
        <Card>
          <CardContent className="p-12 flex flex-col items-center text-center gap-3">
            <ClipboardList size={32} className="text-meta/40" />
            <p className="text-meta text-sm">Aucun cours pour le moment.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {courseRows.map((course) => {
            const pending = course.submitted + course.grading;
            return (
              <Card key={course.id}>
                <CardContent className="p-0">
                  <Link
                    to={`/teacher/courses/${course.id}/grading`}
                    className="flex items-center justify-between px-6 py-4 hover:bg-cream/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <ClipboardList
                        size={16}
                        className="text-teal flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-dark truncate">
                          {course.title}
                        </p>
                        <p className="text-xs text-meta mt-0.5">
                          {String(course.graded)} corrigé
                          {course.graded !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {pending > 0 ? (
                        <Badge variant="pending">
                          {String(pending)} en attente
                        </Badge>
                      ) : (
                        <Badge variant="completed">À jour</Badge>
                      )}
                      <ArrowRight size={14} className="text-meta" />
                    </div>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
