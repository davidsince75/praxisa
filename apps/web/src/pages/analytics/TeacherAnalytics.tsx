import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { api } from "@/lib/api.js";
import type { CourseListResponse, CourseAnalyticsResponse } from "@/lib/api.js";

const BUCKET_ORDER = ["0%", "1-25%", "26-50%", "51-75%", "76-99%", "100%"];
const BAR_COLORS = [
  "#f87171",
  "#fb923c",
  "#facc15",
  "#a3e635",
  "#34d399",
  "#6366f1",
];

export function TeacherAnalytics() {
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");

  const { data: coursesData } = useQuery<CourseListResponse>({
    queryKey: ["teacher-courses"],
    queryFn: () => api.get<CourseListResponse>("/courses/mine"),
  });

  const { data, isLoading, error } = useQuery<CourseAnalyticsResponse>({
    queryKey: ["analytics", "course", selectedCourseId],
    queryFn: () =>
      api.get<CourseAnalyticsResponse>(
        `/analytics/courses/${selectedCourseId}`,
      ),
    enabled: selectedCourseId !== "",
  });

  const courses = coursesData?.courses ?? [];

  const sortedDist = (data?.progressDistribution ?? [])
    .slice()
    .sort(
      (a, b) => BUCKET_ORDER.indexOf(a.bucket) - BUCKET_ORDER.indexOf(b.bucket),
    );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">
          Analytiques cours
        </h1>
        <select
          value={selectedCourseId}
          onChange={(e) => {
            setSelectedCourseId(e.target.value);
          }}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Choisir un cours...</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>

      {selectedCourseId === "" && (
        <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-gray-200 text-gray-400">
          Selectionnez un cours pour afficher les analytiques.
        </div>
      )}

      {selectedCourseId !== "" && isLoading && (
        <div className="flex h-64 items-center justify-center text-gray-400">
          Chargement...
        </div>
      )}

      {selectedCourseId !== "" && error != null && (
        <div className="flex h-64 items-center justify-center text-red-500">
          Erreur lors du chargement.
        </div>
      )}

      {data != null && (
        <>
          {/* Enrolment KPIs */}
          <div className="grid grid-cols-3 gap-4">
            {(
              [
                ["Inscrits", data.enrolments.enrolled],
                ["Actifs", data.enrolments.active],
                ["Completes", data.enrolments.completed],
              ] as [string, number][]
            ).map(([label, val]) => (
              <div
                key={label}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <p className="text-sm text-gray-500">{label}</p>
                <p className="mt-1 text-3xl font-semibold text-gray-900">
                  {val}
                </p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Lesson funnel */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-medium text-gray-700">
                Completions par lecon
              </h2>
              {data.lessonFunnel.length === 0 ? (
                <p className="text-sm text-gray-400">Aucune lecon.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={data.lessonFunnel}
                    layout="vertical"
                    margin={{ left: 8 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#f0f0f0"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="title"
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      width={120}
                    />
                    <Tooltip />
                    <Bar
                      dataKey="completed_count"
                      fill="#6366f1"
                      radius={[0, 4, 4, 0]}
                      name="Completes"
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Progress distribution */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-medium text-gray-700">
                Distribution de la progression
              </h2>
              {sortedDist.length === 0 ? (
                <p className="text-sm text-gray-400">Aucune inscription.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={sortedDist}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="bucket"
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
                    <Bar
                      dataKey="count"
                      radius={[4, 4, 0, 0]}
                      name="Apprenants"
                    >
                      {sortedDist.map((entry, index) => (
                        <Cell
                          key={entry.bucket}
                          fill={BAR_COLORS[index % BAR_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Quiz stats */}
          {data.quizStats.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-5 py-4">
                <h2 className="text-sm font-medium text-gray-700">
                  Statistiques quiz
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
                      <th className="px-5 py-3 font-medium">Quiz</th>
                      <th className="px-5 py-3 font-medium text-right">
                        Tentatives
                      </th>
                      <th className="px-5 py-3 font-medium text-right">
                        Score moyen
                      </th>
                      <th className="px-5 py-3 font-medium text-right">
                        Reussis
                      </th>
                      <th className="px-5 py-3 font-medium text-right">
                        Taux reussite
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.quizStats.map((q) => {
                      const passRate =
                        q.attempt_count > 0
                          ? Math.round((q.pass_count / q.attempt_count) * 100)
                          : 0;
                      return (
                        <tr
                          key={q.exercise_id}
                          className="border-b border-gray-50 last:border-0 hover:bg-gray-50"
                        >
                          <td className="px-5 py-3 font-medium text-gray-900">
                            {q.title}
                          </td>
                          <td className="px-5 py-3 text-right text-gray-700">
                            {q.attempt_count}
                          </td>
                          <td className="px-5 py-3 text-right text-gray-700">
                            {q.avg_score}/{q.max_score}
                          </td>
                          <td className="px-5 py-3 text-right text-gray-700">
                            {q.pass_count}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                passRate >= 70
                                  ? "bg-green-100 text-green-700"
                                  : passRate >= 50
                                    ? "bg-yellow-100 text-yellow-700"
                                    : "bg-red-100 text-red-700"
                              }`}
                            >
                              {passRate.toString()}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
