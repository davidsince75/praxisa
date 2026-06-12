import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, File, HelpCircle, StickyNote, Bot } from "lucide-react";
import type { LessonItem, LessonExercise } from "@/lib/api.js";
import { Button } from "@/components/ui/button.js";
import { Card, CardContent } from "@/components/ui/card.js";
import { cn } from "@/lib/utils.js";
import { CONTENT_TYPE_ICONS, CONTENT_TYPE_LABELS } from "./shared.js";
import type { ProgressStatus } from "./shared.js";
import { LessonNotes } from "./LessonNotes.js";
import { Quiz } from "./Quiz.js";
import { SubmissionForm } from "./SubmissionForm.js";

// ── Lesson content viewer ──────────────────────────────────────────────────────

interface LessonViewerProps {
  lesson: LessonItem;
  enrolmentId: string;
  courseId: string;
  moduleId: string;
  status: ProgressStatus;
  onMarkComplete: () => void;
  onNext: (() => void) | null;
  nextLabel?: string;
}

export function LessonViewer({
  lesson,
  enrolmentId,
  courseId,
  moduleId,
  status,
  onMarkComplete,
  onNext,
  nextLabel,
}: LessonViewerProps) {
  const [showNotes, setShowNotes] = useState(false);
  const Icon = CONTENT_TYPE_ICONS[lesson.contentType];
  const firstExercise: LessonExercise | undefined = lesson.exercises[0] as
    | LessonExercise
    | undefined;

  return (
    <div className="space-y-6">
      {/* Lesson header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-meta uppercase tracking-wider font-semibold mb-2">
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
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-semibold text-dark">{lesson.title}</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setShowNotes((v) => !v);
              }}
              className={cn(
                "flex items-center gap-1.5 flex-shrink-0 text-xs font-semibold uppercase tracking-wider transition-colors border rounded px-2 py-1",
                showNotes
                  ? "bg-teal/10 text-teal border-teal/40"
                  : "text-teal hover:text-teal/70 border-teal/30",
              )}
            >
              <StickyNote size={11} />
              Documents / Notes +
            </button>
            <Link
              to={`/learn/ai?lessonId=${lesson.id}&lessonTitle=${encodeURIComponent(lesson.title)}`}
              className="flex items-center gap-1.5 flex-shrink-0 text-xs font-semibold uppercase tracking-wider text-teal hover:text-teal/70 transition-colors border border-teal/30 rounded px-2 py-1"
            >
              <Bot size={11} />
              Ask AI
            </Link>
          </div>
        </div>
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
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-4 bg-cream/50 rounded-lg border border-rule">
                    <File size={20} className="text-teal flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-dark truncate">
                        {lesson.title}
                      </p>
                      <p className="text-xs text-meta">Document PDF</p>
                    </div>
                    <a
                      href={lesson.contentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-teal hover:text-teal/70 transition-colors border border-teal/30 rounded px-3 py-1.5"
                    >
                      Ouvrir le PDF ↗
                    </a>
                  </div>
                  <iframe
                    src={`https://docs.google.com/viewer?url=${encodeURIComponent(lesson.contentUrl)}&embedded=true`}
                    className="w-full h-[600px] border border-rule rounded"
                    title={lesson.title}
                  />
                </div>
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

      {/* Quiz exercises attached to non-quiz lessons */}
      {lesson.contentType !== "quiz" &&
        lesson.exercises
          .filter((ex) => ex.type === "quiz")
          .map((ex) => (
            <div
              key={ex.id}
              className="border border-slate-200 rounded-xl p-5 space-y-4"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <HelpCircle size={15} className="text-teal" />
                Quiz : {ex.title}
              </div>
              <Quiz
                exerciseId={ex.id}
                enrolmentId={enrolmentId}
                onComplete={onMarkComplete}
              />
            </div>
          ))}

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
            exerciseDescription={ex.description}
            dueAt={ex.dueAt}
          />
        ))}

      {/* Notes */}
      {showNotes && (
        <LessonNotes
          courseId={courseId}
          moduleId={moduleId}
          lessonId={lesson.id}
          lessonTitle={lesson.title}
        />
      )}

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
            {nextLabel ?? "Leçon suivante →"}
          </Button>
        )}
        {status === "completed" && (
          <span className="flex items-center gap-1.5 text-xs text-teal font-semibold uppercase tracking-wider">
            <CheckCircle2 size={13} />
            Terminé
          </span>
        )}
      </div>
    </div>
  );
}
