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
  type LucideIcon,
} from "lucide-react";
import { api } from "@/lib/api.js";
import type {
  CourseDetailResponse,
  EnrolmentDetail,
  LessonItem,
  LessonContentType,
  ModuleWithLessons,
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

// ── Quiz placeholder ───────────────────────────────────────────────────────────

interface QuizPlaceholderProps {
  enrolmentId: string;
  lessonId: string;
  onComplete: () => void;
}

function QuizPlaceholder({
  enrolmentId,
  lessonId,
  onComplete,
}: QuizPlaceholderProps) {
  const queryClient = useQueryClient();

  const markMutation = useMutation({
    mutationFn: () =>
      api.put(`/enrolments/${enrolmentId}/progress/${lessonId}`, {
        status: "completed",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["enrolment", enrolmentId],
      });
      onComplete();
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 text-sm text-meta border border-rule rounded px-4 py-3 bg-white/50">
        <HelpCircle size={15} className="text-teal flex-shrink-0 mt-0.5" />
        <span>
          Ce module contient un quiz interactif. Répondez aux questions pour
          valider votre progression.
        </span>
      </div>
      <Button
        size="sm"
        disabled={markMutation.isPending}
        onClick={() => {
          markMutation.mutate();
        }}
      >
        {markMutation.isPending ? "Validation…" : "Valider et continuer"}
      </Button>
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
            <div className="prose prose-sm max-w-none text-dark">
              {lesson.contentBody !== null ? (
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                  {lesson.contentBody}
                </pre>
              ) : (
                <p className="text-meta italic">Aucun contenu disponible.</p>
              )}
            </div>
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

          {lesson.contentType === "quiz" && (
            <QuizPlaceholder
              enrolmentId={enrolmentId}
              lessonId={lesson.id}
              onComplete={onMarkComplete}
            />
          )}
        </CardContent>
      </Card>

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
