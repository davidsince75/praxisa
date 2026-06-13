import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Download } from "lucide-react";
import { api } from "@/lib/api.js";
import type {
  CourseDetailResponse,
  EnrolmentDetail,
  LessonItem,
} from "@/lib/api.js";
import { useAuth } from "@/hooks/useAuth.js";
import { useRestrictionStatus } from "@/hooks/useRestrictionStatus.js";
import { Button } from "@/components/ui/button.js";
import type { ProgressStatus } from "./player/shared.js";
import { CourseRatingCard } from "./player/CourseRatingCard.js";
import { ModuleNavSection } from "./player/LessonNav.js";
import { LessonViewer } from "./player/LessonViewer.js";
import { ModuleCardGrid } from "./player/ModuleCardGrid.js";

// ── Main player page ───────────────────────────────────────────────────────────

export function LearnCoursePlayerPage() {
  const { enrolmentId } = useParams<{ enrolmentId: string }>();
  const id = enrolmentId ?? "";
  const queryClient = useQueryClient();
  const { user: authUser } = useAuth();
  // Live restriction from /auth/me (reflects admin toggles without re-login);
  // fall back to the cached login-time value while it loads.
  const liveRestricted = useRestrictionStatus();
  const cachedRestricted = authUser?.isRestricted === true;
  const userRestricted = liveRestricted ?? cachedRestricted;
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
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
    staleTime: 0,
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

  const progressMap = new Map<string, ProgressStatus>(
    (enrolmentData?.progress ?? []).map((p) => [
      p.lessonId,
      p.status as ProgressStatus,
    ]),
  );

  // Auto-select the only module if there's just one
  useEffect(() => {
    if (modules.length === 1 && selectedModuleId === null) {
      setSelectedModuleId(modules[0].id);
    }
  }, [modules.length]); // eslint-disable-line

  // Auto-select first incomplete lesson when entering a module
  useEffect(() => {
    if (selectedModuleId === null || activeLessonId !== null) return;
    const mod = modules.find((m) => m.id === selectedModuleId);
    if (mod === undefined) return;
    if (mod.lessons.length === 0) return;
    const first =
      mod.lessons.find(
        (l) => (progressMap.get(l.id) ?? "not_started") !== "completed",
      ) ?? mod.lessons[0];
    setActiveLessonId(first.id);
    if ((progressMap.get(first.id) ?? "not_started") === "not_started") {
      progressMutation.mutate({ lessonId: first.id, status: "in_progress" });
    }
  }, [selectedModuleId, modules.length]); // eslint-disable-line

  const selectedModule =
    selectedModuleId !== null
      ? (modules.find((m) => m.id === selectedModuleId) ?? null)
      : null;

  const moduleLessons = selectedModule?.lessons ?? [];

  function handleModuleSelect(moduleId: string) {
    setSelectedModuleId(moduleId);
    setActiveLessonId(null);
  }

  function handleBackToModules() {
    setSelectedModuleId(null);
    setActiveLessonId(null);
  }

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
      ? (moduleLessons.find((l) => l.id === activeLessonId) ?? null)
      : null;

  // Next lesson scoped to current module only
  const nextLesson = (() => {
    if (activeLessonId === null) return null;
    const idx = moduleLessons.findIndex((l) => l.id === activeLessonId);
    return moduleLessons[idx + 1] ?? null;
  })();

  const completionPct = enrolmentData?.completionPct ?? 0;
  const courseName = courseData?.course.title ?? "Chargement…";
  const isProvisional = enrolmentData?.isProvisional === true;
  const shouldLockModules = isProvisional || userRestricted;

  // Compute locked modules for provisional/restricted access (first 3 unlocked)
  const PROVISIONAL_MODULE_LIMIT = 3;
  const lockedModuleIds = (() => {
    if (!shouldLockModules || modules.length === 0) return undefined;
    const sorted = [...modules].sort((a, b) => a.position - b.position);
    const allowedIds = new Set(
      sorted.slice(0, PROVISIONAL_MODULE_LIMIT).map((m) => m.id),
    );
    const locked = new Set<string>();
    for (const m of modules) {
      if (!allowedIds.has(m.id)) locked.add(m.id);
    }
    return locked;
  })();

  const provisionalDaysLeft = (() => {
    if (!isProvisional || enrolmentData.provisionalUntil == null) return 0;
    const diff =
      new Date(enrolmentData.provisionalUntil).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
  })();

  const confirmMutation = useMutation({
    mutationFn: () => api.post(`/enrolments/${id}/confirm`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["enrolment", id] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.patch(`/enrolments/${id}/cancel`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["enrolment", id] });
    },
  });

  return (
    <div className="-mx-8 -my-8">
      {/* Top bar */}
      <div className="flex items-center gap-4 px-8 py-3 bg-white border-b border-rule">
        <Link
          to="/learn/courses"
          aria-label="Retour à mes cours"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center text-meta hover:text-dark transition-colors"
        >
          <ArrowLeft size={16} aria-hidden="true" />
        </Link>
        <h1 className="flex-1 font-semibold text-sm text-dark truncate min-w-0">
          {courseName}
        </h1>
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

      {selectedModuleId === null ? (
        /* ── Level 1: Module card grid ─────────────────────────────────── */
        <div className="px-8 py-8">
          {modules.length === 0 ? (
            <p className="text-meta text-sm">Chargement…</p>
          ) : (
            <>
              {userRestricted && !isProvisional && (
                <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-5 py-4">
                  <p className="text-sm font-medium text-amber-800">
                    Compte en accès restreint — Accès aux 3 premiers modules
                    uniquement.
                  </p>
                  <p className="text-xs text-amber-700 mt-1">
                    Contactez l'administrateur pour obtenir l'accès complet.
                  </p>
                </div>
              )}
              {isProvisional && (
                <div className="mb-6 rounded-lg border border-olive/30 bg-olive/5 px-5 py-4">
                  <p className="text-sm font-medium text-dark">
                    Période d&apos;essai — Accès aux 3 premiers modules.
                    {provisionalDaysLeft > 0 && (
                      <span className="text-meta ml-1">
                        Accès complet dans {String(provisionalDaysLeft)} jour
                        {provisionalDaysLeft !== 1 ? "s" : ""}.
                      </span>
                    )}
                  </p>
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      disabled={confirmMutation.isPending}
                      onClick={() => {
                        confirmMutation.mutate();
                      }}
                    >
                      {confirmMutation.isPending
                        ? "Confirmation…"
                        : "Confirmer mon inscription"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={cancelMutation.isPending}
                      onClick={() => {
                        cancelMutation.mutate();
                      }}
                    >
                      Annuler mon inscription
                    </Button>
                  </div>
                </div>
              )}
              {courseData?.course.coursePdfId !== undefined &&
                courseData.course.coursePdfId !== null && (
                  <div className="mb-4">
                    <a
                      href={"/v1/files/" + courseData.course.coursePdfId}
                      download
                      className="inline-flex items-center gap-2 text-sm font-medium text-teal hover:text-teal/80 transition-colors border border-teal/30 px-4 py-2 rounded-md"
                    >
                      <Download size={14} />
                      Telecharger le cours complet (PDF)
                    </a>
                  </div>
                )}
              <p className="text-sm text-meta mb-4">
                Choisissez un module pour commencer.
              </p>
              <ModuleCardGrid
                modules={modules}
                progressMap={progressMap}
                lockedModuleIds={lockedModuleIds}
                onModuleClick={handleModuleSelect}
              />
              {enrolmentData?.enrolment.status === "completed" && (
                <div className="mt-8 max-w-xs">
                  <CourseRatingCard
                    courseId={enrolmentData.enrolment.courseId}
                  />
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        /* ── Level 2: Module lesson view (sidebar + content) ───────────── */
        <div className="flex" style={{ minHeight: "calc(100vh - 112px)" }}>
          <aside className="w-64 flex-shrink-0 border-r border-rule bg-white overflow-y-auto">
            {modules.length > 1 && (
              <button
                onClick={handleBackToModules}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left border-b border-rule hover:bg-cream/40 transition-colors text-teal"
              >
                <ArrowLeft size={12} />
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Modules
                </span>
              </button>
            )}
            {selectedModule !== null && (
              <ModuleNavSection
                mod={selectedModule}
                progressMap={progressMap}
                activeLessonId={activeLessonId}
                onLessonClick={handleLessonSelect}
              />
            )}
            {enrolmentData?.enrolment.status === "completed" && (
              <CourseRatingCard courseId={enrolmentData.enrolment.courseId} />
            )}
          </aside>

          <main className="flex-1 overflow-y-auto px-8 py-8">
            {activeLesson !== null ? (
              <LessonViewer
                lesson={activeLesson}
                enrolmentId={id}
                courseId={enrolmentData?.enrolment.courseId ?? ""}
                moduleId={selectedModuleId}
                status={progressMap.get(activeLesson.id) ?? "not_started"}
                onMarkComplete={handleMarkComplete}
                onNext={
                  nextLesson !== null
                    ? () => {
                        handleLessonSelect(nextLesson);
                      }
                    : modules.length > 1
                      ? handleBackToModules
                      : null
                }
                nextLabel={
                  nextLesson === null && modules.length > 1
                    ? "← Retour aux modules"
                    : undefined
                }
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-64 gap-3">
                <CheckCircle2 size={40} className="text-meta" />
                <p className="text-meta text-sm">
                  Sélectionnez une leçon pour commencer.
                </p>
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
}
