import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api.js";
import type {
  CourseDocumentItem,
  CourseDocumentsResponse,
  UploadFileResponse,
} from "@/lib/api.js";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { FileText, Loader2, Trash2, Upload } from "lucide-react";

interface CourseDocumentsCardProps {
  courseId: string;
}

const STAGE_LABELS: Record<string, string> = {
  extraction: "Extraction du texte…",
  plan: "Analyse du plan…",
  indexation: "Indexation…",
};

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  }
  return `${String(Math.max(1, Math.round(bytes / 1024)))} Ko`;
}

function StatusBadge({ doc }: { doc: CourseDocumentItem }) {
  const { ingest } = doc;
  if (ingest.status === "ready") {
    return (
      <Badge variant="completed">
        Indexé — {String(ingest.pageCount ?? "?")} p. ·{" "}
        {String(ingest.chunkCount ?? "?")} extraits
      </Badge>
    );
  }
  if (ingest.status === "processing") {
    return (
      <Badge variant="in_progress">
        <Loader2 size={11} className="animate-spin mr-1" />
        {STAGE_LABELS[ingest.stage ?? ""] ?? "Préparation…"}
      </Badge>
    );
  }
  if (ingest.status === "failed") {
    return (
      <Badge variant="destructive" title={ingest.error ?? undefined}>
        Échec de la préparation
      </Badge>
    );
  }
  return <Badge variant="pending">Non préparé</Badge>;
}

/**
 * Reference documents of a course: upload several PDFs, watch their AI
 * preparation status (extraction → plan → indexation), and manage them.
 * These documents feed the "Structure IA" dialog and lesson drafting.
 */
export function CourseDocumentsCard({ courseId }: CourseDocumentsCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [busyDocId, setBusyDocId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const documentsQuery = useQuery<CourseDocumentsResponse>({
    queryKey: ["course-documents", courseId],
    queryFn: () =>
      api.get<CourseDocumentsResponse>(`/courses/${courseId}/documents`),
    refetchInterval: (query) =>
      (query.state.data?.documents ?? []).some(
        (d) => d.ingest.status === "processing",
      )
        ? 3000
        : false,
  });
  const documents = documentsQuery.data?.documents ?? [];

  async function refresh(): Promise<void> {
    await queryClient.invalidateQueries({
      queryKey: ["course-documents", courseId],
    });
  }

  async function handleFile(file: File): Promise<void> {
    if (file.type !== "application/pdf") {
      setError("Seuls les fichiers PDF sont acceptés.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError("Fichier trop volumineux (max 50 Mo).");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const uploaded = await api.upload<UploadFileResponse>("/files", file);
      await api.post(`/courses/${courseId}/documents`, {
        fileId: uploaded.file.id,
      });
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur d'upload");
    } finally {
      setUploading(false);
    }
  }

  async function handlePrepare(doc: CourseDocumentItem): Promise<void> {
    setBusyDocId(doc.id);
    setError("");
    try {
      await api.post(`/ai/documents/${doc.fileId}/ingest`, {});
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur de préparation");
    } finally {
      setBusyDocId(null);
    }
  }

  async function handleRemove(doc: CourseDocumentItem): Promise<void> {
    setBusyDocId(doc.id);
    setError("");
    try {
      await api.delete(`/courses/${courseId}/documents/${doc.id}`);
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur de suppression");
    } finally {
      setBusyDocId(null);
    }
  }

  return (
    <div className="border border-rule rounded bg-white/60 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-meta">
          Documents de référence (IA)
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f !== undefined) {
              void handleFile(f);
            }
            e.target.value = "";
          }}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            inputRef.current?.click();
          }}
          disabled={uploading}
        >
          <Upload size={13} className="mr-1.5" />
          {uploading ? "Upload en cours…" : "Ajouter un PDF"}
        </Button>
      </div>

      {documents.length === 0 ? (
        <p className="text-xs text-meta">
          Ajoutez un ou plusieurs PDF (manuels, supports de cours). Une fois
          préparés, ils servent de source à la génération de structure et de
          contenu.
        </p>
      ) : (
        <ul className="space-y-2">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex flex-wrap items-center gap-2 rounded border border-border bg-white p-2"
            >
              <FileText size={14} className="text-teal flex-shrink-0" />
              <span className="flex-1 min-w-40 text-xs text-dark truncate">
                {doc.title}{" "}
                <span className="text-meta">({formatSize(doc.size)})</span>
              </span>
              <StatusBadge doc={doc} />
              {(doc.ingest.status === "none" ||
                doc.ingest.status === "failed") && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void handlePrepare(doc);
                  }}
                  disabled={busyDocId === doc.id}
                >
                  {doc.ingest.status === "failed" ? "Relancer" : "Préparer"}
                </Button>
              )}
              <a
                href={`/v1/files/${doc.fileId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold uppercase tracking-wider text-meta hover:text-dark transition-colors"
              >
                Ouvrir ↗
              </a>
              <button
                type="button"
                aria-label={`Retirer le document ${doc.title}`}
                onClick={() => {
                  void handleRemove(doc);
                }}
                disabled={busyDocId === doc.id}
                className="p-2 text-meta hover:text-rose transition-colors disabled:opacity-40"
              >
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {error.length > 0 && <p className="text-xs text-rose">{error}</p>}
    </div>
  );
}
