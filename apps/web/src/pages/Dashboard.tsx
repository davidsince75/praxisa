import { useQuery } from "@tanstack/react-query";
import { Users, BookOpen, GraduationCap, TrendingUp } from "lucide-react";
import { api } from "@/lib/api.js";
import type {
  AdminOverviewResponse,
  AuditEventsResponse,
  DsrListResponse,
} from "@/lib/api.js";
import { Card, CardContent } from "@/components/ui/card.js";
import { Badge } from "@/components/ui/badge.js";
import { formatDate } from "@/lib/utils.js";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  sub?: string;
  accent?: string;
}

function StatCard({
  label,
  value,
  icon,
  sub,
  accent = "text-teal",
}: StatCardProps) {
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
          <div className={`${accent} opacity-70`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function CourseRow({
  title,
  status,
  enrolled,
  completed,
}: {
  title: string;
  status: string;
  enrolled: number;
  completed: number;
}) {
  const pct = enrolled > 0 ? Math.round((completed / enrolled) * 100) : 0;
  return (
    <li className="flex items-center justify-between px-6 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <BookOpen size={14} className="text-teal flex-shrink-0" />
        <span className="text-sm font-medium text-dark truncate">{title}</span>
        <Badge
          variant={
            status === "published"
              ? "completed"
              : status === "archived"
                ? "rejected"
                : "pending"
          }
        >
          {status === "published"
            ? "Publi\u00e9"
            : status === "archived"
              ? "Archiv\u00e9"
              : "Brouillon"}
        </Badge>
      </div>
      <div className="flex items-center gap-4 flex-shrink-0">
        <span className="text-xs text-meta">
          {String(enrolled)} inscrit{enrolled !== 1 ? "s" : ""}
        </span>
        <div className="w-20 h-1.5 bg-rule rounded-full overflow-hidden">
          <div
            className="h-full bg-teal rounded-full"
            style={{ width: `${String(pct)}%` }}
          />
        </div>
        <span className="text-xs text-meta w-8 text-right">{String(pct)}%</span>
      </div>
    </li>
  );
}

export function DashboardPage() {
  const { data: analytics } = useQuery<AdminOverviewResponse>({
    queryKey: ["analytics", "overview"],
    queryFn: () => api.get<AdminOverviewResponse>("/analytics/overview"),
  });

  const { data: auditData } = useQuery({
    queryKey: ["audit", "recent"],
    queryFn: () => api.get<AuditEventsResponse>("/audit/events?limit=5"),
  });

  const { data: dsrData } = useQuery({
    queryKey: ["dsr", "all"],
    queryFn: () => api.get<DsrListResponse>("/gdpr/requests"),
  });

  const pending =
    dsrData?.requests.filter((r) => r.status === "pending").length ?? 0;

  const studentCount = analytics?.usersByRole.student ?? 0;
  const instructorCount = analytics?.usersByRole.instructor ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-dark">Dashboard</h1>
        <p className="text-meta text-sm mt-1">
          Vue d\u2019ensemble de la plateforme
        </p>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="\u00c9tudiants"
          value={studentCount}
          icon={<Users size={24} />}
          sub={`${String(instructorCount)} formateur${instructorCount !== 1 ? "s" : ""}`}
        />
        <StatCard
          label="Inscriptions actives"
          value={analytics?.totalEnrolled ?? "\u2014"}
          icon={<GraduationCap size={24} />}
          sub={`${String(analytics?.totalCompleted ?? 0)} termin\u00e9es`}
          accent="text-olive"
        />
        <StatCard
          label="Taux de compl\u00e9tion"
          value={
            analytics !== undefined
              ? `${String(analytics.completionRate)}%`
              : "\u2014"
          }
          icon={<TrendingUp size={24} />}
          accent="text-teal"
        />
        <StatCard
          label="Cours"
          value={analytics?.totalCourses ?? "\u2014"}
          icon={<BookOpen size={24} />}
          sub={pending > 0 ? `${String(pending)} DSR en attente` : undefined}
          accent="text-dark"
        />
      </div>

      {/* Courses overview */}
      {analytics !== undefined && analytics.courseStats.length > 0 && (
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-meta mb-4">
            Cours &mdash; inscriptions &amp; progression
          </h2>
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y divide-rule">
                {analytics.courseStats.map((c) => (
                  <CourseRow
                    key={c.id}
                    title={c.title}
                    status={c.status}
                    enrolled={c.enrolled}
                    completed={c.completed}
                  />
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent audit events */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-meta mb-4">
          Activit\u00e9 r\u00e9cente
        </h2>
        <Card>
          <CardContent className="p-0">
            {auditData?.events.length === 0 && (
              <p className="text-meta text-sm p-6">
                Aucun \u00e9v\u00e9nement.
              </p>
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
                      {event.entityType} &middot; {event.entityId.slice(0, 8)}
                      &hellip;
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

      {/* Pending DSR */}
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
                          {req.userId.slice(0, 8)}&hellip;
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
