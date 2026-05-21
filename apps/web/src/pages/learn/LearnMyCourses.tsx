import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Award, BookOpen, CheckCircle2, Clock, XCircle } from "lucide-react";
import { api } from "@/lib/api.js";
import type { MyEnrolmentsResponse } from "@/lib/api.js";
import { Badge } from "@/components/ui/badge.js";
import { Card, CardContent } from "@/components/ui/card.js";
import { Button } from "@/components/ui/button.js";
import { formatDate } from "@/lib/utils.js";

function statusVariant(status: string) {
  if (status === "completed") return "completed" as const;
  if (status === "cancelled") return "rejected" as const;
  return "in_progress" as const;
}

const STATUS_LABELS: Record<string, string> = {
  active: "En cours",
  completed: "Termine",
  cancelled: "Annule",
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
      <span className="text-xs text-meta tabular-nums w-8 text-right">
        {String(safe)}%
      </span>
    </div>
  );
}

export function LearnMyCoursesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-enrolments"],
    queryFn: () => api.get<MyEnrolmentsResponse>("/enrolments/my"),
  });

  const enrolments = data?.enrolments ?? [];
  const active = enrolments.filter((e) => e.status === "active");
  const completed = enrolments.filter((e) => e.status === "completed");
  const others = enrolments.filter(
    (e) => e.status !== "active" && e.status !== "completed",
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-dark">Mes formations</h1>
        <p className="text-meta text-sm mt-1">
          {isLoading
            ? "Chargement..."
            : `${String(enrolments.length)} formation${enrolments.length !== 1 ? "s" : ""}`}
        </p>
      </div>

      {isLoading ? (
        <p className="text-meta text-sm">Chargement...</p>
      ) : enrolments.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <BookOpen size={32} className="text-meta/40 mx-auto mb-3" />
            <p className="text-meta text-sm mb-4">
              Vous n&apos;etes inscrit a aucune formation.
            </p>
            <Link to="/learn/catalog">
              <Button size="sm">Parcourir le catalogue</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Active courses */}
          {active.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-widest text-meta">
                En cours
              </h2>
              <div className="grid gap-4">
                {active.map((e) => (
                  <Card key={e.enrolmentId}>
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-dark truncate">
                              {e.courseTitle}
                            </h3>
                            <Badge variant={statusVariant(e.status)}>
                              {STATUS_LABELS[e.status] ?? e.status}
                            </Badge>
                          </div>
                          {e.courseDescription !== null && (
                            <p className="text-sm text-meta line-clamp-2">
                              {e.courseDescription}
                            </p>
                          )}
                          <ProgressBar pct={e.completionPct} />
                          <div className="flex items-center gap-3 text-xs text-meta pt-0.5">
                            <span className="flex items-center gap-1">
                              <Clock size={11} />
                              Inscrit le {formatDate(e.enrolledAt)}
                            </span>
                            {e.expiresAt !== null && (
                              <span className="text-rose">
                                Expire le {formatDate(e.expiresAt)}
                              </span>
                            )}
                          </div>
                        </div>
                        <Link
                          to={`/learn/courses/${e.enrolmentId}`}
                          className="flex-shrink-0"
                        >
                          <Button size="sm">
                            <CheckCircle2 size={13} className="mr-1.5" />
                            Continuer
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* Completed courses — with certificate link */}
          {completed.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-widest text-meta">
                Terminees
              </h2>
              <div className="grid gap-3">
                {completed.map((e) => (
                  <Card key={e.enrolmentId}>
                    <CardContent className="p-4 flex items-center gap-4">
                      <CheckCircle2
                        size={16}
                        className="text-teal flex-shrink-0"
                      />
                      <span className="flex-1 text-sm font-medium text-dark truncate">
                        {e.courseTitle}
                      </span>
                      {e.completedAt !== null && (
                        <span className="text-xs text-meta hidden sm:block">
                          {formatDate(e.completedAt)}
                        </span>
                      )}
                      <Badge variant="completed">
                        {STATUS_LABELS.completed}
                      </Badge>
                      <Link
                        to={`/learn/courses/${e.enrolmentId}/certificate`}
                        className="flex-shrink-0"
                      >
                        <Button size="sm" variant="outline">
                          <Award size={13} className="mr-1.5 text-teal" />
                          Certificat
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* Cancelled */}
          {others.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-widest text-meta">
                Annulees
              </h2>
              <div className="grid gap-3">
                {others.map((e) => (
                  <Card key={e.enrolmentId} className="opacity-70">
                    <CardContent className="p-4 flex items-center gap-4">
                      <XCircle size={16} className="text-rose flex-shrink-0" />
                      <span className="flex-1 text-sm font-medium text-dark truncate">
                        {e.courseTitle}
                      </span>
                      <Badge variant={statusVariant(e.status)}>
                        {STATUS_LABELS[e.status] ?? e.status}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
