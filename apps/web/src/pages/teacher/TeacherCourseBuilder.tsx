import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
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

// ── Delete confirm modal ───────────────────────────────────────────────────────

interface DeleteModalProps {
  label: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
  error?: string;
}

function DeleteModal({
  label,
  open,
  onOpenChange,
  onConfirm,
  isPending,
  error,
}: DeleteModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Supprimer «{label}»?</DialogTitle>
        </DialogHeader>
        <div className="px-6 py-4 space-y-2">
          <p className="text-sm text-meta">
            Cette action est irréversible. Toute la progression des apprenants
            associée sera perdue.
          </p>
          {error !== undefined && error.length > 0 && (
            <p className="text-xs text-rose">{error}</p>
          )}
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
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLesson, setDeleteLesson] = useState<LessonItem | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const deleteMod = useMutation({
    mutationFn: () => api.delete(`/courses/${courseId}/modules/${mod.id}`),
    onSuccess: () => {
      onRefresh();
      setDeleteOpen(false);
      setDeleteError("");
    },
    onError: (err: unknown) => {
      setDeleteError(
        err instanceof Error ? err.message : "Erreur de suppression",
      );
    },
  });

  const deleteLes = useMutation({
    mutationFn: (lessonId: string) =>
      api.delete(`/courses/${courseId}/modules/${mod.id}/lessons/${lessonId}`),
    onSuccess: () => {
      onRefresh();
      setDeleteLesson(null);
      setDeleteError("");
    },
    onError: (err: unknown) => {
      setDeleteError(
        err instanceof Error ? err.message : "Erreur de suppression",
      );
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
                    navigate(
                      `/teacher/courses/${courseId}/modules/${mod.id}/lessons/${les.id}`,
                    );
                  }}
                  className="text-meta hover:text-dark transition-colors p-1"
                  title="Ouvrir l'editeur"
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
                navigate(
                  `/teacher/courses/${courseId}/modules/${mod.id}/lessons/new`,
                );
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
        onOpenChange={(v) => {
          setDeleteOpen(v);
          if (!v) setDeleteError("");
        }}
        onConfirm={() => {
          deleteMod.mutate();
        }}
        isPending={deleteMod.isPending}
        error={deleteError}
      />

      {/* Delete lesson modal */}
      {deleteLesson !== null && (
        <DeleteModal
          label={deleteLesson.title}
          open
          onOpenChange={(v) => {
            if (!v) {
              setDeleteLesson(null);
              setDeleteError("");
            }
          }}
          onConfirm={() => {
            deleteLes.mutate(deleteLesson.id);
          }}
          isPending={deleteLes.isPending}
          error={deleteError}
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
