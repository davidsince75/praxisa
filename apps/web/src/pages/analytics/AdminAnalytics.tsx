import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { api } from "@/lib/api.js";
import type { AdminOverviewResponse } from "@/lib/api.js";

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-gray-900">{value}</p>
      {sub !== undefined && (
        <p className="mt-0.5 text-xs text-gray-400">{sub}</p>
      )}
    </div>
  );
}

export function AdminAnalytics() {
  const { data, isLoading, error } = useQuery<AdminOverviewResponse>({
    queryKey: ["analytics", "overview"],
    queryFn: () => api.get<AdminOverviewResponse>("/analytics/overview"),
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        Chargement...
      </div>
    );
  }

  if (error != null || data == null) {
    return (
      <div className="flex h-64 items-center justify-center text-red-500">
        Impossible de charger les analytiques.
      </div>
    );
  }

  const roleLabels: Record<string, string> = {
    admin: "Admins",
    instructor: "Formateurs",
    student: "Apprenants",
    migration_lead: "Migration",
  };

  const roleData = Object.entries(data.usersByRole).map(([role, count]) => ({
    name: roleLabels[role] ?? role,
    count,
  }));

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-gray-900">
        Tableau de bord analytiques
      </h1>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Utilisateurs" value={data.totalUsers} />
        <StatCard label="Cours" value={data.totalCourses} />
        <StatCard label="Inscriptions" value={data.totalEnrolled} />
        <StatCard label="Completions" value={data.totalCompleted} />
        <StatCard
          label="Taux de completion"
          value={`${data.completionRate.toString()}%`}
        />
      </div>

      {/* Row: trend + role breakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-medium text-gray-700">
            Inscriptions - 6 derniers mois
          </h2>
          {data.enrolmentTrend.length === 0 ? (
            <p className="text-sm text-gray-400">Aucune donnee.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data.enrolmentTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="Inscriptions"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-medium text-gray-700">
            Utilisateurs par role
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={roleData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip />
              <Bar
                dataKey="count"
                fill="#6366f1"
                radius={[4, 4, 0, 0]}
                name="Utilisateurs"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Course stats table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-medium text-gray-700">
            Statistiques par cours
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
                <th className="px-5 py-3 font-medium">Cours</th>
                <th className="px-5 py-3 font-medium">Statut</th>
                <th className="px-5 py-3 font-medium text-right">Inscrits</th>
                <th className="px-5 py-3 font-medium text-right">Actifs</th>
                <th className="px-5 py-3 font-medium text-right">Completes</th>
                <th className="px-5 py-3 font-medium text-right">Completion</th>
              </tr>
            </thead>
            <tbody>
              {data.courseStats.map((c) => {
                const pct =
                  c.enrolled > 0
                    ? Math.round((c.completed / c.enrolled) * 100)
                    : 0;
                return (
                  <tr
                    key={c.id}
                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50"
                  >
                    <td className="px-5 py-3 font-medium text-gray-900">
                      {c.title}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          c.status === "published"
                            ? "bg-green-100 text-green-700"
                            : c.status === "draft"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-gray-700">
                      {c.enrolled}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-700">
                      {c.active}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-700">
                      {c.completed}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-indigo-500"
                            style={{ width: `${pct.toString()}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">
                          {pct.toString()}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {data.courseStats.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-8 text-center text-sm text-gray-400"
                  >
                    Aucun cours.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
