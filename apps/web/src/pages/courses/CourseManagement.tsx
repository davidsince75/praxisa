import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, BookOpen, Globe, Wrench } from "lucide-react";
import { api } from "@/lib/api.js";
import type {
  Course,
  CourseListResponse,
  UserListResponse,
} from "@/lib/api.js";
import { Button } from "@/components/ui/button.js";
import { Input } from "@/components/ui/input.js";
import { Label } from "@/components/ui/label.js";
import { Badge } from "@/components/ui/badge.js";
import { Card, CardContent } from "@/components/ui/card.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog.js";
import { formatDate } from "@/lib/utils.js";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CourseForm {
  title: string;
  slug: string;
  description: string;
  language: string;
  instructorId: string;
  status: "draft" | "published";
}

const STATUS_LABELS: Record<Course["status"], string> = {
  draft: "Brouillon",
  published: "Publié",
  archived: "Archivé",
};

function statusVariant(status: Course["status"]) {
  if (status === "published") return "completed" as const;
  if (status === "archived") return "rejected" as const;
  return "pending" as const;
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ── Course form dialog ────────────────────────────────────────────────────────

interface CourseDialogProps {
  mode: "create" | "edit";
  course?: Course;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
  instructors: { id: string; firstName: string; lastName: string }[];
}

function CourseDialog({
  mode,
  course,
  open,
  onOpenChange,
  onSuccess,
  instructors,
}: CourseDialogProps) {
  const [form, setForm] = useState<CourseForm>(() => ({
    title: course?.title ?? "",
    slug: course?.slug ?? "",
    description: course?.description ?? "",
    language: course?.language ?? "fr",
    instructorId: course?.instructorId ?? "",
    status: course?.status === "published" ? "published" : "draft",
  }));
  const [error, setError] = useState("");
  const isEdit = mode === "edit" && course !== undefined;

  const mutation = useMutation({
    mutationFn: (data: CourseForm) => {
      const body = {
        title: data.title,
        slug: data.slug,
        description: data.description.length > 0 ? data.description : undefined,
        language: data.language,
        instructorId:
          data.instructorId.length > 0 ? data.instructorId : undefined,
        ...(isEdit ? { status: data.status } : {}),
      };
      return isEdit
        ? api.patch(`/courses/${course.id}`, body)
        : api.post("/courses", body);
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
    mutation.mutate(form);
  }

  function handleTitleChange(title: string) {
    setForm((f) => ({
      ...f,
      title,
      slug:
        f.slug.length === 0 || f.slug === slugify(f.title)
          ? slugify(title)
          : f.slug,
    }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Modifier le cours" : "Nouveau cours"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cf-title">Titre</Label>
              <Input
                id="cf-title"
                value={form.title}
                onChange={(e) => {
                  handleTitleChange(e.target.value);
                }}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf-slug">Slug (URL)</Label>
              <Input
                id="cf-slug"
                value={form.slug}
                onChange={(e) => {
                  setForm((f) => ({ ...f, slug: e.target.value }));
                }}
                required
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf-description">Description</Label>
              <textarea
                id="cf-description"
                value={form.description}
                onChange={(e) => {
                  setForm((f) => ({ ...f, description: e.target.value }));
                }}
                rows={3}
                className="w-full px-3 py-2 text-sm border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cf-language">Langue</Label>
                <select
                  id="cf-language"
                  value={form.language}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, language: e.target.value }));
                  }}
                  className="w-full h-10 px-3 text-sm border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                </select>
              </div>
              {isEdit && (
                <div className="space-y-1.5">
                  <Label htmlFor="cf-status">Statut</Label>
                  <select
                    id="cf-status"
                    value={form.status}
                    onChange={(e) => {
                      setForm((f) => ({
                        ...f,
                        status: e.target.value as "draft" | "published",
                      }));
                    }}
                    className="w-full h-10 px-3 text-sm border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="draft">Brouillon</option>
                    <option value="published">Publié</option>
                  </select>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf-instructor">Formateur</Label>
              <select
                id="cf-instructor"
                value={form.instructorId}
                onChange={(e) => {
                  setForm((f) => ({ ...f, instructorId: e.target.value }));
                }}
                className="w-full h-10 px-3 text-sm border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">— Aucun —</option>
                {instructors.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.firstName} {i.lastName}
                  </option>
                ))}
              </select>
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
                ? isEdit
                  ? "Sauvegarde…"
                  : "Création…"
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

// ── Main page ─────────────────────────────────────────────────────────────────

export function CourseManagementPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editCourse, setEditCourse] = useState<Course | null>(null);
  const [deleteCourse, setDeleteCourse] = useState<Course | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/courses/${id}`),
    onSuccess: () => {
      invalidate();
      setDeleteCourse(null);
      setDeleteError("");
    },
    onError: (err: unknown) => {
      setDeleteError(err instanceof Error ? err.message : "Erreur");
    },
  });

  const { data: courseData, isLoading } = useQuery({
    queryKey: ["courses"],
    queryFn: () => api.get<CourseListResponse>("/courses"),
  });

  const { data: instructorData } = useQuery({
    queryKey: ["users", "", "instructor", 1],
    queryFn: () =>
      api.get<UserListResponse>("/users?role=instructor&limit=100"),
  });

  const courses = courseData?.courses ?? [];
  const instructors = instructorData?.users ?? [];

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["courses"] });
    void queryClient.invalidateQueries({ queryKey: ["analytics", "overview"] });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-dark">Cours</h1>
          <p className="text-meta text-sm mt-1">
            {isLoading ? "Chargement…" : `${String(courses.length)} cours`}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setCreateOpen(true);
          }}
        >
          <Plus size={14} className="mr-2" />
          Nouveau cours
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-meta text-sm p-6">Chargement…</p>
          ) : courses.length === 0 ? (
            <p className="text-meta text-sm p-6">Aucun cours trouvé.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-rule">
                    <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider text-meta">
                      Titre
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider text-meta">
                      Statut
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider text-meta">
                      Langue
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider text-meta">
                      Formateur
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider text-meta">
                      Publié le
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider text-meta">
                      Créé le
                    </th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule">
                  {courses.map((c) => {
                    const instructor = instructors.find(
                      (i) => i.id === c.instructorId,
                    );
                    return (
                      <tr
                        key={c.id}
                        className="hover:bg-cream/50 transition-colors"
                      >
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <BookOpen
                              size={13}
                              className="text-teal flex-shrink-0"
                            />
                            <div>
                              <p className="font-medium text-dark">{c.title}</p>
                              <p className="text-xs text-meta font-mono">
                                {c.slug}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <Badge variant={statusVariant(c.status)}>
                            {STATUS_LABELS[c.status]}
                          </Badge>
                        </td>
                        <td className="px-6 py-3">
                          <span className="flex items-center gap-1.5 text-meta text-xs">
                            <Globe size={12} />
                            {c.language.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-meta">
                          {instructor !== undefined
                            ? `${instructor.firstName} ${instructor.lastName}`
                            : "—"}
                        </td>
                        <td className="px-6 py-3 text-meta">
                          {c.publishedAt !== null
                            ? formatDate(c.publishedAt)
                            : "—"}
                        </td>
                        <td className="px-6 py-3 text-meta">
                          {formatDate(c.createdAt)}
                        </td>
                        <td className="px-6 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link to={`/courses/${c.id}/builder`}>
                              <button
                                className="text-meta hover:text-teal transition-colors"
                                aria-label="Editeur de modules"
                              >
                                <Wrench size={14} />
                              </button>
                            </Link>
                            <button
                              onClick={() => {
                                setEditCourse(c);
                              }}
                              className="text-meta hover:text-dark transition-colors"
                              aria-label="Modifier"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => {
                                setDeleteCourse(c);
                              }}
                              className="text-meta hover:text-rose transition-colors"
                              aria-label="Supprimer"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <CourseDialog
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={invalidate}
        instructors={instructors}
      />
      {editCourse !== null && (
        <CourseDialog
          mode="edit"
          course={editCourse}
          open
          onOpenChange={(v) => {
            if (!v) setEditCourse(null);
          }}
          onSuccess={invalidate}
          instructors={instructors}
        />
      )}

      {deleteCourse !== null && (
        <Dialog
          open
          onOpenChange={(v) => {
            if (!v) {
              setDeleteCourse(null);
              setDeleteError("");
            }
          }}
        >
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Supprimer le cours</DialogTitle>
            </DialogHeader>
            <div className="px-6 py-4 space-y-3">
              <p className="text-sm text-dark">
                Supprimer{" "}
                <span className="font-semibold">{deleteCourse.title}</span> ?
                Cette action est irréversible.
              </p>
              {deleteError.length > 0 && (
                <p className="text-xs text-rose">{deleteError}</p>
              )}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" size="sm">
                  Annuler
                </Button>
              </DialogClose>
              <Button
                variant="destructive"
                size="sm"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  deleteMutation.mutate(deleteCourse.id);
                }}
              >
                {deleteMutation.isPending ? "Suppression…" : "Supprimer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
