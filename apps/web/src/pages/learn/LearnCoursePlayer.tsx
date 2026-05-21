import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  PlayCircle,
  FileText,
  Video,
  File,
  Music,
  HelpCircle,
  PenLine,
  type LucideIcon,
} from "lucide-react";
import { api } from "@/lib/api.js";
import type {
  CourseDetailResponse,
  EnrolmentDetail,
  LessonItem,
  LessonContentType,
  LessonExercise,
  ModuleWithLessons,
  ExerciseWithQuestions,
  QuizAttemptResult,
  SubmissionResponse,
  Submission,
} from "@/lib/api.js";
import { Button } from "@/components/ui/button.js";
import { Card, CardContent } from "@/components/ui/card.js";
import { cn } from "@/lib/utils.js";

// ── Types ──────────────────────────────────────────────────────────────────────

type ProgressStatus = "not_started" | "in_progress" | "completed";

// ── Content-type icon map ──────────────────────────────────────────────────────

const CONTENT_TYPE_ICONS: Record<LessonContentType, LucideIcon> = {
  text: FileText,
  video: Video,
  pdf: File,
  audio: Music,
  quiz: HelpCircle,
};

const CONTENT_TYPE_LABELS: Record<LessonContentType, string> = {
  text: "Texte",
  video: "Vidéo",
  pdf: "PDF",
  audio: "Audio",
  quiz: "Quiz",
};

// ── Lesson sidebar item ────────────────────────────────────────────────────────

interface LessonNavItemProps {
  lesson: LessonItem;
  status: ProgressStatus;
  isActive: boolean;
  onClick: () => void;
}

function LessonNavItem({
  lesson,
  status,
  isActive,
  onClick,
}: LessonNavItemProps) {
  const Icon = CONTENT_TYPE_ICONS[lesson.contentType];
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-start gap-2.5 px-3 py-2 text-left transition-colors",
        isActive ? "bg-teal/10 text-dark" : "hover:bg-cream/60 text-meta",
      )}
    >
      <span className="mt-0.5 flex-shrink-0">
        {status === "completed" ? (
          <CheckCircle2 size={13} className="text-teal" />
        ) : status === "in_progress" ? (
          <PlayCircle size={13} className="text-olive" />
        ) : (
          <Circle size={13} className="text-meta/40" />
        )}
      </span>
      <span className="flex-1 min-w-0">
        <span className="text-xs font-medium leading-snug block truncate">
          {lesson.title}
        </span>
        <span className="flex items-center gap-1 text-[10px] text-meta/60 mt-0.5">
          <Icon size={10} />
          {CONTENT_TYPE_LABELS[lesson.contentType]}
          {lesson.durationMinutes !== null && (
            <span> · {String(lesson.durationMinutes)} min</span>
          )}
        </span>
      </span>
    </button>
  );
}

// ── Module nav section ─────────────────────────────────────────────────────────

interface ModuleNavSectionProps {
  mod: ModuleWithLessons;
  progressMap: Map<string, ProgressStatus>;
  activeLessonId: string | null;
  onLessonClick: (lesson: LessonItem) => void;
}

