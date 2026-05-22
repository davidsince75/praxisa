import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  Mail,
  FileText,
  Award,
} from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api.js";
import type {
  StudentDetailResponse,
  StudentDetailEnrolment,
  StudentDetailModule,
  StudentSubmissionsResponse,
  StudentSubmission,
} from "@/lib/api.js";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { Card, CardContent } from "@/components/ui/card.js";

function enrolStatusVariant(status: string) {
  if (status === "completed") return "completed" as const;
  if (status === "cancelled") return "rejected" as const;
  return "in_progress" as const;
}

const ENROL_LABELS: Record<string, string> = {
  active: "Actif",
  completed: "Terminé",
  cancelled: "Annulé",
};

const LESSON_STATUS_LABELS: Record<string, string> = {
  not_started: "Non commencé",
  in_progress: "En cours",
  completed: "Terminé",
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${String(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${String(mins)} min`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${String(hours)}h ${String(remainMins).padStart(2, "0")}min`;
}

function formatDate(dateStr: string | null): string {
  if (dateStr === null) return "—";
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function ProgressBar({ pct }: { pct: number }) {
  const safe = Math.min(100, Math.max(0, Math.round(pct)));
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-rule rounded-full overflow-hidden">
        <div
          className="h-full bg-teal rounded-full transition-all"
          style={{ width: `${String(safe)}%` }}
        />
      </div>
      <span className="text-sm font-semibold text-dark w-10 text-right">
        {String(safe)}%
      </span>
    </div>
  );
}

function ModuleAccordion({ mod }: { mod: StudentDetailModule }) {
  const [open, setOpen] = useState(false);
  const completed = mod.lessons.filter((l) => l.status === "completed").length;
  const total = mod.lessons.length;
  const allDone = completed === total && total > 0;

  return (
    <div className="border border-rule rounded-lg overflow-hidden">
      <button
        onClick={() => {
          setOpen((prev) => !prev);
        }}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-cream/50 transition-colors text-left"
      >
        {open ? (
          <ChevronDown size={14} className="text-meta" />
        ) : (
          <ChevronRight size={14} className="text-meta" />
        )}
        <span className="flex-1 text-sm font-semibold text-dark">
          {mod.title}
        </span>
        <span className="text-xs text-meta">
          {String(completed)}/{String(total)} leçons
        </span>
        {allDone ? (
          <CheckCircle2 size={14} className="text-teal" />
        ) : completed > 0 ? (
          <Clock size={14} className="text-amber-500" />
        ) : null}
      </button>
      {open && (
        <div className="border-t border-rule divide-y divide-rule">
          {mod.lessons.map((lesson) => (
            <div
              key={lesson.id}
              className={`px-4 py-2.5 flex items-center gap-3 text-sm ${
                lesson.status === "completed" ? "bg-teal/5" : ""
              }`}
            >
              {lesson.status === "completed" ? (
                <CheckCircle2 size={13} className="text-teal" />
              ) : lesson.status === "in_progress" ? (
                <Clock size={13} className="text-amber-500" />
              ) : (
                <XCircle size={13} className="text-meta/30" />
              )}
              <span className="flex-1 text-dark">{lesson.title}</span>
              <span className="text-xs text-meta">
                {LESSON_STATUS_LABELS[lesson.status] ?? lesson.status}
              </span>
              {lesson.timeSpentSeconds > 0 && (
                <span className="text-xs text-meta">
                  {formatDuration(lesson.timeSpentSeconds)}
                </span>
              )}
              {lesson.completedAt !== null && (
                <span className="text-xs text-meta">
                  {formatDate(lesson.completedAt)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EnrolmentCard({ enrolment }: { enrolment: StudentDetailEnrolment }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <BookOpen size={16} className="text-teal" />
              <h3 className="font-semibold text-dark">
                {enrolment.courseTitle}
              </h3>
            </div>
            <div className="flex items-center gap-3 text-xs text-meta">
              <span>Inscrit le {formatDate(enrolment.enrolledAt)}</span>
              {enrolment.completedAt !== null && (
                <span>Terminé le {formatDate(enrolment.completedAt)}</span>
              )}
              <span>
                Temps total : {formatDuration(enrolment.totalTimeSeconds)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={enrolStatusVariant(enrolment.status)}>
              {ENROL_LABELS[enrolment.status] ?? enrolment.status}
            </Badge>
            <button
              onClick={() => {
                setExpanded((prev) => !prev);
              }}
              className="text-meta hover:text-dark transition-colors"
            >
              {expanded ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
            </button>
          </div>
        </div>

        <ProgressBar pct={enrolment.completionPct} />

        {expanded && (
          <>
            {/* Module/Lesson breakdown */}
            {enrolment.modules.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-meta">
                  Modules & Leçons
                </h4>
                {enrolment.modules.map((mod) => (
                  <ModuleAccordion key={mod.id} mod={mod} />
                ))}
              </div>
            )}

            {/* Quiz attempts */}
            {enrolment.quizAttempts.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-meta">
                  Quiz
                </h4>
                <div className="border border-rule rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-cream/50 border-b border-rule">
                        <th className="text-left px-4 py-2 text-xs font-bold uppercase text-meta">
                          Exercice
                        </th>
                        <th className="text-left px-4 py-2 text-xs font-bold uppercase text-meta">
                          Score
                        </th>
                        <th className="text-left px-4 py-2 text-xs font-bold uppercase text-meta">
                          Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rule">
                      {enrolment.quizAttempts.map((q) => {
                        const pct =
                          q.maxScore > 0
                            ? Math.round((q.score / q.maxScore) * 100)
                            : 0;
                        return (
                          <tr key={q.attemptId}>
                            <td className="px-4 py-2 text-dark">
                              {q.exerciseTitle}
                            </td>
                            <td className="px-4 py-2">
                              <span
                                className={`font-semibold ${
                                  pct >= 70
                                    ? "text-teal"
                                    : pct >= 50
                                      ? "text-amber-500"
                                      : "text-rose"
                                }`}
                              >
                                {String(q.score)}/{String(q.maxScore)}
                              </span>
                              <span className="text-meta text-xs ml-1">
                                ({String(pct)}%)
                              </span>
                            </td>
                            <td className="px-4 py-2 text-meta">
                              {formatDate(q.completedAt)}
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
      </CardContent>
    </Card>
  );
}

const SUBMISSION_STATUS_LABELS: Record<string, string> = {
  submitted: "Soumis",
  grading: "En correction",
  graded: "Noté",
};

const SUBMISSION_STATUS_VARIANTS: Record<
  string,
  "pending" | "in_progress" | "completed"
> = {
  submitted: "pending",
  grading: "in_progress",
  graded: "completed",
};

function InlineGradeForm({
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
  const [formError, setFormError] = useState<string | null>(null);
  const qc = useQueryClient();

  const gradeMutation = useMutation({
    mutationFn: () =>
      api.patch(`/submissions/${submissionId}/grade`, {
        score: parseInt(score, 10),
        feedback,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["student-submissions"] });
      onDone();
    },
    onError: (err: unknown) => {
      setFormError(
        err instanceof Error ? err.message : "Erreur lors de la notation",
      );
    },
  });

  return (
    <div className="space-y-3 mt-3 border-t border-rule pt-3">
      <h4 className="text-xs font-bold uppercase tracking-wider text-meta">
        Attribuer une note
      </h4>
      {formError !== null && (
        <p className="text-xs text-rose bg-rose/10 px-3 py-2 rounded-lg">
          {formError}
        </p>
      )}
      <div className="flex gap-3 items-end">
        <div>
          <label className="block text-xs text-meta mb-1">
            Score{maxScore !== null ? ` (max ${String(maxScore)})` : ""}
          </label>
          <input
            type="number"
            min={0}
            max={maxScore ?? undefined}
            className="w-24 rounded-md border border-rule px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
            value={score}
            onChange={(e) => {
              setScore(e.target.value);
            }}
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs text-meta mb-1">Commentaire</label>
          <textarea
            className="w-full rounded-md border border-rule px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal"
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

function SubmissionRow({ sub }: { sub: StudentSubmission }) {
  const [expanded, setExpanded] = useState(false);
  const [grading, setGrading] = useState(false);

  const pct =
    sub.status === "graded" &&
    sub.score !== null &&
    sub.maxScore !== null &&
    sub.maxScore > 0
      ? Math.round((sub.score / sub.maxScore) * 100)
      : null;

  return (
    <div className="border border-rule rounded-lg overflow-hidden">
      <button
        onClick={() => {
          setExpanded((prev) => !prev);
        }}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-cream/50 transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown size={14} className="text-meta" />
        ) : (
          <ChevronRight size={14} className="text-meta" />
        )}
        <Badge variant={SUBMISSION_STATUS_VARIANTS[sub.status] ?? "default"}>
          {SUBMISSION_STATUS_LABELS[sub.status] ?? sub.status}
        </Badge>
        <span className="flex-1 text-sm font-semibold text-dark truncate">
          {sub.exerciseTitle}
        </span>
        <span className="text-xs text-meta">{sub.courseTitle}</span>
        {sub.status === "graded" && sub.score !== null && (
          <span
            className={`text-xs font-semibold ${
              pct !== null && pct >= 70
                ? "text-teal"
                : pct !== null && pct >= 50
                  ? "text-amber-500"
                  : "text-rose"
            }`}
          >
            {String(sub.score)}
            {sub.maxScore !== null ? `/${String(sub.maxScore)}` : ""}
          </span>
        )}
        <span className="text-xs text-meta">{formatDate(sub.createdAt)}</span>
      </button>
      {expanded && (
        <div className="border-t border-rule px-4 py-3 space-y-3">
          <p className="text-sm text-dark whitespace-pre-wrap">{sub.body}</p>
          {sub.status === "graded" && sub.feedback !== null && (
            <div className="bg-teal/5 rounded-lg px-4 py-3">
              <p className="text-xs font-bold text-teal uppercase tracking-wider mb-1">
                Note attribu&eacute;e
              </p>
              {sub.score !== null && (
                <p className="text-sm font-semibold">
                  {String(sub.score)}
                  {sub.maxScore !== null ? `/${String(sub.maxScore)}` : ""}
                </p>
              )}
              <p className="text-sm text-dark mt-1">{sub.feedback}</p>
            </div>
          )}
          {sub.status !== "graded" && !grading && (
            <Button
              size="sm"
              onClick={() => {
                setGrading(true);
              }}
            >
              <CheckCircle2 size={13} className="mr-1.5" />
              Noter
            </Button>
          )}
          {grading && (
            <InlineGradeForm
              submissionId={sub.id}
              maxScore={sub.maxScore}
              onDone={() => {
                setGrading(false);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function StudentSubmissionsSection({ studentId }: { studentId: string }) {
  const { data, isLoading } = useQuery<StudentSubmissionsResponse>({
    queryKey: ["student-submissions", studentId],
    queryFn: () =>
      api.get<StudentSubmissionsResponse>(`/students/${studentId}/submissions`),
  });

  const subs = data?.submissions ?? [];

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-dark flex items-center gap-2">
        <FileText size={18} className="text-teal" />
        Travaux soumis
        {subs.length > 0 && (
          <span className="text-xs font-normal text-meta">
            ({String(subs.length)})
          </span>
        )}
      </h2>
      {isLoading && <p className="text-meta text-sm">Chargement&hellip;</p>}
      {!isLoading && subs.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <FileText size={28} className="text-meta/40 mx-auto mb-2" />
            <p className="text-meta text-sm">
              Aucun travail soumis par cet &eacute;l&egrave;ve.
            </p>
          </CardContent>
        </Card>
      )}
      {subs.map((sub) => (
        <SubmissionRow key={sub.id} sub={sub} />
      ))}
    </div>
  );
}

export function TeacherStudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ["student-detail", studentId],
    queryFn: () =>
      api.get<StudentDetailResponse>(`/students/${studentId ?? ""}/detail`),
    enabled: studentId !== undefined,
  });

  if (isLoading) {
    return <p className="text-meta text-sm">Chargement&hellip;</p>;
  }

  if (error !== null || data === undefined) {
    return (
      <div className="space-y-4">
        <Link
          to="/teacher/students"
          className="inline-flex items-center gap-1 text-sm text-teal hover:underline"
        >
          <ArrowLeft size={14} />
          Retour
        </Link>
        <p className="text-rose text-sm">
          Impossible de charger le profil &eacute;l&egrave;ve.
        </p>
      </div>
    );
  }

  const { student, enrolments } = data;

  // Summary stats
  const totalCourses = enrolments.length;
  const completedCourses = enrolments.filter(
    (e) => e.status === "completed",
  ).length;
  const avgCompletion =
    totalCourses > 0
      ? Math.round(
          enrolments.reduce((sum, e) => sum + e.completionPct, 0) /
            totalCourses,
        )
      : 0;
  const totalTime = enrolments.reduce((sum, e) => sum + e.totalTimeSeconds, 0);
  const totalQuizzes = enrolments.reduce(
    (sum, e) => sum + e.quizAttempts.length,
    0,
  );

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        to="/teacher/students"
        className="inline-flex items-center gap-1 text-sm text-teal hover:underline"
      >
        <ArrowLeft size={14} />
        Retour aux &eacute;l&egrave;ves
      </Link>

      {/* Student header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark">
            {student.firstName} {student.lastName}
          </h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-meta">
            <span className="flex items-center gap-1">
              <Mail size={12} />
              {student.email}
            </span>
            <span>Inscrit depuis le {formatDate(student.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-dark">
              {String(totalCourses)}
            </p>
            <p className="text-xs text-meta mt-1">Formations</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-teal">
              {String(completedCourses)}
            </p>
            <p className="text-xs text-meta mt-1">Termin&eacute;es</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-dark">
              {String(avgCompletion)}%
            </p>
            <p className="text-xs text-meta mt-1">Progression moy.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-dark">
              {formatDuration(totalTime)}
            </p>
            <p className="text-xs text-meta mt-1">Temps total</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed summary */}
      <div className="flex items-center gap-3 text-xs text-meta">
        <span className="flex items-center gap-1">
          <GraduationCap size={12} />
          {String(totalQuizzes)} quiz pass&eacute;
          {totalQuizzes !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Submissions section */}
      {studentId !== undefined && (
        <StudentSubmissionsSection studentId={studentId} />
      )}

      {/* Enrolment cards */}
      {enrolments.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <BookOpen size={32} className="text-meta/40 mx-auto mb-3" />
            <p className="text-meta text-sm">
              Aucune formation pour cet &eacute;l&egrave;ve.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {enrolments.map((enrolment) => (
            <EnrolmentCard key={enrolment.enrolmentId} enrolment={enrolment} />
          ))}
        </div>
      )}
    </div>
  );
}
