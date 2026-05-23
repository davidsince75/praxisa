import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  BookOpen,
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
  ModuleWithLessons,
  LessonItem,
  LessonExercise,
  LessonContentType,
} from "@/lib/api.js";
import { Button } from "@/components/ui/button.js";
import { Input } from "@/components/ui/input.js";
import { Label } from "@/components/ui/label.js";
import { Card, CardContent } from "@/components/ui/card.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog.js";

// ── Helpers ────────────────────────────────────────────────────────────────────

const CONTENT_TYPES: {
  value: LessonContentType;
  label: string;
  icon: LucideIcon;
}[] = [
  { value: "text", label: "Texte", icon: FileText },
  { value: "video", label: "Vidéo", icon: Video },
  { value: "pdf", label: "PDF", icon: File },
  { value: "audio", label: "Audio", icon: Music },
  { value: "quiz", label: "Quiz", icon: HelpCircle },
];

function contentIcon(type: LessonContentType) {
  const found = CONTENT_TYPES.find((ct) => ct.value === type);
  const Icon = found?.icon ?? FileText;
  return <Icon size={13} className="text-meta" />;
}

// ── Module modal ───────────────────────────────────────────────────────────────

interface ModuleModalProps {
  courseId: string;
  mod?: ModuleWithLessons;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}

