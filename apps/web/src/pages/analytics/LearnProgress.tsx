import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api.js";
import type { MyAnalyticsResponse } from "@/lib/api.js";
import { CheckCircle, BookOpen, Trophy } from "lucide-react";

function KpiCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-semibold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

export function LearnProgress() {
  const { data, isLoading, error } = useQuery<MyAnalyticsResponse>({
    queryKey: ["analytics", "me"],
    queryFn: () => api.get<MyAnalyticsResponse>("/analytics/me"),
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
        Impossible de charger votre progression.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-gray-900">Ma progression</h1>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          icon={<BookOpen size={22} />}
          label="Formations suivies"
          value={data.totalEnrolled}
        />
        <KpiCard
          icon={<Trophy size={22} />}
          label="Formations terminees"
          value={data.totalCompleted}
        />
        <KpiCard
          icon={<CheckCircle size={22} />}
          label="Lecons completees"
          value={data.totalLessonsCompleted}
        />
      </div>

      {/* Course progress list */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-medium text-gray-700">
            Progression par formation
          </h2>
        </div>
        {data.courseProgress.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-400">
            Vous n&apos;etes inscrit a aucune formation.
          </p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {data.courseProgress.map((c) => (
              <li key={c.enrolmentId} className="px-5 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-gray-900">
                      {c.courseTitle}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {c.completedLessons}/{c.totalLessons} lecons
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="h-2 w-32 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={`h-full rounded-full transition-all ${
                          c.completionPct === 100
                            ? "bg-green-500"
                            : "bg-indigo-500"
                        }`}
                        style={{
                          width: `${c.completionPct.toString()}%`,
                        }}
                      />
                    </div>
                    <span className="w-10 text-right text-sm font-medium text-gray-700">
                      {c.completionPct.toString()}%
                    </span>
                    {c.status === "completed" && (
                      <CheckCircle size={16} className="text-green-500" />
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Quiz history */}
      {data.quizHistory.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-medium text-gray-700">
              Historique des quiz
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
                  <th className="px-5 py-3 font-medium">Quiz</th>
                  <th className="px-5 py-3 font-medium">Formation</th>
                  <th className="px-5 py-3 font-medium text-right">Score</th>
                  <th className="px-5 py-3 font-medium text-right">Resultat</th>
                  <th className="px-5 py-3 font-medium text-right">Date</th>
                </tr>
              </thead>
              <tbody>
                {data.quizHistory.map((q, i) => (
                  <tr
                    key={i}
                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50"
                  >
                    <td className="px-5 py-3 font-medium text-gray-900">
                      {q.exerciseTitle}
                    </td>
                    <td className="px-5 py-3 text-gray-600">{q.courseTitle}</td>
                    <td className="px-5 py-3 text-right text-gray-700">
                      {q.score}/{q.maxScore}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          q.passed
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {q.passed ? "Reussi" : "Echoue"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-gray-400">
                      {new Date(q.completedAt).toLocaleDateString("fr-FR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
