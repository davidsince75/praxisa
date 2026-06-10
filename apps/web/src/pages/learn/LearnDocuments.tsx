import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Plus,
  Send,
  Trash2,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Tag,
  X,
} from "lucide-react";
import { api } from "@/lib/api.js";
import type {
  DocumentsResponse,
  DocumentResponse,
  StudentDocumentRow,
  TagRow,
  TagsResponse,
} from "@/lib/api.js";
import { Button } from "@/components/ui/button.js";
import { Input } from "@/components/ui/input.js";
import { Label } from "@/components/ui/label.js";
import { Badge } from "@/components/ui/badge.js";
import { Card, CardContent } from "@/components/ui/card.js";

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  published: "Soumis",
  evaluated: "Évalué",
};

const STATUS_VARIANTS: Record<string, "pending" | "in_progress" | "completed"> =
  {
    draft: "pending",
    published: "in_progress",
    evaluated: "completed",
  };

function CreateDocForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () => api.post("/documents", { title, body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["my-documents"] });
      onDone();
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : "Erreur");
    },
  });

  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <h3 className="text-sm font-semibold text-dark">Nouveau document</h3>
        <div className="space-y-1.5">
          <Label htmlFor="doc-title">Titre</Label>
          <Input
            id="doc-title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
            }}
            placeholder="Ex: Notes du cours — Module 1"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="doc-body">Contenu</Label>
          <textarea
            id="doc-body"
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
            }}
            rows={6}
            className="w-full rounded-md border border-rule px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-teal"
            placeholder="Écrivez vos notes ici…"
          />
        </div>
        {error.length > 0 && <p className="text-xs text-rose">{error}</p>}
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={mutation.isPending || title.trim().length === 0}
            onClick={() => {
              mutation.mutate();
            }}
          >
            {mutation.isPending ? "Création…" : "Créer"}
          </Button>
          <Button size="sm" variant="ghost" onClick={onDone}>
            Annuler
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface DocTagChipsProps {
  documentId: string;
  allTags: TagRow[];
}

