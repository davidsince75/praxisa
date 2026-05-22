import { useQuery, useQueries } from "@tanstack/react-query";
import { Users, BookOpen, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api.js";
import type { CourseListResponse } from "@/lib/api.js";
import { useAuth } from "@/hooks/useAuth.js";
import { Badge } from "@/components/ui/badge.js";
import { Card, CardContent } from "@/components/ui/card.js";

interface StudentRow {
  enrolmentId: string;
  status: string;
  enrolledAt: string;
  completedAt: string | null;
  studentId: string;
  email: string;
  firstName: string;
  lastName: string;
  completionPct: number;
}

interface CourseStudentsResponse {
  students: StudentRow[];
}

function enrolStatusVariant(status: string) {
  if (status === "completed") return "completed" as const;
  if (status === "cancelled") return "rejected" as const;
  return "in_progress" as const;
}

const ENROL_LABELS: Record<string, string> = {
  active: "Actif",
  completed: "Terminé",
  cancelled: "Annulé",
};

function ProgressBar({ pct }: { pct: number }) {
  const safe = Math.min(100, Math.max(0, Math.round(pct)));
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-rule rounded-full overflow-hidden">
        <div
          className="h-full bg-teal rounded-full transition-all"
          style={{ width: `${String(safe)}%` }}
        />
      </div>
      <span className="text-xs text-meta w-8 text-right">{String(safe)}%</span>
    </div>
  );
}

export function TeacherStudentsPage() {
  const { user } = useAuth();

  const { data: coursesData, isLoading: coursesLoading } = useQuery({
    queryKey: ["courses"],
    queryFn: () => api.get<CourseListResponse>("/courses"),
  });

  const myCourses = (coursesData?.courses ?? []).filter(
    (c) => c.instructorId === user?.id,
  );

  const studentQueries = useQueries({
    queries: myCourses.map((course) => ({
      queryKey: ["course-students", course.id],
      queryFn: () =>
        api.get<CourseStudentsResponse>(`/courses/${course.id}/students`),
    })),
  });

  const isLoading = coursesLoading || studentQueries.some((q) => q.isLoading);

  // Build unified list with course info
  const allStudents: (StudentRow & {
    courseTitle: string;
    courseId: string;
  })[] = [];
  myCourses.forEach((course, idx) => {
    const query = studentQueries[idx];
    if (query?.data?.students) {
      for (const s of query.data.students) {
        allStudents.push({
          ...s,
          courseTitle: course.title,
          courseId: course.id,
        });
      }
    }
  });

  // Deduplicate by studentId to get unique count
  const uniqueStudentIds = new Set(allStudents.map((s) => s.studentId));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-dark">Mes élèves</h1>
        <p className="text-meta text-sm mt-1">
          {isLoading
            ? "Chargement…"
            : `${String(uniqueStudentIds.size)} élève${uniqueStudentIds.size !== 1 ? "s" : ""} sur ${String(myCourses.length)} cours`}
        </p>
      </div>

      {isLoading ? (
        <p className="text-meta text-sm">Chargement…</p>
      ) : allStudents.length === 0 ? (
        <Card>
          <CardContent className="p-12 flex flex-col items-center text-center gap-3">
            <Users size={32} className="text-meta/40" />
            <p className="text-meta text-sm">
              Aucun élève inscrit pour le moment.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-rule">
                    <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-meta">
                      Élève
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-meta">
                      Email
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-meta">
                      Cours
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-meta">
                      Statut
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-meta min-w-[140px]">
                      Progression
                    </th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule">
                  {allStudents.map((s) => (
                    <tr
                      key={`${s.studentId}-${s.courseId}`}
                      className="hover:bg-cream/50 transition-colors"
                    >
                      <td className="px-6 py-3 font-medium">
                        <Link
                          to={`/teacher/students/${s.studentId}`}
                          className="text-teal hover:underline"
                        >
                          {s.firstName} {s.lastName}
                        </Link>
                      </td>
                      <td className="px-6 py-3 text-meta">{s.email}</td>
                      <td className="px-6 py-3">
                        <Link
                          to={`/teacher/courses/${s.courseId}`}
                          className="text-teal hover:underline flex items-center gap-1"
                        >
                          <BookOpen size={12} />
                          <span className="truncate max-w-[180px]">
                            {s.courseTitle}
                          </span>
                        </Link>
                      </td>
                      <td className="px-6 py-3">
                        <Badge variant={enrolStatusVariant(s.status)}>
                          {ENROL_LABELS[s.status] ?? s.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-3">
                        <ProgressBar pct={s.completionPct} />
                      </td>
                      <td className="px-6 py-3 text-right">
                        <Link
                          to="/teacher/messages"
                          className="text-meta hover:text-teal transition-colors"
                          title="Envoyer un message"
                        >
                          <Mail size={14} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