function ModuleNavSection({
  mod,
  progressMap,
  activeLessonId,
  onLessonClick,
}: ModuleNavSectionProps) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        onClick={() => {
          setOpen((v) => !v);
        }}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left border-b border-rule hover:bg-cream/40 transition-colors"
      >
        {open ? (
          <ChevronDown size={12} className="text-meta flex-shrink-0" />
        ) : (
          <ChevronRight size={12} className="text-meta flex-shrink-0" />
        )}
        <span className="flex-1 text-[11px] font-bold uppercase tracking-wider text-dark truncate">
          {mod.title}
        </span>
      </button>
      {open && (
        <div className="divide-y divide-rule/50">
          {mod.lessons.map((les) => (
            <LessonNavItem
              key={les.id}
              lesson={les}
              status={progressMap.get(les.id) ?? "not_started"}
              isActive={activeLessonId === les.id}
              onClick={() => {
                onLessonClick(les);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Quiz component ─────────────────────────────────────────────────────────────

interface QuizProps {
  exerciseId: string;
  enrolmentId: string;
  onComplete: () => void;
}

function Quiz({ exerciseId, enrolmentId, onComplete }: QuizProps) {
  const queryClient = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QuizAttemptResult | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["exercise", exerciseId],
    queryFn: () => api.get<ExerciseWithQuestions>(`/exercises/${exerciseId}`),
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      api.post<QuizAttemptResult>(`/exercises/${exerciseId}/attempt`, {
        enrolmentId,
        answers,
      }),
    onSuccess: (res) => {
      setResult(res);
      if (res.passed) {
        void queryClient.invalidateQueries({
          queryKey: ["enrolment", enrolmentId],
        });
        onComplete();
      }
    },
  });

  if (isLoading) {
    return <p className="text-meta text-sm">Chargement du quiz…</p>;
  }

  if (data === undefined || data.questions.length === 0) {
    return (
      <p className="text-meta text-sm italic">Aucune question disponible.</p>
    );
  }

  const { questions } = data;
  const allAnswered = questions.every((q) => q.id in answers);

  if (result !== null) {
    return (
      <div className="space-y-4">
        <div
          className={cn(
            "rounded border px-5 py-4",
            result.passed
              ? "border-teal/30 bg-teal/5"
              : "border-rose/30 bg-rose/5",
          )}
        >
          <p className="font-semibold text-dark mb-1">
            {result.passed ? "Bravo ! Quiz réussi." : "Quiz non validé."}
          </p>
          <p className="text-sm text-meta">
            Score : {String(result.score)} / {String(result.maxScore)} (
            {String(Math.round((result.score / result.maxScore) * 100))}%)
          </p>
          {!result.passed && (
            <p className="text-xs text-meta mt-1">
              Score minimum requis : 70%. Réessayez.
            </p>
          )}
        </div>

        {/* Per-question feedback */}
        <div className="space-y-3">
          {result.feedback.map((fb, i) => {
            const q = questions.find((qq) => qq.id === fb.questionId);
            return (
              <div
                key={fb.questionId}
                className={cn(
                  "rounded border px-4 py-3 text-sm",
                  fb.correct
                    ? "border-teal/20 bg-teal/5"
                    : "border-rose/20 bg-rose/5",
                )}
              >
                <p className="font-medium text-dark mb-1">
                  {String(i + 1)}. {q?.questionText ?? ""}
                </p>
                <p className={fb.correct ? "text-teal" : "text-rose"}>
                  {fb.correct ? "✓ Correct" : "✗ Incorrect"}
                </p>
                {!fb.correct && fb.explanation !== null && (
                  <p className="text-meta text-xs mt-1">{fb.explanation}</p>
                )}
              </div>
            );
          })}
        </div>

        {!result.passed && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setAnswers({});
              setResult(null);
            }}
          >
            Réessayer
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-meta">
        {String(questions.length)} question{questions.length !== 1 ? "s" : ""} ·
        Score minimum pour valider : 70%
      </p>

      {questions.map((q, qi) => (
        <div key={q.id} className="space-y-3">
          <p className="text-sm font-medium text-dark">
            {String(qi + 1)}. {q.questionText}
          </p>
          <div className="space-y-2">
            {q.options.map((opt) => (
              <label
                key={opt.id}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 border rounded cursor-pointer transition-colors",
                  answers[q.id] === opt.id
                    ? "border-teal bg-teal/5 text-dark"
                    : "border-rule bg-white/50 text-meta hover:border-teal/40",
                )}
              >
                <input
                  type="radio"
                  name={q.id}
                  value={opt.id}
                  checked={answers[q.id] === opt.id}
                  onChange={() => {
                    setAnswers((a) => ({ ...a, [q.id]: opt.id }));
                  }}
                  className="accent-teal"
                />
                <span className="text-sm">{opt.text}</span>
              </label>
            ))}
          </div>
        </div>
      ))}

      <Button
        size="sm"
        disabled={!allAnswered || submitMutation.isPending}
        onClick={() => {
          submitMutation.mutate();
        }}
      >
        {submitMutation.isPending ? "Correction…" : "Soumettre le quiz"}
      </Button>
    </div>
  );
}

// ── Submission form (assignment / reflection) ──────────────────────────────────

interface SubmissionFormProps {
  exerciseId: string;
  enrolmentId: string;
  exerciseTitle: string;
  exerciseType: string;
}

function SubmissionForm({
  exerciseId,
  enrolmentId,
  exerciseTitle,
  exerciseType,
}: SubmissionFormProps) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [saved, setSaved] = useState<Submission | null>(null);

  const { data: existing } = useQuery<SubmissionResponse>({
    queryKey: ["submission", enrolmentId, exerciseId],
    queryFn: () =>
      api.get<SubmissionResponse>(
        `/enrolments/${enrolmentId}/exercises/${exerciseId}/submission`,
      ),
    retry: false,
  });

  useEffect(() => {
    if (existing?.submission !== undefined && body === "") {
      setBody(existing.submission.body);
      setSaved(existing.submission);
    }
  }, [existing, body]);

  const submitMutation = useMutation({
    mutationFn: () =>
      api.post<SubmissionResponse>(
        `/enrolments/${enrolmentId}/exercises/${exerciseId}/submit`,
        { body },
      ),
    onSuccess: (data) => {
      setSaved(data.submission);
      void queryClient.invalidateQueries({
        queryKey: ["submission", enrolmentId, exerciseId],
      });
    },
  });

  const typeLabel = exerciseType === "assignment" ? "Devoir" : "Réflexion";

  return (
    <div className="border border-slate-200 rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <PenLine size={15} className="text-teal" />
        {typeLabel} : {exerciseTitle}
      </div>

      {saved !== null && saved.status === "graded" && (
        <div className="bg-teal-50 border border-teal-200 rounded-lg px-4 py-3 space-y-1">
          <p className="text-xs font-bold text-teal uppercase tracking-wider">
            Note reçue
          </p>
          {saved.score !== null && (
            <p className="text-sm font-semibold text-slate-800">
              Score : {saved.score.toString()}
            </p>
          )}
          {saved.feedback !== null && (
            <p className="text-sm text-slate-700">{saved.feedback}</p>
          )}
        </div>
      )}

      {saved !== null && saved.status === "submitted" && (
        <p className="text-xs text-amber-600 font-medium">
          Réponse soumise — en attente de correction.
        </p>
      )}

      <textarea
        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500"
        rows={6}
        placeholder="Rédigez votre réponse ici…"
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
        }}
        disabled={saved?.status === "graded"}
      />

      {saved?.status !== "graded" && (
        <Button
          size="sm"
          disabled={submitMutation.isPending || !body.trim()}
          onClick={() => {
            submitMutation.mutate();
          }}
        >
          <PenLine size={13} className="mr-1.5" />
          {submitMutation.isPending
            ? "Envoi…"
            : saved !== null
              ? "Soumettre à nouveau"
              : "Soumettre"}
        </Button>
      )}
    </div>
  );
}

