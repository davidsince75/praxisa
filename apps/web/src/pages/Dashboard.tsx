import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, ScrollText, Users, Clock } from "lucide-react";
import { api } from "@/lib/api.js";
import type {
  DsrListResponse,
  AuditEventsResponse,
  UserListResponse,
  CourseListResponse,
} from "@/lib/api.js";
import { Card, CardContent } from "@/components/ui/card.js";
import { Badge } from "@/components/ui/badge.js";
import { formatDate } from "@/lib/utils.js";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  sub?: string;
}

function StatCard({ label, value, icon, sub }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-meta mb-1">
              {label}
            </p>
            <p className="text-3xl font-bold text-dark">{value}</p>
            {sub !== undefined && (
              <p className="text-xs text-meta mt-1">{sub}</p>
            )}
          </div>
          <div className="text-teal/60">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const { data: dsrData } = useQuery({
    queryKey: ["dsr", "all"],
    queryFn: () => api.get<DsrListResponse>("/gdpr/requests"),
  });

  const { data: auditData } = useQuery({
    queryKey: ["audit", "recent"],
    queryFn: () => api.get<AuditEventsResponse>("/audit/events?limit=5"),
  });

  const { data: usersData } = useQuery({
    queryKey: ["users", "", "all", 1],
    queryFn: () => api.get<UserListResponse>("/users?limit=1"),
  });

  const { data: coursesData } = useQuery({
    queryKey: ["courses"],
    queryFn: () => api.get<CourseListResponse>("/courses"),
  });

  const pending =
    dsrData?.requests.filter((r) => r.status === "pending").length ?? 0;
  const inProgress =
    dsrData?.requests.filter((r) => r.status === "in_progress").length ?? 0;
  const total = dsrData?.requests.length ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-dark">Dashboard</h1>
        <p className="text-meta text-sm mt-1">
          Vue d'ensemble de la plateforme
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="DSR en attente"
          value={pending}
          icon={<Clock size={24} />}
          sub={inProgress > 0 ? `${String(inProgress)} en cours` : undefined}
        />
        <StatCard
          label="DSR total"
          value={total}
          icon={<ShieldCheck size={24} />}
        />
        <StatCard
          label="Événements audit"
          value={auditData?.pagination.count ?? "—"}
          icon={<ScrollText size={24} />}
        />
        <StatCard
          label="Utilisateurs"
          value={usersData?.meta.total ?? "—"}
          icon={<Users size={24} />}
          sub={
            coursesData !== undefined
              ? `${String(coursesData.courses.length)} cours`
              : undefined
          }
        />
      </div>

      {/* Recent audit events */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-meta mb-4">
          Activité récente
        </h2>
        <Card>
          <CardContent className="p-0">
            {auditData?.events.length === 0 && (
              <p className="text-meta text-sm p-6">Aucun événement.</p>
            )}
            <ul className="divide-y divide-rule">
              {auditData?.events.map((event) => (
                <li
                  key={event.id}
                  className="flex items-center justify-between px-6 py-3"
                >
                  <div>
                    <span className="text-sm font-medium text-dark">
                      {event.eventType}
                    </span>
                    <span className="text-xs text-meta ml-3">
                      {event.entityType} · {event.entityId.slice(0, 8)}…
                    </span>
                  </div>
                  <span className="text-xs text-meta">
                    {formatDate(event.eventAt)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Pending DSR preview */}
      {pending > 0 && (
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-meta mb-4">
            DSR en attente
          </h2>
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y divide-rule">
                {dsrData?.requests
                  .filter((r) => r.status === "pending")
                  .slice(0, 5)
                  .map((req) => (
                    <li
                      key={req.id}
                      className="flex items-center justify-between px-6 py-3"
                    >
                      <div>
                        <span className="text-sm font-medium text-dark capitalize">
                          {req.type}
                        </span>
                        <span className="text-xs text-meta ml-3">
                          {req.userId.slice(0, 8)}…
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="pending">En attente</Badge>
                        <span className="text-xs text-meta">
                          {formatDate(req.createdAt)}
                        </span>
                      </div>
                    </li>
                  ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
