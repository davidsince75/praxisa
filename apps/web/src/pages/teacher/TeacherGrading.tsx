import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Clock, Award } from "lucide-react";
import { api } from "@/lib/api.js";
import type {
  CourseSubmissionsResponse,
  CourseSubmissionRow,
  SubmissionDetailResponse,
} from "@/lib/api.js";
import { Button } from "@/components/ui/button.js";
import { Badge } from "@/components/ui/badge.js";
import { Card, CardContent } from "@/components/ui/card.js";

const STATUS_LABELS: Record<string, string> = {
  submitted: "Soumis",
  grading: "En correction",
  graded: "Noté",
};

const STATUS_VARIANTS: Record<string, "pending" | "in_progress" | "completed"> =
  {
    submitted: "pending",
    grading: "in_progress",
    graded: "completed",
  };

function GradeForm({
  submissionId,
  maxScore,
  onDone,
}: {
  submissionId: string;
  maxScore: number | null;
  onDone: () => void;
}) {
  const [score, setScore] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();

  const gradeMutation = useMutation({
    mutationFn: () =>
      api.patch(`/submissions/${submissionId}/grade`, {
        score: parseInt(score, 10),
        feedback,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["course-submissions"] });
      onDone();
    },
    onError: (err: unknown) => {
      setError(
        err instanceof Error ? err.message : "Erreur lors de la notation",
      );
    },
  });

  return (
    <div className="space-y-3 mt-4 border-t border-slate-100 pt-4">
      <h4 className="text-sm font-semibold text-slate-700">
        Attribuer une note
      </h4>
      {error && (
        <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">
          {error}
        </p>
      )}
      <div className="flex gap-3 items-end">
        <div>
          <label className="block text-xs text-slate-500 mb-1">
            Score{maxScore !== null ? ` (max ${maxScore.toString()})` : ""}
          </label>
          <input
            type="number"
            min={0}
            max={maxScore ?? undefined}
            className="w-24 rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            value={score}
            onChange={(e) => {
              setScore(e.target.value);
            }}
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs text-slate-500 mb-1">
            Commentaire
          </label>
          <textarea
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500"
            rows={2}
            value={feedback}
            onChange={(e) => {
              setFeedback(e.target.value);
            }}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={gradeMutation.isPending || !score || !feedback.trim()}
          onClick={() => {
            gradeMutation.mutate();
          }}
        >
          <Award size={13} className="mr-1.5" />
          {gradeMutation.isPending ? "Envoi…" : "Valider la note"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          Annuler
        </Button>
      </div>
    </div>
  );
}

function SubmissionCard({ row }: { row: CourseSubmissionRow }) {
  const [expanded, setExpanded] = useState(false);
  const [grading, setGrading] = useState(false);

  const { data: detail } = useQuery<SubmissionDetailResponse>({
    queryKey: ["submission-detail", row.id],
    queryFn: () => api.get<SubmissionDetailResponse>(`/submissions/${row.id}`),
    enabled: expanded,
  });

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <button
          className="w-full text-left px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
          onClick={() => {
            setExpanded((v) => !v);
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <Badge variant={STATUS_VARIANTS[row.status] ?? "default"}>
              {STATUS_LABELS[row.status] ?? row.status}
            </Badge>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">
                {row.studentFirstName} {row.studentLastName}
              </p>
              <p className="text-xs text-slate-500 truncate">
                {row.exerciseTitle} · {row.studentEmail}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0 ml-4">
            {row.status === "graded" && row.score !== null && (
              <span className="text-xs font-semibold text-teal">
                {row.score.toString()}
                {row.maxScore !== null ? `/${row.maxScore.toString()}` : ""}
              </span>
            )}
            <span className="text-xs text-slate-400">
              {new Date(row.createdAt).toLocaleDateString("fr-FR")}
            </span>
          </div>
        </button>

        {expanded && (
          <div className="px-5 pb-5 border-t border-slate-100">
            {detail === undefined ? (
              <p className="text-sm text-slate-400 pt-4">Chargement…</p>
            ) : (
              <>
                <p className="text-sm text-slate-700 whitespace-pre-wrap pt-4">
                  {detail.submission.body}
                </p>
                {row.status === "graded" && (
                  <div className="mt-3 bg-teal-50 rounded-lg px-4 py-3">
                    <p className="text-xs font-bold text-teal uppercase tracking-wider mb-1">
                      Note attribuée
                    </p>
                    {detail.submission.score !== null && (
                      <p className="text-sm font-semibold">
                        {detail.submission.score.toString()}
                        {detail.maxScore !== null
                          ? `/${detail.maxScore.toString()}`
                          : ""}
                      </p>
                    )}
                    {detail.submission.feedback !== null && (
                      <p className="text-sm text-slate-700 mt-1">
                        {detail.submission.feedback}
                      </p>
                    )}
                  </div>
                )}
                {row.status !== "graded" && !grading && (
                  <Button
                    size="sm"
                    className="mt-4"
                    onClick={() => {
                      setGrading(true);
                    }}
                  >
                    <CheckCircle2 size={13} className="mr-1.5" />
                    Noter
                  </Button>
                )}
                {grading && (
                  <GradeForm
                    submissionId={row.id}
                    maxScore={row.maxScore}
                    onDone={() => {
                      setGrading(false);
                    }}
                  />
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function TeacherGradingPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [statusFilter, setStatusFilter] = useState<string>("");

  const { data, isLoading } = useQuery<CourseSubmissionsResponse>({
    queryKey: ["course-submissions", courseId, statusFilter],
    queryFn: () =>
      api.get<CourseSubmissionsResponse>(
        `/courses/${courseId ?? ""}/submissions${statusFilter ? `?status=${statusFilter}` : ""}`,
      ),
    enabled: courseId !== undefined,
  });

  const submissions = data?.submissions ?? [];
  const pending = submissions.filter((s) => s.status !== "graded").length;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to={`/teacher/courses/${courseId ?? ""}`}>
          <Button size="sm" variant="ghost">
            <ArrowLeft size={14} className="mr-1.5" />
            Retour au cours
          </Button>
        </Link>
        <h1 className="text-xl font-semibold text-slate-800">
          Travaux à corriger
        </h1>
        {pending > 0 && (
          <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
            {pending.toString()} en attente
          </span>
        )}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {["", "submitted", "grading", "graded"].map((s) => (
          <button
            key={s}
            onClick={() => {
              setStatusFilter(s);
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${
              statusFilter === s
                ? "bg-teal-500 text-white"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            {s === "" ? "Tous" : (STATUS_LABELS[s] ?? s)}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-slate-400">Chargement…</p>}

      {!isLoading && submissions.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <Clock size={40} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">Aucun travail soumis pour le moment.</p>
        </div>
      )}

      <div className="space-y-3">
        {submissions.map((row) => (
          <SubmissionCard key={row.id} row={row} />
        ))}
      </div>
    </div>
  );
}
