import { useState, useRef, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Save,
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Minus,
  Plus,
  Trash2,
  Calendar,
  ClipboardList,
  ImageIcon,
  Video,
  Link2,
  X,
  type LucideIcon,
} from "lucide-react";
import { api } from "@/lib/api.js";
import type {
  CourseDetailResponse,
  LessonContentType,
  LessonExercise,
} from "@/lib/api.js";
import { Button } from "@/components/ui/button.js";
import { Input } from "@/components/ui/input.js";
import { Label } from "@/components/ui/label.js";

// ── Constants ────────────────────────────────────────────────────────────────────

const CONTENT_TYPES: { value: LessonContentType; label: string }[] = [
  { value: "text", label: "Texte" },
  { value: "video", label: "Vidéo" },
  { value: "pdf", label: "PDF" },
  { value: "audio", label: "Audio" },
  { value: "quiz", label: "Quiz" },
];

const EXERCISE_TYPES = [
  { value: "assignment", label: "Devoir" },
  { value: "reflection", label: "Réflexion" },
  { value: "quiz", label: "Quiz" },
];

// ── Toolbar button ───────────────────────────────────────────────────────────────

function ToolbarBtn({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className="p-2 rounded hover:bg-slate-200 transition-colors text-slate-600 hover:text-slate-900"
    >
      <Icon size={16} />
    </button>
  );
}

// ── Exercise card ────────────────────────────────────────────────────────────────

