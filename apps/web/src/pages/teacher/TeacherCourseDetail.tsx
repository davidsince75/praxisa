import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Wrench,
  Users,
  CheckCircle2,
  Activity,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/api.js";
import type {
  CourseDetailResponse,
  CourseStudentsResponse,
  CourseProgressStats,
} from "@/lib/api.js";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { Card, CardContent } from "@/components/ui/card.js";
import { formatDate } from "@/lib/utils.js";

const STATUS_LABELS = {
  draft: "Brouillon",
  published: "Publié",
  archived: "Archivé",
};

function statusVariant(status: string) {
  if (status === "published") return "completed" as const;
  if (status === "archived") return "rejected" as const;
  return "pending" as const;
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

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent?: string;
}

function StatCard({ label, value, icon, accent = "text-teal" }: StatCardProps) {
  return (
    <Card>
      <CardContent className="px-5 py-4 flex items-center gap-4">
        <div className={`${accent} opacity-80`}>{icon}</div>
        <div>
          <p className="text-2xl font-bold text-dark">{String(value)}</p>
          <p className="text-xs text-meta uppercase tracking-wider font-bold mt-0.5">
            {label}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

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

export function TeacherCourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const id = courseId ?? "";

  const { data: courseData } = useQuery({
    queryKey: ["course", id],
    queryFn: () => api.get<CourseDetailResponse>(`/courses/${id}`),
    enabled: id.length > 0,
  });

  const { data: statsData } = useQuery({
    queryKey: ["course-progress", id],
    queryFn: () => api.get<CourseProgressStats>(`/courses/${id}/progress`),
    enabled: id.length > 0,
  });

  const { data: studentsData, isLoading } = useQuery({
    queryKey: ["course-students", id],
    queryFn: () => api.get<CourseStudentsResponse>(`/courses/${id}/students`),
    enabled: id.length > 0,
  });

  const course = courseData?.course;
  const totals = statsData?.totals;
  const students = studentsData?.students ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Link to="/teacher/courses">
            <button className="mt-1 text-meta hover:text-dark transition-colors">
              <ArrowLeft size={18} />
            </button>
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-dark">
                {course?.title ?? "Chargement…"}
              </h1>
              {course !== undefined && (
                <Badge variant={statusVariant(course.status)}>
                  {STATUS_LABELS[course.status]}
                </Badge>
              )}
            </div>
            <p className="text-meta text-sm mt-1">Tableau de bord apprenants</p>
          </div>
        </div>
        <Link to={`/teacher/courses/${id}/builder`}>
          <Button size="sm" variant="outline">
            <Wrench size={13} className="mr-1.5" />
            Éditeur de contenu
          </Button>
        </Link>
      </div>

      {/* Stats */}
      {totals !== undefined && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            label="Inscrits"
            value={totals.enrolled}
            icon={<Users size={22} />}
          />
          <StatCard
            label="Actifs"
            value={totals.active}
            icon={<Activity size={22} />}
            accent="text-olive"
          />
          <StatCard
            label="Terminé"
            value={totals.completed}
            icon={<CheckCircle2 size={22} />}
            accent="text-teal"
          />
          <StatCard
            label="Annulés"
            value={totals.cancelled}
            icon={<XCircle size={22} />}
            accent="text-rose"
          />
        </div>
      )}

      {/* Student table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-meta text-sm p-6">Chargement…</p>
          ) : students.length === 0 ? (
            <p className="text-meta text-sm p-6">Aucun apprenant inscrit.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-rule">
                    <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-meta">
                      Apprenant
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-meta">
                      Email
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-meta">
                      Statut
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-meta">
                      Inscrit le
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-meta min-w-[160px]">
                      Progression
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule">
                  {students.map((s) => (
                    <tr
                      key={s.enrolmentId}
                      className="hover:bg-cream/50 transition-colors"
                    >
                      <td className="px-6 py-3 font-medium text-dark">
                        {s.firstName} {s.lastName}
                      </td>
                      <td className="px-6 py-3 text-meta">{s.email}</td>
                      <td className="px-6 py-3">
                        <Badge variant={enrolStatusVariant(s.status)}>
                          {ENROL_LABELS[s.status] ?? s.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-3 text-meta">
                        {formatDate(s.enrolledAt)}
                      </td>
                      <td className="px-6 py-3">
                        <ProgressBar pct={s.completionPct} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
