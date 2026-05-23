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
} from "lucide-react";
import { api } from "@/lib/api.js";
import type {
  DocumentsResponse,
  DocumentResponse,
  StudentDocumentRow,
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

function DocRow({ doc }: { doc: StudentDocumentRow }) {
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
                  <p className="text-xs font-bold text-teal uppercase tracking-wider mb-1">
                    <MessageSquare size={11} className="inline mr-1" />
                    Retour du formateur
                  </p>
                  <p className="text-sm text-dark">
                    {detail.document.feedback}
                  </p>
                </div>
              )}
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
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState("");

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
        <h1 className="text-2xl font-bold text-dark">Mes documents</h1>
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
            className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${
              filter === s
                ? "bg-teal text-white"
                : "bg-cream text-meta hover:text-dark"
            }`}
          >
            {s === "" ? "Tous" : (STATUS_LABELS[s] ?? s)}
          </button>
        ))}
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
            <FileText size={32} className="text-meta/40 mx-auto mb-3" />
            <p className="text-meta text-sm">
              Aucun document. Cr&eacute;ez votre premier document !
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {docs.map((doc) => (
          <DocRow key={doc.id} doc={doc} />
        ))}
      </div>
    </div>
  );
}