function ExerciseCard({
  exercise,
  courseId,
  moduleId,
  lessonId,
  onRefresh,
}: {
  exercise: LessonExercise;
  courseId: string;
  moduleId: string;
  lessonId: string;
  onRefresh: () => void;
}) {
  const basePath = `/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/exercises/${exercise.id}`;

  const [localTitle, setLocalTitle] = useState(exercise.title);

  const updateMutation = useMutation({
    mutationFn: (patch: Record<string, unknown>) => api.patch(basePath, patch),
    onSuccess: () => {
      onRefresh();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(basePath),
    onSuccess: () => {
      onRefresh();
    },
    onError: (err: unknown) => {
      window.alert(
        err instanceof Error ? err.message : "Erreur de suppression",
      );
    },
  });

  function saveTitle(): void {
    const trimmed = localTitle.trim();
    if (trimmed.length > 0 && trimmed !== exercise.title) {
      updateMutation.mutate({ title: trimmed });
    }
  }

  const currentDate =
    exercise.dueAt !== null ? exercise.dueAt.slice(0, 10) : "";

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2.5">
      {/* Header row: type badge + delete */}
      <div className="flex items-center justify-between gap-2">
        <select
          value={exercise.type}
          onChange={(e) => {
            updateMutation.mutate({ type: e.target.value });
          }}
          className="text-[10px] font-bold uppercase tracking-wider text-white bg-teal-600 pl-1.5 pr-4 py-0.5 rounded border-none appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-teal-400"
          title="Type d'exercice"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='white'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E\")",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 2px center",
          }}
        >
          {EXERCISE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            deleteMutation.mutate();
          }}
          className="text-slate-400 hover:text-red-500 transition-colors p-0.5 shrink-0"
          title="Supprimer"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Editable title */}
      <textarea
        value={localTitle}
        rows={2}
        onChange={(e) => {
          setLocalTitle(e.target.value);
        }}
        onBlur={saveTitle}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        className="w-full text-sm text-slate-700 border border-transparent rounded px-1.5 py-1 -ml-1.5 hover:border-slate-200 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 transition-colors bg-transparent resize-none"
        title="Cliquez pour modifier le titre"
      />

      {/* Deadline */}
      <div className="flex items-center gap-2">
        <Calendar size={11} className="text-slate-400 shrink-0" />
        <input
          type="date"
          value={currentDate}
          onChange={(e) => {
            const val = e.target.value;
            const dueAt =
              val.length > 0 ? new Date(val + "T23:59:59").toISOString() : null;
            updateMutation.mutate({ dueAt });
          }}
          className="text-xs border border-slate-200 rounded px-2 py-1 flex-1 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
        />
        {exercise.dueAt !== null && (
          <button
            onClick={() => {
              updateMutation.mutate({ dueAt: null });
            }}
            className="text-[10px] text-slate-400 hover:text-red-500 transition-colors shrink-0"
            title="Supprimer l'echeance"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────────

export function TeacherLessonEditorPage() {
  const {
    courseId = "",
    moduleId = "",
    lessonId = "",
  } = useParams<{
    courseId: string;
    moduleId: string;
    lessonId: string;
  }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const editorRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  const isNew = lessonId === "new";

  // Form state
  const [title, setTitle] = useState("");
  const [contentType, setContentType] = useState<LessonContentType>("text");
  const [contentUrl, setContentUrl] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [isFreePreview, setIsFreePreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Exercise form state
  const [addingExercise, setAddingExercise] = useState(false);
  const [newExTitle, setNewExTitle] = useState("");
  const [newExType, setNewExType] = useState("assignment");
  const [newExMaxScore, setNewExMaxScore] = useState("20");
  const [newExDueAt, setNewExDueAt] = useState("");

  // Load course detail (lessons are nested inside)
  const { data } = useQuery<CourseDetailResponse>({
    queryKey: ["course", courseId],
    queryFn: () => api.get<CourseDetailResponse>(`/courses/${courseId}`),
    enabled: courseId.length > 0,
  });

  // Find the specific lesson from course modules
  const lesson = !isNew
    ? data?.course.modules
        .find((m) => m.id === moduleId)
        ?.lessons.find((l) => l.id === lessonId)
    : undefined;

  // Populate form when lesson loads
  useEffect(() => {
    if (lesson !== undefined && !initialized.current) {
      initialized.current = true;
      setTitle(lesson.title);
      setContentType(lesson.contentType);
      setContentUrl(lesson.contentUrl ?? "");
      setDurationMinutes(
        lesson.durationMinutes !== null ? String(lesson.durationMinutes) : "",
      );
      setIsFreePreview(lesson.isFreePreview);
      if (editorRef.current !== null && lesson.contentBody !== null) {
        editorRef.current.innerHTML = lesson.contentBody;
      }
    }
  }, [lesson]);

  // Toolbar exec
  const exec = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  }, []);

  // Media insertion state
  const [mediaPopover, setMediaPopover] = useState<
    "image" | "video" | "link" | null
  >(null);
  const [mediaUrl, setMediaUrl] = useState("");

  function insertMedia(): void {
    const url = mediaUrl.trim();
    if (url.length === 0) return;
    editorRef.current?.focus();

    if (mediaPopover === "image") {
      document.execCommand(
        "insertHTML",
        false,
        `<img src="${url}" alt="" style="max-width:100%;height:auto;border-radius:6px;margin:12px 0;" />`,
      );
    } else if (mediaPopover === "video") {
      // Convert YouTube watch URLs to embed
      let embedUrl = url;
      const ytMatch = url.match(
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/,
      );
      if (ytMatch) {
        embedUrl = `https://www.youtube.com/embed/${ytMatch[1]}`;
      }
      document.execCommand(
        "insertHTML",
        false,
        `<div style="position:relative;padding-bottom:56.25%;height:0;margin:12px 0;border-radius:6px;overflow:hidden;"><iframe src="${embedUrl}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;" allowfullscreen></iframe></div>`,
      );
    } else if (mediaPopover === "link") {
      document.execCommand("createLink", false, url);
    }

    setMediaUrl("");
    setMediaPopover(null);
  }

  // Save handler
  async function handleSave(): Promise<void> {
    setSaving(true);
    setError("");
    try {
      const contentBody = editorRef.current?.innerHTML ?? "";
      const dur =
        durationMinutes.length > 0 ? Number(durationMinutes) : undefined;
      const body = {
        title,
        contentType,
        contentUrl: contentUrl.length > 0 ? contentUrl : undefined,
        contentBody: contentBody.length > 0 ? contentBody : undefined,
        durationMinutes: dur,
        isFreePreview,
      };

      if (isNew) {
        await api.post(
          `/courses/${courseId}/modules/${moduleId}/lessons`,
          body,
        );
      } else {
        await api.patch(
          `/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`,
          body,
        );
      }

      void queryClient.invalidateQueries({ queryKey: ["course", courseId] });
      navigate(`/teacher/courses/${courseId}/builder`);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Erreur lors de la sauvegarde",
      );
    } finally {
      setSaving(false);
    }
  }

  function refresh(): void {
    void queryClient.invalidateQueries({ queryKey: ["course", courseId] });
  }

  // Add exercise mutation
  const addExerciseMutation = useMutation({
    mutationFn: () =>
      api.post(
        `/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/exercises`,
        {
          title: newExTitle,
          type: newExType,
          maxScore: Number(newExMaxScore),
          dueAt:
            newExDueAt.length > 0
              ? new Date(newExDueAt + "T23:59:59").toISOString()
              : undefined,
        },
      ),
    onSuccess: () => {
      refresh();
      setAddingExercise(false);
      setNewExTitle("");
      setNewExType("assignment");
      setNewExMaxScore("20");
      setNewExDueAt("");
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : "Erreur");
    },
  });

  const exercises: LessonExercise[] = lesson?.exercises ?? [];

  const goBack = useCallback(() => {
    navigate(`/teacher/courses/${courseId}/builder`);
  }, [navigate, courseId]);

  return (
    <div className="fixed inset-y-0 left-56 right-0 z-40 bg-white flex flex-col">
      {/* ── Top bar ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-white shrink-0">
        <Button variant="ghost" size="sm" onClick={goBack}>
          <ArrowLeft size={14} className="mr-1.5" />
          Retour
        </Button>
        <div className="h-5 w-px bg-slate-200" />
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
          }}
          placeholder="Titre de la lecon..."
          className="flex-1 text-lg font-semibold border-none bg-transparent text-slate-800 placeholder:text-slate-300 focus:outline-none"
        />
        <Button
          size="sm"
          disabled={saving || title.trim().length === 0}
          onClick={() => {
            void handleSave();
          }}
        >
          <Save size={13} className="mr-1.5" />
          {saving ? "Sauvegarde..." : "Enregistrer"}
        </Button>
      </div>

      {error.length > 0 && (
        <div className="px-4 py-2 bg-red-50 text-red-600 text-sm border-b border-red-100">
          {error}
        </div>
      )}

      {/* ── Main area ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editor panel */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Toolbar */}
          <div className="flex items-center gap-0.5 px-4 py-1.5 border-b border-slate-100 bg-slate-50/80 shrink-0">
            <ToolbarBtn
              icon={Bold}
              label="Gras (Ctrl+B)"
              onClick={() => {
                exec("bold");
              }}
            />
            <ToolbarBtn
              icon={Italic}
              label="Italique (Ctrl+I)"
              onClick={() => {
                exec("italic");
              }}
            />
            <div className="w-px h-5 bg-slate-200 mx-1" />
            <ToolbarBtn
              icon={Heading2}
              label="Titre 2"
              onClick={() => {
                exec("formatBlock", "h2");
              }}
            />
            <ToolbarBtn
              icon={Heading3}
              label="Titre 3"
              onClick={() => {
                exec("formatBlock", "h3");
              }}
            />
            <div className="w-px h-5 bg-slate-200 mx-1" />
            <ToolbarBtn
              icon={List}
              label="Liste a puces"
              onClick={() => {
                exec("insertUnorderedList");
              }}
            />
            <ToolbarBtn
              icon={ListOrdered}
              label="Liste numerotee"
              onClick={() => {
                exec("insertOrderedList");
              }}
            />
            <div className="w-px h-5 bg-slate-200 mx-1" />
            <ToolbarBtn
              icon={Minus}
              label="Separateur"
              onClick={() => {
                exec("insertHorizontalRule");
              }}
            />
            <div className="w-px h-5 bg-slate-200 mx-1" />
            <ToolbarBtn
              icon={ImageIcon}
              label="Inserer une image"
              onClick={() => {
                setMediaPopover(mediaPopover === "image" ? null : "image");
                setMediaUrl("");
              }}
            />
            <ToolbarBtn
              icon={Video}
              label="Inserer une video"
              onClick={() => {
                setMediaPopover(mediaPopover === "video" ? null : "video");
                setMediaUrl("");
              }}
            />
            <ToolbarBtn
              icon={Link2}
              label="Inserer un lien"
              onClick={() => {
                setMediaPopover(mediaPopover === "link" ? null : "link");
                setMediaUrl("");
              }}
            />
          </div>

          {/* Media URL input bar */}
          {mediaPopover !== null && (
            <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-100 bg-teal-50/60 shrink-0">
              <span className="text-xs font-medium text-slate-600 shrink-0">
                {mediaPopover === "image"
                  ? "URL image :"
                  : mediaPopover === "video"
                    ? "URL video :"
                    : "URL lien :"}
              </span>
              <input
                autoFocus
                value={mediaUrl}
                onChange={(e) => {
                  setMediaUrl(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    insertMedia();
                  }
                  if (e.key === "Escape") {
                    setMediaPopover(null);
                    setMediaUrl("");
                  }
                }}
                placeholder="https://..."
                className="flex-1 h-8 px-2 text-sm border border-slate-200 rounded bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
              <Button
                size="sm"
                disabled={mediaUrl.trim().length === 0}
                onClick={insertMedia}
              >
                Inserer
              </Button>
              <button
                onClick={() => {
                  setMediaPopover(null);
                  setMediaUrl("");
                }}
                className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Content editable area */}
          <div className="flex-1 overflow-auto">
            <div className="max-w-4xl mx-auto px-8 py-6">
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                className="min-h-[60vh] outline-none text-slate-800 leading-relaxed
                  [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:text-slate-900
                  [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:text-slate-800
                  [&_p]:mb-3 [&_p]:text-sm [&_p]:leading-relaxed
                  [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-3
                  [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-3
                  [&_li]:mb-1 [&_li]:text-sm
                  [&_hr]:my-6 [&_hr]:border-slate-200
                  [&_b]:font-bold [&_strong]:font-bold
                  [&_i]:italic [&_em]:italic
                  [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-md [&_img]:my-3
                  [&_a]:text-teal-600 [&_a]:underline [&_a]:underline-offset-2"
                data-placeholder="Commencez a rediger le contenu de la lecon..."
              />
            </div>
          </div>
        </div>

        {/* ── Right sidebar ───────────────────────────────────────────── */}
        <div className="w-80 shrink-0 overflow-auto border-l border-slate-200 bg-slate-50/50 p-5 space-y-6">
          {/* Settings */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Parametres
            </h3>
            <div className="space-y-3">
              <div>
                <Label htmlFor="ed-type" className="text-xs">
                  Type de contenu
                </Label>
                <select
                  id="ed-type"
                  value={contentType}
                  onChange={(e) => {
                    setContentType(e.target.value as LessonContentType);
                  }}
                  className="w-full h-9 px-2 mt-1 text-sm border border-slate-200 rounded bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  {CONTENT_TYPES.map((ct) => (
                    <option key={ct.value} value={ct.value}>
                      {ct.label}
                    </option>
                  ))}
                </select>
              </div>

              {(contentType === "video" ||
                contentType === "pdf" ||
                contentType === "audio") && (
                <div>
                  <Label htmlFor="ed-url" className="text-xs">
                    {contentType === "video"
                      ? "URL video"
                      : contentType === "pdf"
                        ? "URL PDF"
                        : "URL audio"}
                  </Label>
                  <Input
                    id="ed-url"
                    value={contentUrl}
                    onChange={(e) => {
                      setContentUrl(e.target.value);
                    }}
                    className="mt-1"
                    placeholder="https://..."
                  />
                </div>
              )}

              <div>
                <Label htmlFor="ed-dur" className="text-xs">
                  Duree (min)
                </Label>
                <Input
                  id="ed-dur"
                  type="number"
                  min="1"
                  value={durationMinutes}
                  onChange={(e) => {
                    setDurationMinutes(e.target.value);
                  }}
                  className="mt-1"
                  placeholder="ex. 15"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  id="ed-free"
                  type="checkbox"
                  checked={isFreePreview}
                  onChange={(e) => {
                    setIsFreePreview(e.target.checked);
                  }}
                  className="h-4 w-4 accent-teal-500"
                />
                <Label htmlFor="ed-free" className="text-xs cursor-pointer">
                  Apercu gratuit
                </Label>
              </div>
            </div>
          </div>

          {/* Exercises */}
          {!isNew && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <ClipboardList size={12} />
                  Exercices
                </h3>
                {!addingExercise && (
                  <button
                    onClick={() => {
                      setAddingExercise(true);
                    }}
                    className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium"
                  >
                    <Plus size={12} />
                    Ajouter
                  </button>
                )}
              </div>

              {/* Add exercise form */}
              {addingExercise && (
                <div className="bg-white border border-slate-200 rounded-lg p-3 mb-3 space-y-2">
                  <Input
                    placeholder="Titre de l'exercice"
                    value={newExTitle}
                    onChange={(e) => {
                      setNewExTitle(e.target.value);
                    }}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={newExType}
                      onChange={(e) => {
                        setNewExType(e.target.value);
                      }}
                      className="h-9 px-2 text-sm border border-slate-200 rounded bg-white text-slate-700"
                    >
                      {EXERCISE_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                    <Input
                      type="number"
                      placeholder="Note max"
                      value={newExMaxScore}
                      onChange={(e) => {
                        setNewExMaxScore(e.target.value);
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">
                      Echeance recommandee
                    </label>
                    <Input
                      type="date"
                      value={newExDueAt}
                      onChange={(e) => {
                        setNewExDueAt(e.target.value);
                      }}
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      disabled={
                        newExTitle.trim().length === 0 ||
                        addExerciseMutation.isPending
                      }
                      onClick={() => {
                        addExerciseMutation.mutate();
                      }}
                    >
                      {addExerciseMutation.isPending ? "Creation..." : "Creer"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setAddingExercise(false);
                      }}
                    >
                      Annuler
                    </Button>
                  </div>
                </div>
              )}

              {/* Exercise list */}
              {exercises.length === 0 && !addingExercise && (
                <p className="text-xs text-slate-400 text-center py-6">
                  Aucun exercice pour cette lecon.
                </p>
              )}
              <div className="space-y-2">
                {exercises.map((ex) => (
                  <ExerciseCard
                    key={ex.id}
                    exercise={ex}
                    courseId={courseId}
                    moduleId={moduleId}
                    lessonId={lessonId}
                    onRefresh={refresh}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
