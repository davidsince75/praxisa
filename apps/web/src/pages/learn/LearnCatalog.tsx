import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  BookOpen,
  Globe,
  Clock,
  CheckCircle2,
  Lock,
  Star,
  User,
  ShieldAlert,
} from "lucide-react";
import { api } from "@/lib/api.js";
import { useAuth } from "@/hooks/useAuth.js";
import { useRestrictionStatus } from "@/hooks/useRestrictionStatus.js";
import type {
  CourseListResponse,
  MyEnrolmentsResponse,
  MyRatingResponse,
} from "@/lib/api.js";
import { Button } from "@/components/ui/button.js";
import { Card, CardContent } from "@/components/ui/card.js";
import { formatPrice } from "@/lib/utils.js";

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
      <span className="text-xs text-meta">Évaluer :</span>
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
        <span className="text-xs text-teal font-medium">Merci !</span>
      )}
    </div>
  );
}

export function LearnCatalogPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const purchaseStatus = searchParams.get("purchase");
  const { user: authUser } = useAuth();
  // Live restriction from /auth/me (reflects admin toggles without re-login);
  // fall back to the cached login-time value while it loads.
  const liveRestricted = useRestrictionStatus();
  const cachedRestricted = authUser?.isRestricted === true;
  const isRestricted = liveRestricted ?? cachedRestricted;

  const { data: coursesData, isLoading } = useQuery({
    queryKey: ["courses"],
    queryFn: () => api.get<CourseListResponse>("/courses"),
  });

  const { data: enrolmentsData } = useQuery({
    queryKey: ["my-enrolments"],
    queryFn: () => api.get<MyEnrolmentsResponse>("/enrolments/my"),
  });

  const [enrollError, setEnrollError] = useState<string | null>(null);

  const enrollMutation = useMutation({
    mutationFn: (courseId: string) =>
      api.post<{ enrolment: { id: string } }>("/enrolments", { courseId }),
    onSuccess: (res) => {
      setEnrollError(null);
      void queryClient.invalidateQueries({ queryKey: ["my-enrolments"] });
      navigate(`/learn/courses/${res.enrolment.id}`);
    },
    onError: (err: unknown) => {
      setEnrollError(
        err instanceof Error ? err.message : "Erreur lors de l'inscription",
      );
    },
  });

  const published = (coursesData?.courses ?? []).filter(
    (c) => c.status === "published",
  );

  const myEnrolments = (enrolmentsData?.enrolments ?? []).filter(
    (e) => e.status !== "cancelled",
  );

  // Check if student has an active provisional enrolment
  const hasProvisionalEnrolment = myEnrolments.some((e) => e.isProvisional);

  // A restricted student who has unlocked full access to their course (paid or
  // admin-granted) should no longer see the account-restriction notice — the
  // 3-module trial cap no longer applies to them. Mirrors the course player,
  // which already hides its restriction banner once hasFullAccess is true.
  const hasFullCourseAccess = myEnrolments.some((e) => e.hasFullAccess);

  const enrolledCourseIds = new Set(myEnrolments.map((e) => e.courseId));

  const enrolledById = new Map(
    (enrolmentsData?.enrolments ?? [])
      .filter((e) => e.status !== "cancelled")
      .map((e) => [e.courseId, e]),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-dark">
          Catalogue des formations
        </h1>
        <p className="text-meta text-sm mt-1">
          {isLoading
            ? "Chargement…"
            : `${String(published.length)} formation${published.length !== 1 ? "s" : ""} disponible${published.length !== 1 ? "s" : ""}`}
        </p>
      </div>

      {purchaseStatus === "success" && (
        <div className="flex items-start gap-3 rounded-lg border border-olive/30 bg-olive/5 px-4 py-3">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-olive" />
          <div>
            <p className="text-sm font-semibold text-dark">
              Paiement enregistré
            </p>
            <p className="mt-0.5 text-xs text-meta">
              Votre mandat a été confirmé. L'accès complet s'active dès le
              premier prélèvement (sous quelques jours).
            </p>
          </div>
        </div>
      )}
      {purchaseStatus === "cancelled" && (
        <div className="rounded-lg border border-rule bg-cream-mid/40 px-4 py-3 text-sm text-meta">
          Paiement annulé. Vous pouvez réessayer à tout moment.
        </div>
      )}

      {isRestricted && !hasFullCourseAccess && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <ShieldAlert size={18} className="text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              Compte en accès restreint
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Vous pouvez vous inscrire à une seule formation et accéder aux 3
              premiers modules. Contactez l'administrateur pour obtenir l'accès
              complet.
            </p>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-meta text-sm">Chargement…</p>
      ) : published.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <BookOpen size={32} className="text-meta mx-auto mb-3" />
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
                    {course.priceCents !== null && (
                      <p className="mt-2 text-sm font-semibold text-dark">
                        {formatPrice(course.priceCents, course.currency)}
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
                        <span className="text-meta">
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
                        className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-teal border border-teal/40 px-3 py-2 hover:bg-teal/5 transition-colors"
                      >
                        <CheckCircle2 size={13} />
                        {enrolment.status === "completed"
                          ? "Voir la formation"
                          : "Continuer la formation"}
                      </button>
                    </div>
                  ) : isRestricted && myEnrolments.length > 0 ? (
                    <div className="flex items-center justify-center gap-2 text-xs text-amber-600 py-2 border border-amber-200 rounded bg-amber-50/50">
                      <Lock size={13} />
                      Accès restreint — 1 formation max
                    </div>
                  ) : hasProvisionalEnrolment ? (
                    <div className="flex items-center justify-center gap-2 text-xs text-meta py-2 border border-rule rounded opacity-60">
                      <Lock size={13} />
                      Confirmez votre inscription actuelle
                    </div>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        className="w-full"
                        disabled={enrollMutation.isPending}
                        onClick={() => {
                          setEnrollError(null);
                          enrollMutation.mutate(course.id);
                        }}
                      >
                        {enrollMutation.isPending
                          ? "Inscription…"
                          : course.priceCents !== null
                            ? "Essai gratuit"
                            : "S'inscrire"}
                      </Button>
                      {course.priceCents !== null && (
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="w-full"
                        >
                          <Link to={`/learn/courses/${course.id}/buy`}>
                            Acheter —{" "}
                            {formatPrice(course.priceCents, course.currency)}
                          </Link>
                        </Button>
                      )}
                      {enrollError !== null && (
                        <p className="text-xs text-rose mt-1">{enrollError}</p>
                      )}
                    </>
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
