import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { api } from "@/lib/api.js";
import type { DsrListResponse, DsrRequest } from "@/lib/api.js";
import { Card, CardContent } from "@/components/ui/card.js";
import { Badge } from "@/components/ui/badge.js";
import { formatDate } from "@/lib/utils.js";

type StatusFilter = "all" | DsrRequest["status"];
type TypeFilter = "all" | DsrRequest["type"];

const STATUS_LABELS: Record<DsrRequest["status"], string> = {
  pending: "En attente",
  in_progress: "En cours",
  completed: "Terminé",
  rejected: "Refusé",
};

const TYPE_LABELS: Record<DsrRequest["type"], string> = {
  erasure: "Effacement",
  access: "Accès",
  portability: "Portabilité",
  rectification: "Rectification",
};

export function DsrQueuePage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["dsr", "all"],
    queryFn: () => api.get<DsrListResponse>("/gdpr/requests"),
  });

  const filtered = (data?.requests ?? []).filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (typeFilter !== "all" && r.type !== typeFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-dark">File DSR</h1>
        <p className="text-meta text-sm mt-1">
          Demandes de droits des personnes (RGPD Art. 15–22)
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex gap-1">
          {(
            ["all", "pending", "in_progress", "completed", "rejected"] as const
          ).map((s) => (
            <button
              key={s}
              onClick={() => {
                setStatusFilter(s);
              }}
              className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                statusFilter === s
                  ? "bg-dark text-white"
                  : "bg-white border border-rule text-meta hover:text-dark"
              }`}
            >
              {s === "all" ? "Tous" : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {(
            [
              "all",
              "erasure",
              "access",
              "portability",
              "rectification",
            ] as const
          ).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTypeFilter(t);
              }}
              className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                typeFilter === t
                  ? "bg-teal text-white"
                  : "bg-white border border-rule text-meta hover:text-dark"
              }`}
            >
              {t === "all" ? "Tous types" : TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading && <p className="text-meta text-sm p-6">Chargement…</p>}
          {!isLoading && filtered.length === 0 && (
            <p className="text-meta text-sm p-6">Aucune demande.</p>
          )}
          <ul className="divide-y divide-rule">
            {filtered.map((req) => (
              <li key={req.id}>
                <Link
                  to={`/gdpr/${req.userId}`}
                  className="flex items-center justify-between px-6 py-4 hover:bg-cream transition-colors group"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-dark capitalize">
                        {TYPE_LABELS[req.type]}
                      </span>
                      <Badge variant={req.status}>
                        {STATUS_LABELS[req.status]}
                      </Badge>
                    </div>
                    <p className="text-xs text-meta font-mono">{req.userId}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-meta">
                      {formatDate(req.createdAt)}
                    </span>
                    <ChevronRight
                      size={14}
                      className="text-meta group-hover:text-teal transition-colors"
                    />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <p className="text-xs text-meta">
        {filtered.length} résultat{filtered.length !== 1 ? "s" : ""}
        {data !== undefined
          ? ` sur ${String(data.requests.length)} chargés`
          : ""}
      </p>
    </div>
  );
}