function ModuleModal({
  courseId,
  mod,
  open,
  onOpenChange,
  onSuccess,
}: ModuleModalProps) {
  const isEdit = mod !== undefined;
  const [title, setTitle] = useState(mod?.title ?? "");
  const [description, setDescription] = useState(mod?.description ?? "");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () => {
      const body = {
        title,
        description: description.length > 0 ? description : undefined,
      };
      return isEdit
        ? api.patch(`/courses/${courseId}/modules/${mod.id}`, body)
        : api.post(`/courses/${courseId}/modules`, body);
    },
    onSuccess: () => {
      onSuccess();
      onOpenChange(false);
      if (!isEdit) {
        setTitle("");
        setDescription("");
      }
      setError("");
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : "Erreur");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Modifier le module" : "Nouveau module"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="mod-title">Titre du module</Label>
              <Input
                id="mod-title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                }}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mod-desc">Description (optionnel)</Label>
              <textarea
                id="mod-desc"
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                }}
                rows={2}
                className="w-full px-3 py-2 text-sm border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
            {error.length > 0 && <p className="text-xs text-rose">{error}</p>}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" size="sm">
                Annuler
              </Button>
            </DialogClose>
            <Button type="submit" size="sm" disabled={mutation.isPending}>
              {mutation.isPending
                ? "Sauvegarde…"
                : isEdit
                  ? "Enregistrer"
                  : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Lesson modal ───────────────────────────────────────────────────────────────

interface LessonModalProps {
  courseId: string;
  moduleId: string;
  lesson?: LessonItem;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}

interface LessonForm {
  title: string;
  description: string;
  contentType: LessonContentType;
  contentUrl: string;
  contentBody: string;
  durationMinutes: string;
  isFreePreview: boolean;
}

function LessonModal({
  courseId,
  moduleId,
  lesson,
  open,
  onOpenChange,
  onSuccess,
}: LessonModalProps) {
  const isEdit = lesson !== undefined;
  const [form, setForm] = useState<LessonForm>({
    title: lesson?.title ?? "",
    description: lesson?.description ?? "",
    contentType: lesson?.contentType ?? "text",
    contentUrl: lesson?.contentUrl ?? "",
    contentBody: lesson?.contentBody ?? "",
    durationMinutes:
      lesson?.durationMinutes !== null && lesson?.durationMinutes !== undefined
        ? String(lesson.durationMinutes)
        : "",
    isFreePreview: lesson?.isFreePreview ?? false,
  });
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () => {
      const dur =
        form.durationMinutes.length > 0
          ? Number(form.durationMinutes)
          : undefined;
      const body = {
        title: form.title,
        description: form.description.length > 0 ? form.description : undefined,
        contentType: form.contentType,
        contentUrl: form.contentUrl.length > 0 ? form.contentUrl : undefined,
        contentBody: form.contentBody.length > 0 ? form.contentBody : undefined,
        durationMinutes: dur,
        isFreePreview: form.isFreePreview,
      };
      return isEdit
        ? api.patch(
            `/courses/${courseId}/modules/${moduleId}/lessons/${lesson.id}`,
            body,
          )
        : api.post(`/courses/${courseId}/modules/${moduleId}/lessons`, body);
    },
    onSuccess: () => {
      onSuccess();
      onOpenChange(false);
      setError("");
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : "Erreur");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Modifier la leçon" : "Nouvelle leçon"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="les-title">Titre</Label>
              <Input
                id="les-title"
                value={form.title}
                onChange={(e) => {
                  setForm((f) => ({ ...f, title: e.target.value }));
                }}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="les-type">Type de contenu</Label>
                <select
                  id="les-type"
                  value={form.contentType}
                  onChange={(e) => {
                    setForm((f) => ({
                      ...f,
                      contentType: e.target.value as LessonContentType,
                    }));
                  }}
                  className="w-full h-10 px-3 text-sm border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {CONTENT_TYPES.map((ct) => (
                    <option key={ct.value} value={ct.value}>
                      {ct.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="les-duration">Durée (min)</Label>
                <Input
                  id="les-duration"
                  type="number"
                  min="1"
                  value={form.durationMinutes}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, durationMinutes: e.target.value }));
                  }}
                  placeholder="ex. 15"
                />
              </div>
            </div>

            {(form.contentType === "video" ||
              form.contentType === "pdf" ||
              form.contentType === "audio") && (
              <div className="space-y-1.5">
                <Label htmlFor="les-url">
                  {form.contentType === "video"
                    ? "URL de la vid\u00e9o"
                    : form.contentType === "pdf"
                      ? "URL du document PDF"
                      : "URL du fichier audio"}
                </Label>
                <Input
                  id="les-url"
                  value={form.contentUrl}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, contentUrl: e.target.value }));
                  }}
                  placeholder={
                    form.contentType === "video"
                      ? "https://www.youtube.com/watch?v=... ou lien Vimeo"
                      : form.contentType === "pdf"
                        ? "https://drive.google.com/file/d/... ou lien direct .pdf"
                        : "https://drive.google.com/file/d/... ou lien direct .mp3"
                  }
                />
                <p className="text-xs text-meta">
                  {form.contentType === "video"
                    ? "Collez un lien YouTube, Vimeo, ou tout lien vid\u00e9o public."
                    : form.contentType === "pdf"
                      ? "Collez un lien Google Drive (acc\u00e8s public), Dropbox, ou un lien direct vers le PDF."
                      : "Collez un lien Google Drive (acc\u00e8s public), Dropbox, ou un lien direct vers le fichier audio."}
                </p>
              </div>
            )}

            {form.contentType === "text" && (
              <div className="space-y-1.5">
                <Label htmlFor="les-body">Contenu texte</Label>
                <textarea
                  id="les-body"
                  value={form.contentBody}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, contentBody: e.target.value }));
                  }}
                  rows={4}
                  className="w-full px-3 py-2 text-sm border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  placeholder="Contenu de la leçon…"
                />
              </div>
            )}

            <div className="flex items-center gap-3">
              <input
                id="les-free"
                type="checkbox"
                checked={form.isFreePreview}
                onChange={(e) => {
                  setForm((f) => ({ ...f, isFreePreview: e.target.checked }));
                }}
                className="h-4 w-4 accent-teal"
              />
              <Label htmlFor="les-free" className="cursor-pointer">
                Aperçu gratuit
              </Label>
            </div>

            {error.length > 0 && <p className="text-xs text-rose">{error}</p>}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" size="sm">
                Annuler
              </Button>
            </DialogClose>
            <Button type="submit" size="sm" disabled={mutation.isPending}>
              {mutation.isPending
                ? "Sauvegarde…"
                : isEdit
                  ? "Enregistrer"
                  : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Delete confirm modal ───────────────────────────────────────────────────────

interface DeleteModalProps {
  label: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
}

function DeleteModal({
  label,
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: DeleteModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Supprimer «{label}»?</DialogTitle>
        </DialogHeader>
        <div className="px-6 py-4">
          <p className="text-sm text-meta">
            Cette action est irréversible. Toute la progression des apprenants
            associée sera perdue.
          </p>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" size="sm">
              Annuler
            </Button>
          </DialogClose>
          <Button
            size="sm"
            className="bg-rose hover:bg-rose/90 text-white"
            disabled={isPending}
            onClick={onConfirm}
          >
            {isPending ? "Suppression…" : "Supprimer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Exercise deadline row ─────────────────────────────────────────────────────

interface ExerciseDeadlineRowProps {
  courseId: string;
  moduleId: string;
  lessonId: string;
  exercise: LessonExercise;
  onRefresh: () => void;
}

function ExerciseDeadlineRow({
  courseId,
  moduleId,
  lessonId,
  exercise,
  onRefresh,
}: ExerciseDeadlineRowProps) {
  const deadlineMutation = useMutation({
    mutationFn: (dueAt: string | null) =>
      api.patch(
        `/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/exercises/${exercise.id}`,
        { dueAt },
      ),
    onSuccess: () => {
      onRefresh();
    },
  });

  const typeLabels: Record<string, string> = {
    quiz: "Quiz",
    assignment: "Devoir",
    reflection: "Réflexion",
  };

  const currentDate =
    exercise.dueAt !== null ? exercise.dueAt.slice(0, 10) : "";

  return (
    <div className="flex items-center gap-2 px-10 py-1.5 bg-cream/20">
      <span className="text-[10px] font-bold uppercase tracking-wider text-meta border border-rule px-1.5 py-0.5 rounded">
        {typeLabels[exercise.type] ?? exercise.type}
      </span>
      <span className="flex-1 text-xs text-dark truncate">
        {exercise.title}
      </span>
      <Calendar size={11} className="text-meta flex-shrink-0" />
      <input
        type="date"
        value={currentDate}
        onChange={(e) => {
          const val = e.target.value;
          const dueAt =
            val.length > 0 ? new Date(val + "T23:59:59").toISOString() : null;
          deadlineMutation.mutate(dueAt);
        }}
        className="text-xs border border-rule rounded px-1.5 py-0.5 w-32 bg-white text-dark focus:outline-none focus:ring-1 focus:ring-teal"
      />
      {exercise.dueAt !== null && (
        <button
          onClick={() => {
            deadlineMutation.mutate(null);
          }}
          className="text-[10px] text-meta hover:text-rose transition-colors"
          title="Supprimer l'échéance"
        >
          ✕
        </button>
      )}
    </div>
  );
}

// ── Module row ─────────────────────────────────────────────────────────────────

interface ModuleRowProps {
  courseId: string;
  mod: ModuleWithLessons;
  onRefresh: () => void;
}

function ModuleRow({ courseId, mod, onRefresh }: ModuleRowProps) {
  const [expanded, setExpanded] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addLessonOpen, setAddLessonOpen] = useState(false);
  const [editLesson, setEditLesson] = useState<LessonItem | null>(null);
  const [deleteLesson, setDeleteLesson] = useState<LessonItem | null>(null);

  const deleteMod = useMutation({
    mutationFn: () => api.delete(`/courses/${courseId}/modules/${mod.id}`),
    onSuccess: () => {
      onRefresh();
      setDeleteOpen(false);
    },
  });

  const deleteLes = useMutation({
    mutationFn: (lessonId: string) =>
      api.delete(`/courses/${courseId}/modules/${mod.id}/lessons/${lessonId}`),
    onSuccess: () => {
      onRefresh();
      setDeleteLesson(null);
    },
  });

  return (
    <div className="border border-rule rounded">
      {/* Module header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-white/50">
        <button
          onClick={() => {
            setExpanded((v) => !v);
          }}
          className="text-meta hover:text-dark transition-colors"
        >
          {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </button>
        <BookOpen size={14} className="text-teal flex-shrink-0" />
        <span className="flex-1 font-semibold text-sm text-dark truncate">
          {mod.title}
        </span>
        <span className="text-xs text-meta mr-2">
          {String(mod.lessons.length)} leçon
          {mod.lessons.length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={() => {
            setEditOpen(true);
          }}
          className="text-meta hover:text-dark transition-colors p-1"
        >
          <Pencil size={13} />
        </button>
        <button
          onClick={() => {
            setDeleteOpen(true);
          }}
          className="text-meta hover:text-rose transition-colors p-1"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Lessons */}
      {expanded && (
        <div className="border-t border-rule divide-y divide-rule">
          {mod.lessons.map((les) => (
            <div key={les.id}>
              <div className="flex items-center gap-2 px-6 py-2.5 hover:bg-cream/40 transition-colors">
                {contentIcon(les.contentType)}
                <span className="flex-1 text-sm text-dark truncate">
                  {les.title}
                </span>
                {les.exercises.length > 0 && (
                  <span className="text-[10px] text-meta mr-1">
                    {String(les.exercises.length)} exercice
                    {les.exercises.length !== 1 ? "s" : ""}
                  </span>
                )}
                {les.durationMinutes !== null && (
                  <span className="text-xs text-meta mr-2">
                    {String(les.durationMinutes)} min
                  </span>
                )}
                {les.isFreePreview && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-teal border border-teal/30 px-1.5 py-0.5 rounded mr-1">
                    Aperçu
                  </span>
                )}
                <button
                  onClick={() => {
                    setEditLesson(les);
                  }}
                  className="text-meta hover:text-dark transition-colors p-1"
                >
                  <Pencil size={12} />
                </button>
                <button
                  onClick={() => {
                    setDeleteLesson(les);
                  }}
                  className="text-meta hover:text-rose transition-colors p-1"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              {les.exercises.map((ex) => (
                <ExerciseDeadlineRow
                  key={ex.id}
                  courseId={courseId}
                  moduleId={mod.id}
                  lessonId={les.id}
                  exercise={ex}
                  onRefresh={onRefresh}
                />
              ))}
            </div>
          ))}
          <div className="px-6 py-2.5">
            <button
              onClick={() => {
                setAddLessonOpen(true);
              }}
              className="flex items-center gap-1.5 text-xs text-meta hover:text-teal transition-colors"
            >
              <Plus size={13} />
              Ajouter une leçon
            </button>
          </div>
        </div>
      )}

      {/* Module modals */}
      <ModuleModal
        courseId={courseId}
        mod={mod}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={onRefresh}
      />
      <DeleteModal
        label={mod.title}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() => {
          deleteMod.mutate();
        }}
        isPending={deleteMod.isPending}
      />

      {/* Add lesson modal */}
      <LessonModal
        courseId={courseId}
        moduleId={mod.id}
        open={addLessonOpen}
        onOpenChange={setAddLessonOpen}
        onSuccess={onRefresh}
      />

      {/* Edit lesson modal */}
      {editLesson !== null && (
        <LessonModal
          courseId={courseId}
          moduleId={mod.id}
          lesson={editLesson}
          open
          onOpenChange={(v) => {
            if (!v) setEditLesson(null);
          }}
          onSuccess={onRefresh}
        />
      )}

      {/* Delete lesson modal */}
      {deleteLesson !== null && (
        <DeleteModal
          label={deleteLesson.title}
          open
          onOpenChange={(v) => {
            if (!v) setDeleteLesson(null);
          }}
          onConfirm={() => {
            deleteLes.mutate(deleteLesson.id);
          }}
          isPending={deleteLes.isPending}
        />
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function TeacherCourseBuilderPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const id = courseId ?? "";
  const queryClient = useQueryClient();
  const [addModOpen, setAddModOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["course", id],
    queryFn: () => api.get<CourseDetailResponse>(`/courses/${id}`),
    enabled: id.length > 0,
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["course", id] });
  }

  const course = data?.course;
  const modules = course?.modules ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Link to={`/teacher/courses/${id}`}>
            <button className="mt-1 text-meta hover:text-dark transition-colors">
              <ArrowLeft size={18} />
            </button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-dark">
              {course?.title ?? "Chargement…"}
            </h1>
            <p className="text-meta text-sm mt-1">Éditeur de contenu</p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setAddModOpen(true);
          }}
        >
          <Plus size={13} className="mr-1.5" />
          Nouveau module
        </Button>
      </div>

      {/* Summary */}
      {course !== undefined && (
        <div className="flex items-center gap-4 text-xs text-meta">
          <span>
            <span className="font-bold text-dark">
              {String(modules.length)}
            </span>{" "}
            module{modules.length !== 1 ? "s" : ""}
          </span>
          <span>·</span>
          <span>
            <span className="font-bold text-dark">
              {String(modules.reduce((n, m) => n + m.lessons.length, 0))}
            </span>{" "}
            leçons au total
          </span>
        </div>
      )}

      {/* Tree */}
      {isLoading ? (
        <p className="text-meta text-sm">Chargement…</p>
      ) : modules.length === 0 ? (
        <Card>
          <CardContent className="p-12 flex flex-col items-center text-center gap-3">
            <BookOpen size={32} className="text-meta/40" />
            <p className="text-meta text-sm">
              Aucun module pour l&apos;instant. Cliquez sur «Nouveau module»
              pour commencer.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {modules.map((mod) => (
            <ModuleRow
              key={mod.id}
              courseId={id}
              mod={mod}
              onRefresh={refresh}
            />
          ))}
        </div>
      )}

      <ModuleModal
        courseId={id}
        open={addModOpen}
        onOpenChange={setAddModOpen}
        onSuccess={refresh}
      />
    </div>
  );
}
