import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { BookOpen, Globe, Clock, CheckCircle2, Star, User } from "lucide-react";
import { api } from "@/lib/api.js";
import type {
  CourseListResponse,
  MyEnrolmentsResponse,
  MyRatingResponse,
} from "@/lib/api.js";
import { Button } from "@/components/ui/button.js";
import { Card, CardContent } from "@/components/ui/card.js";

// ── Inline rating widget for completed courses ──────────────────────────────────

function InlineRating({ courseId }: { courseId: string }) {
  const queryClient = useQueryClient();
  const [hovered, setHovered] = useState(0);
  const [justSubmitted, setJustSubmitted] = useState(false);

  const { data } = useQuery<MyRatingResponse>({
    queryKey: ["my-rating", courseId],
    queryFn: () => api.get<MyRatingResponse>(`/courses/${courseId}/my-rating`),
  });

  const mutation = useMutation({
    mutationFn: (rating: number) =>
      api.post(`/courses/${courseId}/ratings`, { rating }),
    onSuccess: () => {
      setJustSubmitted(true);
      void queryClient.invalidateQueries({
        queryKey: ["my-rating", courseId],
      });
      void queryClient.invalidateQueries({ queryKey: ["courses"] });
    },
  });

  const existing = data?.rating?.rating ?? 0;
  const display = hovered > 0 ? hovered : existing;

  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-meta">Évaluer :</span>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onMouseEnter={() => {
              setHovered(n);
            }}
            onMouseLeave={() => {
              setHovered(0);
            }}
            onClick={() => {
              mutation.mutate(n);
            }}
            disabled={mutation.isPending}
            className="p-0.5 transition-colors"
          >
            <Star
              size={14}
              className={
                n <= display
                  ? "text-yellow-400 fill-yellow-400"
                  : "text-slate-300"
              }
            />
          </button>
        ))}
      </div>
      {justSubmitted && (
        <span className="text-[11px] text-teal font-medium">Merci !</span>
      )}
    </div>
  );
}

export function LearnCatalogPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: coursesData, isLoading } = useQuery({
    queryKey: ["courses"],
    queryFn: () => api.get<CourseListResponse>("/courses"),
  });

  const { data: enrolmentsData } = useQuery({
    queryKey: ["my-enrolments"],
    queryFn: () => api.get<MyEnrolmentsResponse>("/enrolments/my"),
  });

  const enrollMutation = useMutation({
    mutationFn: (courseId: string) =>
      api.post<{ enrolment: { id: string } }>("/enrolments", { courseId }),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ["my-enrolments"] });
      navigate(`/learn/courses/${res.enrolment.id}`);
    },
  });

  const published = (coursesData?.courses ?? []).filter(
    (c) => c.status === "published",
  );

  const enrolledCourseIds = new Set(
    (enrolmentsData?.enrolments ?? [])
      .filter((e) => e.status !== "cancelled")
      .map((e) => e.courseId),
  );

  const enrolledById = new Map(
    (enrolmentsData?.enrolments ?? [])
      .filter((e) => e.status !== "cancelled")
      .map((e) => [e.courseId, e]),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-dark">
          Catalogue des formations
        </h1>
        <p className="text-meta text-sm mt-1">
          {isLoading
            ? "Chargement…"
            : `${String(published.length)} formation${published.length !== 1 ? "s" : ""} disponible${published.length !== 1 ? "s" : ""}`}
        </p>
      </div>

      {isLoading ? (
        <p className="text-meta text-sm">Chargement…</p>
      ) : published.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <BookOpen size={32} className="text-meta/40 mx-auto mb-3" />
            <p className="text-meta text-sm">
              Aucune formation disponible pour le moment.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {published.map((course) => {
            const enrolment = enrolledById.get(course.id);
            const isEnrolled = enrolledCourseIds.has(course.id);
            return (
              <Card key={course.id} className="flex flex-col">
                <CardContent className="flex flex-col flex-1 p-5 gap-4">
                  <div className="w-10 h-10 rounded bg-teal/10 flex items-center justify-center">
                    <BookOpen size={18} className="text-teal" />
                  </div>

                  <div className="flex-1">
                    <h2 className="font-semibold text-dark leading-snug">
                      {course.title}
                    </h2>
                    {course.description !== null && (
                      <p className="text-sm text-meta mt-1.5 line-clamp-3">
                        {course.description}
                      </p>
                    )}
                  </div>

                  {course.instructorName !== null && (
                    <p className="text-xs text-meta flex items-center gap-1">
                      <User size={11} />
                      {course.instructorName}
                    </p>
                  )}

                  <div className="flex items-center gap-3 text-xs text-meta">
                    <span className="flex items-center gap-1">
                      <Globe size={11} />
                      {course.language.toUpperCase()}
                    </span>
                    {course.averageRating > 0 && (
                      <span className="flex items-center gap-1 text-yellow-500">
                        <Star size={11} fill="currentColor" />
                        {String(course.averageRating)}
                        <span className="text-meta/60">
                          ({String(course.totalRatings)})
                        </span>
                      </span>
                    )}
                    {isEnrolled && enrolment !== undefined && (
                      <span className="flex items-center gap-1 text-teal">
                        <Clock size={11} />
                        {String(Math.round(enrolment.completionPct))}% terminé
                      </span>
                    )}
                  </div>

                  {isEnrolled && enrolment !== undefined ? (
                    <div className="space-y-2">
                      <div className="h-1.5 bg-rule rounded-full overflow-hidden">
                        <div
                          className="h-full bg-teal rounded-full"
                          style={{
                            width: `${String(Math.round(enrolment.completionPct))}%`,
                          }}
                        />
                      </div>
                      {enrolment.status === "completed" && (
                        <InlineRating courseId={course.id} />
                      )}
                      <button
                        onClick={() => {
                          navigate(`/learn/courses/${enrolment.enrolmentId}`);
                        }}
                        className="w-full flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider text-teal border border-teal/40 px-3 py-2 hover:bg-teal/5 transition-colors"
                      >
                        <CheckCircle2 size={13} />
                        {enrolment.status === "completed"
                          ? "Voir la formation"
                          : "Continuer la formation"}
                      </button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={enrollMutation.isPending}
                      onClick={() => {
                        enrollMutation.mutate(course.id);
                      }}
                    >
                      {enrollMutation.isPending ? "Inscription…" : "S'inscrire"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