function DocTagChips({ documentId, allTags }: DocTagChipsProps) {
  const qc = useQueryClient();

  const { data } = useQuery<TagsResponse>({
    queryKey: ["doc-tags", documentId],
    queryFn: () => api.get<TagsResponse>(`/documents/${documentId}/tags`),
  });

  const addMutation = useMutation({
    mutationFn: (tagId: string) =>
      api.post(`/documents/${documentId}/tags`, { tagId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["doc-tags", documentId] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (tagId: string) =>
      api.delete(`/documents/${documentId}/tags/${tagId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["doc-tags", documentId] });
    },
  });

  const docTags = data?.tags ?? [];
  const docTagIds = new Set(docTags.map((t) => t.id));
  const available = allTags.filter((t) => !docTagIds.has(t.id));

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-meta uppercase tracking-wider">
        <Tag size={10} className="inline mr-1" />
        Tags
      </p>
      <div className="flex flex-wrap gap-1.5">
        {docTags.map((t) => (
          <span
            key={t.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: t.color }}
          >
            {t.name}
            <button
              type="button"
              onClick={() => {
                removeMutation.mutate(t.id);
              }}
              className="hover:opacity-70"
            >
              <X size={10} />
            </button>
          </span>
        ))}
        {available.length > 0 && (
          <select
            className="h-6 px-1.5 text-xs border border-rule rounded bg-white text-meta"
            value=""
            onChange={(e) => {
              if (e.target.value !== "") {
                addMutation.mutate(e.target.value);
              }
            }}
          >
            <option value="">+ Ajouter</option>
            {available.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}

function DocRow({
  doc,
  allTags,
}: {
  doc: StudentDocumentRow;
  allTags: TagRow[];
}) {
  const [expanded, setExpanded] = useState(false);
  const qc = useQueryClient();

  const { data: detail } = useQuery<DocumentResponse>({
    queryKey: ["document-detail", doc.id],
    queryFn: () => api.get<DocumentResponse>(`/documents/${doc.id}`),
    enabled: expanded,
  });

  const publishMutation = useMutation({
    mutationFn: () => api.post(`/documents/${doc.id}/publish`, {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["my-documents"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/documents/${doc.id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["my-documents"] });
    },
  });

  return (
    <div className="border border-rule rounded-lg overflow-hidden">
      <button
        onClick={() => {
          setExpanded((prev) => !prev);
        }}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-cream/50 transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown size={14} className="text-meta" />
        ) : (
          <ChevronRight size={14} className="text-meta" />
        )}
        <FileText size={14} className="text-teal" />
        <span className="flex-1 text-sm font-semibold text-dark truncate">
          {doc.title}
        </span>
        <Badge variant={STATUS_VARIANTS[doc.status] ?? "default"}>
          {STATUS_LABELS[doc.status] ?? doc.status}
        </Badge>
        {doc.score !== null && (
          <span className="text-xs font-semibold text-teal">
            {String(doc.score)} pts
          </span>
        )}
        <span className="text-xs text-meta">
          {new Date(doc.updatedAt).toLocaleDateString("fr-FR")}
        </span>
      </button>
      {expanded && (
        <div className="border-t border-rule px-4 py-3 space-y-3">
          {detail === undefined ? (
            <p className="text-sm text-meta">Chargement&hellip;</p>
          ) : (
            <>
              <p className="text-sm text-dark whitespace-pre-wrap">
                {detail.document.body || "(document vide)"}
              </p>
              {detail.document.feedback !== null && (
                <div className="bg-teal/5 rounded-lg px-4 py-3">
                  <p className="text-xs font-semibold text-teal uppercase tracking-wider mb-1">
                    <MessageSquare size={11} className="inline mr-1" />
                    Retour du formateur
                  </p>
                  <p className="text-sm text-dark">
                    {detail.document.feedback}
                  </p>
                </div>
              )}
              <DocTagChips documentId={doc.id} allTags={allTags} />
              {doc.status === "draft" && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={publishMutation.isPending}
                    onClick={() => {
                      publishMutation.mutate();
                    }}
                  >
                    <Send size={13} className="mr-1.5" />
                    Soumettre pour &eacute;valuation
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-rose"
                    disabled={deleteMutation.isPending}
                    onClick={() => {
                      deleteMutation.mutate();
                    }}
                  >
                    <Trash2 size={13} className="mr-1.5" />
                    Supprimer
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function LearnDocumentsPage() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState("");
  const [newTagName, setNewTagName] = useState("");

  const { data: tagsData } = useQuery<TagsResponse>({
    queryKey: ["my-tags"],
    queryFn: () => api.get<TagsResponse>("/tags"),
  });

  const createTagMutation = useMutation({
    mutationFn: (name: string) => api.post("/tags", { name }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["my-tags"] });
      setNewTagName("");
    },
  });

  const deleteTagMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/tags/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["my-tags"] });
    },
  });

  const allTags = tagsData?.tags ?? [];

  const { data, isLoading } = useQuery<DocumentsResponse>({
    queryKey: ["my-documents", filter],
    queryFn: () =>
      api.get<DocumentsResponse>(
        `/documents${filter ? `?status=${filter}` : ""}`,
      ),
  });

  const docs = data?.documents ?? [];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-dark">Mes documents</h1>
        <Button
          size="sm"
          onClick={() => {
            setCreating(true);
          }}
        >
          <Plus size={14} className="mr-1.5" />
          Nouveau document
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {["", "draft", "published", "evaluated"].map((s) => (
          <button
            key={s}
            onClick={() => {
              setFilter(s);
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-colors ${
              filter === s
                ? "bg-teal text-white"
                : "bg-cream text-meta hover:text-dark"
            }`}
          >
            {s === "" ? "Tous" : (STATUS_LABELS[s] ?? s)}
          </button>
        ))}
      </div>

      {/* Tags */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-meta uppercase tracking-wider mr-1">
            <Tag size={10} className="inline mr-0.5" />
            Mes tags :
          </span>
          {allTags.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: t.color }}
            >
              {t.name}
              <button
                type="button"
                onClick={() => {
                  deleteTagMutation.mutate(t.id);
                }}
                className="hover:opacity-70"
              >
                <X size={9} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Create tag */}
      <div className="flex items-center gap-2">
        <input
          value={newTagName}
          onChange={(e) => {
            setNewTagName(e.target.value);
          }}
          placeholder="Nouveau tag…"
          className="h-8 w-40 px-2 text-xs border border-rule rounded bg-white focus:outline-none focus:ring-1 focus:ring-teal"
          onKeyDown={(e) => {
            if (e.key === "Enter" && newTagName.trim().length > 0) {
              createTagMutation.mutate(newTagName.trim());
            }
          }}
        />
        <button
          type="button"
          disabled={
            createTagMutation.isPending || newTagName.trim().length === 0
          }
          onClick={() => {
            createTagMutation.mutate(newTagName.trim());
          }}
          className="h-8 px-3 text-xs font-semibold uppercase tracking-wider rounded bg-teal/10 text-teal hover:bg-teal/20 disabled:opacity-40 transition-colors"
        >
          {createTagMutation.isPending ? "…" : "+ Tag"}
        </button>
      </div>

      {creating && (
        <CreateDocForm
          onDone={() => {
            setCreating(false);
          }}
        />
      )}

      {isLoading && <p className="text-sm text-meta">Chargement&hellip;</p>}

      {!isLoading && docs.length === 0 && !creating && (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText size={32} className="text-meta mx-auto mb-3" />
            <p className="text-meta text-sm">
              Aucun document. Cr&eacute;ez votre premier document !
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {docs.map((doc) => (
          <DocRow key={doc.id} doc={doc} allTags={allTags} />
        ))}
      </div>
    </div>
  );
}
