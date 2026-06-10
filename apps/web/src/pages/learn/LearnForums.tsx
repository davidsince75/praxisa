import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { MessageCircle, Plus, Pin, Lock, ChevronRight } from "lucide-react";
import { api } from "@/lib/api.js";
import type {
  ForumThreadsResponse,
  ForumThreadRow,
  CourseListResponse,
} from "@/lib/api.js";
import { Button } from "@/components/ui/button.js";
import { Input } from "@/components/ui/input.js";
import { Label } from "@/components/ui/label.js";
import { Badge } from "@/components/ui/badge.js";
import { Card, CardContent } from "@/components/ui/card.js";

function NewThreadForm({
  courseId,
  onDone,
}: {
  courseId: string;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () => api.post(`/courses/${courseId}/forums`, { title, body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["forum-threads", courseId] });
      onDone();
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : "Erreur");
    },
  });

  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <h3 className="text-sm font-semibold text-dark">Nouvelle discussion</h3>
        <div className="space-y-1.5">
          <Label htmlFor="ft-title">Titre</Label>
          <Input
            id="ft-title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
            }}
            placeholder="Votre question ou sujet de discussion"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ft-body">Message</Label>
          <textarea
            id="ft-body"
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
            }}
            rows={4}
            className="w-full rounded-md border border-rule px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-teal"
          />
        </div>
        {error.length > 0 && <p className="text-xs text-rose">{error}</p>}
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={
              mutation.isPending ||
              title.trim().length === 0 ||
              body.trim().length === 0
            }
            onClick={() => {
              mutation.mutate();
            }}
          >
            {mutation.isPending ? "Envoi…" : "Publier"}
          </Button>
          <Button size="sm" variant="ghost" onClick={onDone}>
            Annuler
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ThreadRow({
  thread,
  basePath,
}: {
  thread: ForumThreadRow;
  basePath: string;
}) {
  const roleLabel =
    thread.authorRole === "instructor"
      ? "Formateur"
      : thread.authorRole === "admin"
        ? "Admin"
        : "";

  return (
    <Link
      to={`${basePath}/forums/${thread.id}`}
      className="flex items-center gap-3 px-4 py-3 border border-rule rounded-lg hover:bg-cream/50 transition-colors"
    >
      <MessageCircle size={16} className="text-teal flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {thread.isPinned && (
            <Pin size={11} className="text-amber-500 flex-shrink-0" />
          )}
          {thread.isLocked && (
            <Lock size={11} className="text-meta flex-shrink-0" />
          )}
          <span className="text-sm font-semibold text-dark truncate">
            {thread.title}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-meta mt-0.5">
          <span>
            {thread.authorFirstName} {thread.authorLastName}
          </span>
          {roleLabel.length > 0 && <Badge variant="default">{roleLabel}</Badge>}
          <span>&middot;</span>
          <span>{new Date(thread.createdAt).toLocaleDateString("fr-FR")}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs text-meta">
          {String(thread.replyCount)} r&eacute;ponse
          {thread.replyCount !== 1 ? "s" : ""}
        </span>
        <ChevronRight size={14} className="text-meta" />
      </div>
    </Link>
  );
}

export function ForumsPage({ basePath }: { basePath: string }) {
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [creating, setCreating] = useState(false);

  // Fetch courses the user has access to
  const { data: coursesData } = useQuery<CourseListResponse>({
    queryKey: ["courses"],
    queryFn: () => api.get<CourseListResponse>("/courses"),
  });

  const courses = coursesData?.courses ?? [];

  const { data: threadsData, isLoading } = useQuery<ForumThreadsResponse>({
    queryKey: ["forum-threads", selectedCourseId],
    queryFn: () =>
      api.get<ForumThreadsResponse>(`/courses/${selectedCourseId}/forums`),
    enabled: selectedCourseId !== "",
  });

  const threads = threadsData?.threads ?? [];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-dark">Forum</h1>
        {selectedCourseId !== "" && (
          <Button
            size="sm"
            onClick={() => {
              setCreating(true);
            }}
          >
            <Plus size={14} className="mr-1.5" />
            Nouvelle discussion
          </Button>
        )}
      </div>

      <select
        value={selectedCourseId}
        onChange={(e) => {
          setSelectedCourseId(e.target.value);
          setCreating(false);
        }}
        className="w-full rounded-lg border border-rule bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
      >
        <option value="">Choisir un cours&hellip;</option>
        {courses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </select>

      {selectedCourseId === "" && (
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-rule text-meta">
          S&eacute;lectionnez un cours pour voir les discussions.
        </div>
      )}

      {creating && selectedCourseId !== "" && (
        <NewThreadForm
          courseId={selectedCourseId}
          onDone={() => {
            setCreating(false);
          }}
        />
      )}

      {selectedCourseId !== "" && isLoading && (
        <p className="text-sm text-meta">Chargement&hellip;</p>
      )}

      {selectedCourseId !== "" && !isLoading && threads.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <MessageCircle size={32} className="text-meta mx-auto mb-3" />
            <p className="text-meta text-sm">
              Aucune discussion pour ce cours. Lancez le d&eacute;bat !
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {threads.map((thread) => (
          <ThreadRow key={thread.id} thread={thread} basePath={basePath} />
        ))}
      </div>
    </div>
  );
}
