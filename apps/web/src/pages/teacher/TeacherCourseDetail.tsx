import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardList,
  ArrowLeft,
  Wrench,
  Users,
  CheckCircle2,
  Activity,
  XCircle,
  UserPlus,
  X,
  Star,
} from "lucide-react";
import { api } from "@/lib/api.js";
import type {
  CourseDetailResponse,
  CourseStudentsResponse,
  CourseProgressStats,
  TeacherEnrolResponse,
  CourseRatingsResponse,
} from "@/lib/api.js";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { Card, CardContent } from "@/components/ui/card.js";
import { formatDate } from "@/lib/utils.js";

const STATUS_LABELS = {
  draft: "Brouillon",
  published: "Publie",
  archived: "Archive",
};

function statusVariant(status: string) {
  if (status === "published") return "completed" as const;
  if (status === "archived") return "rejected" as const;
  return "pending" as const;
}

function enrolStatusVariant(status: string, provisionalUntil: string | null) {
  if (provisionalUntil !== null && new Date(provisionalUntil) > new Date()) {
    return "pending" as const;
  }
  if (status === "completed") return "completed" as const;
  if (status === "cancelled") return "rejected" as const;
  return "in_progress" as const;
}

function enrolStatusLabel(
  status: string,
  provisionalUntil: string | null,
): string {
  if (provisionalUntil !== null && new Date(provisionalUntil) > new Date()) {
    const days = Math.ceil(
      (new Date(provisionalUntil).getTime() - Date.now()) /
        (24 * 60 * 60 * 1000),
    );
    return `Essai (${String(days)}j restants)`;
  }
  if (status === "completed") return "Terminé";
  if (status === "cancelled") return "Annulé";
  return "Actif";
}

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
          <p className="text-2xl font-semibold text-dark">{String(value)}</p>
          <p className="text-xs text-meta uppercase tracking-wider font-semibold mt-0.5">
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

interface EnrolModalProps {
  courseId: string;
  onClose: () => void;
}

