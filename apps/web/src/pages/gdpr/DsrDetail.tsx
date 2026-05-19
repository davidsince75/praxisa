import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download } from "lucide-react";
import { api } from "@/lib/api.js";
import type { SarExport, DsrListResponse } from "@/lib/api.js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.js";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { formatDate } from "@/lib/utils.js";

const STATUS_LABELS = {
  pending: "En attente",
  in_progress: "En cours",
  completed: "Terminé",
  rejected: "Refusé",
};

const TYPE_LABELS = {
  erasure: "Effacement",
  access: "Accès",
  portability: "Portabilité",
  rectification: "Rectification",
};

export function DsrDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const qc = useQueryClient();

  const { data: sarData, isLoading: sarLoading } = useQuery({
    queryKey: ["sar", userId],
    queryFn: () => api.get<SarExport>(`/gdpr/users/${userId ?? ""}/export`),
    enabled: userId !== undefined,
  });

  const { data: dsrData } = useQuery({
    queryKey: ["dsr", "all"],
    queryFn: () => api.get<DsrListResponse>("/gdpr/requests"),
  });

  const userRequests =
    dsrData?.requests.filter((r) => r.userId === userId) ?? [];
  const pendingRequests = userRequests.filter(
    (r) => r.status === "pending" || r.status === "in_progress",
  );

  const completeMutation = useMutation({
    mutationFn: (targetUserId: string) =>
      api.patch(`/gdpr/requests/${targetUserId}/complete`, { notes: "Completed via admin dashboard" }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["dsr"] });
    },
  });

  function downloadSar() {
    if (sarData === undefined) return;
    const blob = new Blob([JSON.stringify(sarData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sar-${userId ?? "user"}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (sarLoading) {
    return (
      <div className="space-y-4">
        <Link to="/gdpr" className="flex items-center gap-2 text-xs text-meta hover:text-dark">
          <ArrowLeft size={14} /> Retour
        </Link>
        <p className="text-meta text-sm">Chargement…</p>
      </div>
    );
  }

  if (sarData === undefined) {
    return (
      <div className="space-y-4">
        <Link to="/gdpr" className="flex items-center gap-2 text-xs text-meta hover:text-dark">
          <ArrowLeft size={14} /> Retour
        </Link>
        <p className="text-meta text-sm">Utilisateur introuvable.</p>
      </div>
    );
  }

  const { user } = sarData;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Link
            to="/gdpr"
            className="flex items-center gap-2 text-xs text-meta hover:text-dark mb-3"
          >
            <ArrowLeft size={14} /> File DSR
          </Link>
          <h1 className="text-2xl font-bold text-dark">
            {user.firstName} {user.lastName}
          </h1>
          <p className="text-meta text-sm font-mono">{user.email}</p>
        </div>
        <Button variant="outline" onClick={downloadSar} className="gap-2">
          <Download size={14} />
          Export SAR (JSON)
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User info */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Profil</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="ID" value={user.id.slice(0, 16) + "…"} mono />
              <Row label="Rôle" value={user.role} />
              <Row
                label="Statut"
                value={
                  <Badge variant={user.isActive ? "completed" : "rejected"}>
                    {user.isActive ? "Actif" : "Inactif"}
                  </Badge>
                }
              />
              <Row label="Inscrit le" value={formatDate(user.createdAt)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Données retenues</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Inscriptions" value={sarData.enrolments.length} />
              <Row label="Progression" value={sarData.lessonProgress.length} />
              <Row label="Consentements" value={sarData.policyConsents.length} />
              <Row label="Événements audit" value={sarData.auditEvents.length} />
            </CardContent>
          </Card>
        </div>

        {/* DSR requests */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Demandes DSR</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {userRequests.length === 0 && (
                <p className="text-meta text-sm p-6">Aucune demande pour cet utilisateur.</p>
              )}
              <ul className="divide-y divide-rule">
                {userRequests.map((req) => (
                  <li key={req.id} className="px-6 py-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold capitalize">
                          {TYPE_LABELS[req.type]}
                        </span>
                        <Badge variant={req.status}>{STATUS_LABELS[req.status]}</Badge>
                      </div>
                      {(req.status === "pending" || req.status === "in_progress") && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={completeMutation.isPending}
                          onClick={() => completeMutation.mutate(req.userId)}
                        >
                          Marquer terminé
                        </Button>
                      )}
                    </div>
                    <div className="flex gap-6 text-xs text-meta">
                      <span>Créé {formatDate(req.createdAt)}</span>
                      {req.completedAt !== null && (
                        <span>Terminé {formatDate(req.completedAt)}</span>
                      )}
                    </div>
                    {req.notes !== null && (
                      <p className="text-xs text-meta bg-cream px-3 py-2">{req.notes}</p>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Recent audit events */}
          <Card>
            <CardHeader>
              <CardTitle>Derniers événements audit</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {sarData.auditEvents.length === 0 && (
                <p className="text-meta text-sm p-6">Aucun événement.</p>
              )}
              <ul className="divide-y divide-rule">
                {sarData.auditEvents.slice(0, 10).map((ev) => (
                  <li key={ev.id} className="flex items-center justify-between px-6 py-3">
                    <span className="text-sm text-dark">{ev.eventType}</span>
                    <span className="text-xs text-meta">{formatDate(ev.eventAt)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      {pendingRequests.length > 0 && (
        <div className="bg-sand/20 border border-sand/40 px-5 py-4">
          <p className="text-sm font-bold text-dark">
            {pendingRequests.length} demande{pendingRequests.length > 1 ? "s" : ""} en attente de traitement
          </p>
          <p className="text-xs text-mid mt-1">
            SLA RGPD : 30 jours à compter de la réception. Traitez les demandes d'effacement via
            le worker automatique ou manuellement si celui-ci est en échec.
          </p>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-meta text-xs uppercase tracking-wider font-bold">{label}</span>
      <span className={`text-dark ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}
