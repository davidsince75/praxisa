import { useQuery } from "@tanstack/react-query";
import { Award, Download } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api.js";
import type { MyEnrolmentsResponse } from "@/lib/api.js";
import { Card, CardContent } from "@/components/ui/card.js";
import { Button } from "@/components/ui/button.js";
import { formatDate } from "@/lib/utils.js";

export function LearnCertificatesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-enrolments"],
    queryFn: () => api.get<MyEnrolmentsResponse>("/enrolments/my"),
  });

  const completed = (data?.enrolments ?? []).filter(
    (e) => e.status === "completed",
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-dark">Mes certificats</h1>
        <p className="text-meta text-sm mt-1">
          {isLoading
            ? "Chargement…"
            : `${String(completed.length)} certificat${completed.length !== 1 ? "s" : ""} obtenu${completed.length !== 1 ? "s" : ""}`}
        </p>
      </div>

      {isLoading ? (
        <p className="text-meta text-sm">Chargement…</p>
      ) : completed.length === 0 ? (
        <Card>
          <CardContent className="p-12 flex flex-col items-center text-center gap-3">
            <Award size={32} className="text-meta" />
            <p className="text-meta text-sm">
              Aucun certificat pour le moment. Terminez un cours pour obtenir
              votre certificat.
            </p>
            <Link to="/learn/catalog">
              <Button size="sm" variant="outline">
                Voir le catalogue
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {completed.map((e) => (
            <Card key={e.enrolmentId}>
              <CardContent className="p-6 flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-teal/10 flex items-center justify-center flex-shrink-0">
                  <Award size={22} className="text-teal" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-dark text-sm truncate">
                    {e.courseTitle}
                  </h3>
                  <p className="text-xs text-meta mt-0.5">
                    Terminé le{" "}
                    {e.completedAt !== null ? formatDate(e.completedAt) : "—"}
                  </p>
                  <Link
                    to={`/learn/courses/${e.enrolmentId}/certificate`}
                    className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold uppercase tracking-wider text-teal hover:text-teal/70 transition-colors"
                  >
                    <Download size={12} />
                    Voir le certificat
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