function EnrolModal({ courseId, onClose }: EnrolModalProps) {
  const [email, setEmail] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (studentEmail: string) =>
      api.post<TeacherEnrolResponse>(`/courses/${courseId}/teacher-enrol`, {
        email: studentEmail,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["course-students", courseId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["course-progress", courseId],
      });
      onClose();
    },
    onError: (err: { message?: string }) => {
      setErrorMsg(err.message ?? "Erreur lors de l inscription.");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (email.trim().length === 0) return;
    mutation.mutate(email.trim());
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-dark">
            Inscrire un apprenant
          </h2>
          <button
            onClick={onClose}
            className="text-meta hover:text-dark transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-meta block mb-1.5">
              Adresse email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
              }}
              placeholder="apprenant@exemple.com"
              className="w-full rounded-lg border border-rule bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
              autoFocus
            />
          </div>
          {errorMsg !== null && <p className="text-xs text-rose">{errorMsg}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Annuler
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={mutation.isPending || email.trim().length === 0}
            >
              {mutation.isPending ? "Inscription..." : "Inscrire"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

type Tab = "students" | "ratings";

export function TeacherCourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const id = courseId ?? "";
  const [showEnrolModal, setShowEnrolModal] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("students");
  const queryClient = useQueryClient();

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

  const removeMutation = useMutation({
    mutationFn: (enrolmentId: string) =>
      api.delete<undefined>(`/enrolments/${enrolmentId}/remove`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["course-students", id] });
      void queryClient.invalidateQueries({
        queryKey: ["course-progress", id],
      });
    },
  });

  const { data: ratingsData } = useQuery({
    queryKey: ["course-ratings", id],
    queryFn: () => api.get<CourseRatingsResponse>(`/courses/${id}/ratings`),
    enabled: id.length > 0 && activeTab === "ratings",
  });

  const course = courseData?.course;
  const totals = statsData?.totals;
  const students = studentsData?.students ?? [];

  return (
    <>
      {showEnrolModal && (
        <EnrolModal
          courseId={id}
          onClose={() => {
            setShowEnrolModal(false);
          }}
        />
      )}

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
                <h1 className="text-2xl font-semibold text-dark">
                  {course?.title ?? "Chargement..."}
                </h1>
                {course !== undefined && (
                  <Badge variant={statusVariant(course.status)}>
                    {STATUS_LABELS[course.status]}
                  </Badge>
                )}
              </div>
              <p className="text-meta text-sm mt-1">
                Tableau de bord apprenants
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => {
                setShowEnrolModal(true);
              }}
            >
              <UserPlus size={13} className="mr-1.5" />
              Inscrire
            </Button>
            <Link to={`/teacher/courses/${id}/builder`}>
              <Button size="sm" variant="outline">
                <Wrench size={13} className="mr-1.5" />
                Editeur
              </Button>
            </Link>
            <Link to={`/teacher/courses/${id}/grading`}>
              <Button size="sm" variant="outline">
                <ClipboardList size={13} className="mr-1.5" />
                Travaux
              </Button>
            </Link>
          </div>
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
              label="Termines"
              value={totals.completed}
              icon={<CheckCircle2 size={22} />}
              accent="text-teal"
            />
            <StatCard
              label="Annules"
              value={totals.cancelled}
              icon={<XCircle size={22} />}
              accent="text-rose"
            />
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-4 border-b border-rule">
          <button
            onClick={() => {
              setActiveTab("students");
            }}
            className={`pb-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
              activeTab === "students"
                ? "text-teal border-b-2 border-teal"
                : "text-meta hover:text-dark"
            }`}
          >
            Apprenants
          </button>
          <button
            onClick={() => {
              setActiveTab("ratings");
            }}
            className={`pb-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
              activeTab === "ratings"
                ? "text-teal border-b-2 border-teal"
                : "text-meta hover:text-dark"
            }`}
          >
            Évaluations
          </button>
        </div>

        {/* Student table */}
        {activeTab === "students" && (
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <p className="text-meta text-sm p-6">Chargement...</p>
              ) : students.length === 0 ? (
                <p className="text-meta text-sm p-6">
                  Aucun apprenant inscrit.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-rule">
                        <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider text-meta">
                          Apprenant
                        </th>
                        <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider text-meta">
                          Email
                        </th>
                        <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider text-meta">
                          Statut
                        </th>
                        <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider text-meta">
                          Inscrit le
                        </th>
                        <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider text-meta min-w-[160px]">
                          Progression
                        </th>
                        <th className="px-6 py-3" />
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
                            <Badge
                              variant={enrolStatusVariant(
                                s.status,
                                s.provisionalUntil,
                              )}
                            >
                              {enrolStatusLabel(s.status, s.provisionalUntil)}
                            </Badge>
                          </td>
                          <td className="px-6 py-3 text-meta">
                            {formatDate(s.enrolledAt)}
                          </td>
                          <td className="px-6 py-3">
                            <ProgressBar pct={s.completionPct} />
                          </td>
                          <td className="px-6 py-3 text-right">
                            {s.status !== "cancelled" && (
                              <button
                                onClick={() => {
                                  removeMutation.mutate(s.enrolmentId);
                                }}
                                disabled={removeMutation.isPending}
                                className="text-meta hover:text-rose transition-colors"
                                title="Desinscrire"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Ratings tab */}
        {activeTab === "ratings" && (
          <Card>
            <CardContent className="p-6">
              {ratingsData === undefined ? (
                <p className="text-meta text-sm">Chargement...</p>
              ) : ratingsData.totalCount === 0 ? (
                <p className="text-meta text-sm">
                  Aucune évaluation pour le moment
                </p>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <span className="text-4xl font-semibold text-dark">
                      {String(ratingsData.averageRating)}
                    </span>
                    <div>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            size={16}
                            className={
                              n <= Math.round(ratingsData.averageRating)
                                ? "text-yellow-400 fill-yellow-400"
                                : "text-meta"
                            }
                          />
                        ))}
                      </div>
                      <p className="text-xs text-meta mt-0.5">
                        ({String(ratingsData.totalCount)} évaluation
                        {ratingsData.totalCount !== 1 ? "s" : ""})
                      </p>
                    </div>
                  </div>
                  <div className="divide-y divide-rule">
                    {ratingsData.ratings.map((r) => (
                      <div key={r.id} className="py-4 first:pt-0 last:pb-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <Star
                                key={n}
                                size={12}
                                className={
                                  n <= r.rating
                                    ? "text-yellow-400 fill-yellow-400"
                                    : "text-meta"
                                }
                              />
                            ))}
                          </div>
                          <span className="text-xs text-meta">
                            {formatDate(r.createdAt)}
                          </span>
                        </div>
                        {r.comment !== null && (
                          <p className="text-sm text-dark">{r.comment}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
