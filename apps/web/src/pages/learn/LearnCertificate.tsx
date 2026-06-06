import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Printer, ArrowLeft, Award } from "lucide-react";
import { api } from "@/lib/api.js";
import type { CertificateResponse } from "@/lib/api.js";
import { Button } from "@/components/ui/button.js";

export function LearnCertificatePage() {
  const { enrolmentId } = useParams<{ enrolmentId: string }>();
  const id = enrolmentId ?? "";

  const { data, isLoading, error } = useQuery<CertificateResponse>({
    queryKey: ["certificate", id],
    queryFn: () =>
      api.get<CertificateResponse>(`/enrolments/${id}/certificate`),
    enabled: id.length > 0,
  });

  const cert = data?.certificate;

  const completedDate = cert?.completedAt
    ? new Date(cert.completedAt).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="space-y-6">
      {/* Toolbar — hidden when printing */}
      <div className="flex items-center justify-between print:hidden">
        <Link to="/learn/courses">
          <button className="flex items-center gap-1.5 text-sm text-meta hover:text-dark transition-colors">
            <ArrowLeft size={15} />
            Mes formations
          </button>
        </Link>
        <Button
          size="sm"
          onClick={() => {
            window.print();
          }}
          disabled={cert === undefined}
        >
          <Printer size={14} className="mr-1.5" />
          Imprimer
        </Button>
      </div>

      {isLoading && (
        <div className="flex h-64 items-center justify-center text-meta">
          Chargement du certificat…
        </div>
      )}

      {error != null && (
        <div className="flex h-64 items-center justify-center text-rose text-sm">
          {(error as { message?: string }).message ===
          "Course not yet completed"
            ? "Cette formation n'est pas encore terminée."
            : "Impossible de charger le certificat."}
        </div>
      )}

      {cert !== undefined && (
        /* Certificate document */
        <div
          id="certificate"
          className="mx-auto max-w-3xl bg-white border-[3px] border-dark rounded-xl p-12 shadow-lg print:shadow-none print:border-2 print:rounded-none"
        >
          {/* Top decoration */}
          <div className="flex justify-center mb-8">
            <div className="flex items-center gap-3">
              <Award size={40} className="text-teal" />
              <span className="text-3xl font-bold tracking-tight text-dark">
                Praxi<span className="text-teal">sa</span>
              </span>
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-10">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-meta mb-2">
              Certificat de completion
            </p>
            <div className="h-px w-24 bg-teal mx-auto" />
          </div>

          {/* Body */}
          <div className="text-center space-y-6">
            <p className="text-sm text-meta">Ce certificat est decerne a</p>
            <h1 className="text-4xl font-bold text-dark tracking-tight">
              {cert.studentName}
            </h1>
            <p className="text-sm text-meta">
              pour avoir suivi et complete avec succes la formation
            </p>
            <h2 className="text-2xl font-semibold text-teal px-8">
              {cert.courseTitle}
            </h2>
            {completedDate !== null && (
              <p className="text-sm text-meta">
                Completee le{" "}
                <span className="font-semibold text-dark">{completedDate}</span>
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="mt-14 flex items-end justify-between border-t border-rule pt-6">
            <div>
              <div className="h-px w-40 bg-dark/20 mb-1" />
              <p className="text-xs text-meta">Psychostudy Learning Platform</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-meta/60 font-mono">
                {cert.enrolmentId}
              </p>
              <p className="text-xs text-meta/40">
                Emis le{" "}
                {new Date(cert.issuedAt).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
