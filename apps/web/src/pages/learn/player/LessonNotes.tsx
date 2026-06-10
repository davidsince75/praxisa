import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { StickyNote } from "lucide-react";
import { api } from "@/lib/api.js";
import type { DocumentsResponse, StudentDocumentRow } from "@/lib/api.js";

// ── Lesson notes ────────────────────────────────────────────────────────────────

interface LessonNotesProps {
  courseId: string;
  moduleId: string;
  lessonId: string;
  lessonTitle: string;
}

export function LessonNotes({
  courseId,
  moduleId,
  lessonId,
  lessonTitle,
}: LessonNotesProps) {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");

  const notesKey = ["lesson-notes", lessonId];

  const { data } = useQuery<DocumentsResponse>({
    queryKey: notesKey,
    queryFn: () =>
      api.get<DocumentsResponse>(`/documents?lessonId=${lessonId}`),
  });

  useEffect(() => {
    setCreating(false);
    setTitle(`Notes — ${lessonTitle}`);
    setBody("");
    setError("");
  }, [lessonId, lessonTitle]);

  const createMutation = useMutation({
    mutationFn: () =>
      api.post("/documents", {
        title: title.trim(),
        body,
        courseId,
        moduleId,
        lessonId,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notesKey });
      void queryClient.invalidateQueries({ queryKey: ["my-documents"] });
      setCreating(false);
      setTitle(`Notes — ${lessonTitle}`);
      setBody("");
      setError("");
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : "Erreur");
    },
  });

  const notes = data?.documents ?? [];

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 bg-cream/40 border-b border-rule">
        <span className="flex items-center gap-2 text-sm font-semibold text-dark">
          <StickyNote size={14} className="text-teal" />
          Mes documents / notes ({String(notes.length)})
        </span>
        {!creating && (
          <button
            type="button"
            onClick={() => {
              setCreating(true);
            }}
            className="text-[11px] font-bold uppercase tracking-wider text-teal hover:text-teal/70 transition-colors"
          >
            + Nouvelle note
          </button>
        )}
      </div>

      {creating && (
        <div className="px-5 py-4 space-y-3 border-b border-rule">
          <div className="space-y-1.5">
            <label
              htmlFor="note-title"
              className="text-xs font-medium text-meta"
            >
              Titre
            </label>
            <input
              id="note-title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
              }}
              className="w-full h-9 px-3 text-sm border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="note-body"
              className="text-xs font-medium text-meta"
            >
              Contenu
            </label>
            <textarea
              id="note-body"
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
              }}
              rows={4}
              className="w-full px-3 py-2 text-sm border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              placeholder="Écrivez vos notes ici…"
            />
          </div>
          {error.length > 0 && <p className="text-xs text-rose">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={createMutation.isPending || title.trim().length === 0}
              onClick={() => {
                createMutation.mutate();
              }}
              className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded bg-teal text-white hover:bg-teal/90 disabled:opacity-40 transition-colors"
            >
              {createMutation.isPending ? "Création…" : "Enregistrer"}
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
              }}
              className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded text-meta hover:text-dark transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {notes.length === 0 && !creating && (
        <p className="px-5 py-4 text-xs text-meta italic">
          Aucune note pour cette leçon.
        </p>
      )}

      {notes.length > 0 && (
        <div className="divide-y divide-rule">
          {notes.map((note) => (
            <NoteRow key={note.id} note={note} />
          ))}
        </div>
      )}
    </div>
  );
}

export function NoteRow({ note }: { note: StudentDocumentRow }) {
  return (
    <div className="px-5 py-3 hover:bg-cream/30 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-dark">{note.title}</span>
        <span className="text-[10px] text-meta">
          {new Date(note.updatedAt).toLocaleDateString("fr-FR")}
        </span>
      </div>
    </div>
  );
}