// ── Lesson content viewer ──────────────────────────────────────────────────────

interface LessonViewerProps {
  lesson: LessonItem;
  enrolmentId: string;
  status: ProgressStatus;
  onMarkComplete: () => void;
  onNext: (() => void) | null;
}

function LessonViewer({
  lesson,
  enrolmentId,
  status,
  onMarkComplete,
  onNext,
}: LessonViewerProps) {
  const Icon = CONTENT_TYPE_ICONS[lesson.contentType];
  const firstExercise: LessonExercise | undefined = lesson.exercises[0] as
    | LessonExercise
    | undefined;

  return (
    <div className="space-y-6">
      {/* Lesson header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-meta uppercase tracking-wider font-bold mb-2">
          <Icon size={12} />
          {CONTENT_TYPE_LABELS[lesson.contentType]}
          {lesson.durationMinutes !== null && (
            <span>· {String(lesson.durationMinutes)} min</span>
          )}
          {lesson.isFreePreview && (
            <span className="border border-teal/30 text-teal px-1.5 py-0.5 rounded">
              Aperçu
            </span>
          )}
        </div>
        <h2 className="text-xl font-bold text-dark">{lesson.title}</h2>
        {lesson.description !== null && (
          <p className="text-meta text-sm mt-1">{lesson.description}</p>
        )}
      </div>

      {/* Content */}
      <Card>
        <CardContent className="p-6">
          {lesson.contentType === "text" && (
            <>
              {lesson.contentBody !== null ? (
                <div
                  className="prose prose-sm max-w-none text-dark"
                  dangerouslySetInnerHTML={{ __html: lesson.contentBody }}
                />
              ) : (
                <p className="text-meta italic text-sm">
                  Aucun contenu disponible.
                </p>
              )}
            </>
          )}

          {lesson.contentType === "video" && (
            <>
              {lesson.contentUrl !== null ? (
                <video
                  controls
                  className="w-full rounded aspect-video bg-dark"
                  src={lesson.contentUrl}
                >
                  Votre navigateur ne supporte pas la lecture vidéo.
                </video>
              ) : (
                <div className="aspect-video bg-dark/5 border border-rule rounded flex items-center justify-center">
                  <p className="text-meta text-sm">Vidéo non disponible.</p>
                </div>
              )}
            </>
          )}

          {lesson.contentType === "pdf" && (
            <>
              {lesson.contentUrl !== null ? (
                <iframe
                  src={lesson.contentUrl}
                  className="w-full h-[600px] border-0 rounded"
                  title={lesson.title}
                />
              ) : (
                <p className="text-meta text-sm italic">PDF non disponible.</p>
              )}
            </>
          )}

          {lesson.contentType === "audio" && (
            <>
              {lesson.contentUrl !== null ? (
                <audio controls className="w-full" src={lesson.contentUrl}>
                  Votre navigateur ne supporte pas la lecture audio.
                </audio>
              ) : (
                <p className="text-meta text-sm italic">
                  Audio non disponible.
                </p>
              )}
            </>
          )}

          {lesson.contentType === "quiz" && firstExercise !== undefined ? (
            <Quiz
              exerciseId={firstExercise.id}
              enrolmentId={enrolmentId}
              onComplete={onMarkComplete}
            />
          ) : lesson.contentType === "quiz" ? (
            <p className="text-meta text-sm italic">
              Aucun quiz disponible pour cette leçon.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* Assignment / reflection exercises */}
      {lesson.exercises
        .filter((ex) => ex.type === "assignment" || ex.type === "reflection")
        .map((ex) => (
          <SubmissionForm
            key={ex.id}
            exerciseId={ex.id}
            enrolmentId={enrolmentId}
            exerciseTitle={ex.title}
            exerciseType={ex.type}
          />
        ))}

      {/* Actions */}
      <div className="flex items-center gap-3">
        {lesson.contentType !== "quiz" && status !== "completed" && (
          <Button size="sm" onClick={onMarkComplete}>
            <CheckCircle2 size={13} className="mr-1.5" />
            Marquer comme terminé
          </Button>
        )}
        {status === "completed" && onNext !== null && (
          <Button size="sm" onClick={onNext}>
            Leçon suivante →
          </Button>
        )}
        {status === "completed" && (
          <span className="flex items-center gap-1.5 text-xs text-teal font-bold uppercase tracking-wider">
            <CheckCircle2 size={13} />
            Terminé
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main player page ───────────────────────────────────────────────────────────

export function LearnCoursePlayerPage() {
  const { enrolmentId } = useParams<{ enrolmentId: string }>();
  const id = enrolmentId ?? "";
  const queryClient = useQueryClient();
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);

  const { data: enrolmentData } = useQuery({
    queryKey: ["enrolment", id],
    queryFn: () => api.get<EnrolmentDetail>(`/enrolments/${id}`),
    enabled: id.length > 0,
  });

  const { data: courseData } = useQuery({
    queryKey: ["enrolment-course", id],
    queryFn: async () => {
      const courseId = enrolmentData?.enrolment.courseId;
      if (courseId === undefined) throw new Error("no courseId");
      return api.get<CourseDetailResponse>(`/courses/${courseId}`);
    },
    enabled: enrolmentData?.enrolment.courseId !== undefined,
  });

  const progressMutation = useMutation({
    mutationFn: ({
      lessonId,
      status,
    }: {
      lessonId: string;
      status: "in_progress" | "completed";
    }) => api.put(`/enrolments/${id}/progress/${lessonId}`, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["enrolment", id] });
    },
  });

  const modules = courseData?.course.modules ?? [];
  const allLessons = modules.flatMap((m) => m.lessons);

  const progressMap = new Map<string, ProgressStatus>(
    (enrolmentData?.progress ?? []).map((p) => [
      p.lessonId,
      p.status as ProgressStatus,
    ]),
  );

  // Auto-select first incomplete lesson on initial load
  useEffect(() => {
    if (allLessons.length === 0 || activeLessonId !== null) return;
    const first =
      allLessons.find(
        (l) => (progressMap.get(l.id) ?? "not_started") !== "completed",
      ) ?? allLessons[0];
    setActiveLessonId(first.id);
    if ((progressMap.get(first.id) ?? "not_started") === "not_started") {
      progressMutation.mutate({ lessonId: first.id, status: "in_progress" });
    }
  }, [allLessons.length]); // eslint-disable-line

  function handleLessonSelect(lesson: LessonItem) {
    setActiveLessonId(lesson.id);
    if ((progressMap.get(lesson.id) ?? "not_started") === "not_started") {
      progressMutation.mutate({ lessonId: lesson.id, status: "in_progress" });
    }
  }

  function handleMarkComplete() {
    if (activeLessonId === null) return;
    progressMutation.mutate({ lessonId: activeLessonId, status: "completed" });
  }

  const activeLesson =
    activeLessonId !== null
      ? (allLessons.find((l) => l.id === activeLessonId) ?? null)
      : null;

  const nextLesson = (() => {
    if (activeLessonId === null) return null;
    const idx = allLessons.findIndex((l) => l.id === activeLessonId);
    return allLessons[idx + 1] ?? null;
  })();

  const completionPct = enrolmentData?.completionPct ?? 0;
  const courseName = courseData?.course.title ?? "Chargement…";

  return (
    <div className="-mx-8 -my-8">
      {/* Top bar */}
      <div className="flex items-center gap-4 px-8 py-3 bg-white border-b border-rule">
        <Link to="/learn/courses">
          <button className="text-meta hover:text-dark transition-colors">
            <ArrowLeft size={16} />
          </button>
        </Link>
        <p className="flex-1 font-semibold text-sm text-dark truncate min-w-0">
          {courseName}
        </p>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-32 h-1.5 bg-rule rounded-full overflow-hidden">
            <div
              className="h-full bg-teal rounded-full transition-all"
              style={{ width: `${String(Math.round(completionPct))}%` }}
            />
          </div>
          <span className="text-xs text-meta tabular-nums">
            {String(Math.round(completionPct))}%
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex" style={{ minHeight: "calc(100vh - 112px)" }}>
        {/* Lesson tree sidebar */}
        <aside className="w-64 flex-shrink-0 border-r border-rule bg-white overflow-y-auto">
          {modules.length === 0 ? (
            <p className="text-meta text-xs p-4">Chargement…</p>
          ) : (
            modules.map((mod) => (
              <ModuleNavSection
                key={mod.id}
                mod={mod}
                progressMap={progressMap}
                activeLessonId={activeLessonId}
                onLessonClick={handleLessonSelect}
              />
            ))
          )}
        </aside>

        {/* Lesson content */}
        <main className="flex-1 overflow-y-auto px-8 py-8">
          {activeLesson !== null ? (
            <LessonViewer
              lesson={activeLesson}
              enrolmentId={id}
              status={progressMap.get(activeLesson.id) ?? "not_started"}
              onMarkComplete={handleMarkComplete}
              onNext={
                nextLesson !== null
                  ? () => {
                      handleLessonSelect(nextLesson);
                    }
                  : null
              }
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <CheckCircle2 size={40} className="text-meta/30" />
              <p className="text-meta text-sm">
                Sélectionnez une leçon pour commencer.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
