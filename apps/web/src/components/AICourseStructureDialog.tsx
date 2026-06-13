import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api.js";
import type {
  AICourseStructureResponse,
  CourseDocumentItem,
  CourseDocumentsResponse,
} from "@/lib/api.js";
import { Button } from "@/components/ui/button.js";
import { Input } from "@/components/ui/input.js";
import { Label } from "@/components/ui/label.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog.js";
import { Sparkles, BookOpen, FileText, Loader2 } from "lucide-react";

interface AICourseStructureDialogProps {
  courseId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}

const STAGE_LABELS: Record<string, string> = {
  extraction: "Extraction du texte…",
  plan: "Analyse du plan du document…",
  indexation: "Indexation des contenus…",
};

export function AICourseStructureDialog({
  courseId,
  open,
  onOpenChange,
  onSuccess,
}: AICourseStructureDialogProps) {
  const [source, setSource] = useState<"pdf" | "description">("description");
  const [selectedFileId, setSelectedFileId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [moduleCount, setModuleCount] = useState("5");
  const [suggestions, setSuggestions] = useState<
    AICourseStructureResponse["modules"] | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState("");

  const documentsQuery = useQuery<CourseDocumentsResponse>({
    queryKey: ["course-documents", courseId],
    queryFn: () =>
      api.get<CourseDocumentsResponse>(`/courses/${courseId}/documents`),
    enabled: open,
    refetchInterval: (query) =>
      (query.state.data?.documents ?? []).some(
        (d) => d.ingest.status === "processing",
      )
        ? 2500
        : false,
  });
  const documents = documentsQuery.data?.documents ?? [];
  const hasDocuments = documents.length > 0;
  const selectedDoc: CourseDocumentItem | undefined = documents.find(
    (d) => d.fileId === selectedFileId,
  );

  // Initialize defaults once per dialog opening (not on every status poll —
  // that would override a manual switch to the description source): PDF mode
  // when documents exist, preselecting the first ready document.
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!open) {
      initializedRef.current = false;
      return;
    }
    if (initializedRef.current || documentsQuery.isLoading) return;
    initializedRef.current = true;
    if (hasDocuments) {
      setSource("pdf");
      const ready = documents.find((d) => d.ingest.status === "ready");
      setSelectedFileId(
        ready !== undefined ? ready.fileId : documents[0].fileId,
      );
    } else {
      setSource("description");
    }
  }, [open, hasDocuments, documents, documentsQuery.isLoading]);

  async function handlePrepare(): Promise<void> {
    if (selectedDoc === undefined) return;
    setPreparing(true);
    setError("");
    try {
      await api.post(`/ai/documents/${selectedDoc.fileId}/ingest`, {});
      await documentsQuery.refetch();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur de préparation");
    } finally {
      setPreparing(false);
    }
  }

  async function handleGenerate(): Promise<void> {
    const usePdf = source === "pdf" && selectedDoc !== undefined;
    if (!usePdf && description.trim().length < 10) return;
    setLoading(true);
    setError("");
    setSuggestions(null);
    try {
      const rawCount = Number(moduleCount);
      const count = Number.isFinite(rawCount)
        ? Math.min(99, Math.max(2, Math.round(rawCount)))
        : 5;
      const body = usePdf
        ? { fileId: selectedDoc.fileId, moduleCount: count }
        : { description: description.trim(), moduleCount: count };
      const res = await api.post<AICourseStructureResponse>(
        "/ai/course-structure",
        body,
      );
      setSuggestions(res.modules);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur IA");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(): Promise<void> {
    if (suggestions === null) return;
    setCreating(true);
    setError("");
    try {
      // Explicit positions keep large structures (up to 99 modules) ordered.
      for (const [index, mod] of suggestions.entries()) {
        await api.post("/courses/" + courseId + "/modules", {
          title: mod.title,
          description: mod.description,
          position: index,
        });
      }
      onSuccess();
      onOpenChange(false);
      setDescription("");
      setSuggestions(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur création");
    } finally {
      setCreating(false);
    }
  }

  function handleClose(v: boolean): void {
    onOpenChange(v);
    if (!v) {
      setDescription("");
      setSuggestions(null);
      setError("");
    }
  }

  const generateDisabled =
    loading ||
    (source === "pdf"
      ? selectedDoc?.ingest.status !== "ready"
      : description.trim().length < 10);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles size={18} className="text-teal" />
            Structurer le cours avec l&apos;IA
          </DialogTitle>
        </DialogHeader>

        {suggestions === null ? (
          <div className="px-6 py-4 space-y-4">
            {hasDocuments && (
              <fieldset className="space-y-1">
                <legend className="text-sm font-semibold uppercase tracking-wider text-meta mb-1">
                  Source
                </legend>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm py-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="ai-source"
                      value="pdf"
                      checked={source === "pdf"}
                      onChange={() => {
                        setSource("pdf");
                      }}
                      className="h-4 w-4 accent-teal"
                    />
                    Document du cours
                  </label>
                  <label className="flex items-center gap-2 text-sm py-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="ai-source"
                      value="description"
                      checked={source === "description"}
                      onChange={() => {
                        setSource("description");
                      }}
                      className="h-4 w-4 accent-teal"
                    />
                    Description manuelle
                  </label>
                </div>
              </fieldset>
            )}

            {source === "pdf" && hasDocuments ? (
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label htmlFor="ai-document">Document source</Label>
                  <select
                    id="ai-document"
                    className="w-full h-11 border border-input bg-background px-3 text-sm transition-colors duration-200 hover:border-mid focus:border-teal"
                    value={selectedFileId}
                    onChange={(e) => {
                      setSelectedFileId(e.target.value);
                    }}
                  >
                    {documents.map((doc) => (
                      <option key={doc.id} value={doc.fileId}>
                        {doc.title}
                        {doc.ingest.status === "ready"
                          ? " — indexé"
                          : doc.ingest.status === "processing"
                            ? " — préparation en cours"
                            : doc.ingest.status === "failed"
                              ? " — échec"
                              : " — non préparé"}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rounded-md border border-border p-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <FileText size={14} className="text-teal" />
                    {selectedDoc === undefined ? (
                      <span className="text-meta">
                        Sélectionnez un document.
                      </span>
                    ) : selectedDoc.ingest.status === "ready" ? (
                      <span>
                        Document indexé —{" "}
                        {String(selectedDoc.ingest.pageCount ?? "?")} pages,{" "}
                        {String(selectedDoc.ingest.chunkCount ?? "?")} extraits.
                      </span>
                    ) : selectedDoc.ingest.status === "processing" ? (
                      <span className="flex items-center gap-2 text-meta">
                        <Loader2 size={13} className="animate-spin" />
                        {STAGE_LABELS[selectedDoc.ingest.stage ?? ""] ??
                          "Préparation en cours…"}
                      </span>
                    ) : selectedDoc.ingest.status === "failed" ? (
                      <span className="text-destructive">
                        Échec de la préparation
                        {typeof selectedDoc.ingest.error === "string"
                          ? ` : ${selectedDoc.ingest.error}`
                          : ""}
                      </span>
                    ) : (
                      <span className="text-meta">
                        Ce document doit d&apos;abord être préparé (analyse du
                        plan et indexation).
                      </span>
                    )}
                  </div>
                  {(selectedDoc?.ingest.status === "none" ||
                    selectedDoc?.ingest.status === "failed") && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        void handlePrepare();
                      }}
                      disabled={preparing}
                    >
                      {preparing
                        ? "Lancement…"
                        : selectedDoc.ingest.status === "failed"
                          ? "Relancer la préparation"
                          : "Préparer le document"}
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <Label htmlFor="ai-desc">Description du cours</Label>
                <textarea
                  id="ai-desc"
                  className="w-full border border-input bg-background px-3 py-2 text-sm resize-none h-28 transition-colors duration-200 hover:border-mid focus:border-teal"
                  placeholder="Décrivez le contenu, les objectifs et le public cible..."
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                  }}
                />
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="ai-count">Nombre de modules (2 à 99)</Label>
              <Input
                id="ai-count"
                type="number"
                min={2}
                max={99}
                value={moduleCount}
                onChange={(e) => {
                  setModuleCount(e.target.value);
                }}
                className="w-24"
              />
              <p className="text-xs text-meta">
                Au-delà d&apos;une vingtaine de modules, la génération et la
                création peuvent prendre une à deux minutes.
              </p>
            </div>
            {error.length > 0 && (
              <p className="text-xs text-destructive">{error}</p>
            )}
          </div>
        ) : (
          <div className="px-6 py-4 space-y-3 max-h-96 overflow-y-auto">
            <p className="text-xs text-meta mb-2">
              {suggestions.length} modules suggérés — vérifiez et créez-les en
              un clic.
            </p>
            {suggestions.map((mod, i) => (
              <div
                key={i}
                className="flex gap-3 rounded-md border border-border p-3"
              >
                <div className="mt-0.5">
                  <BookOpen size={14} className="text-teal" />
                </div>
                <div>
                  <p className="text-xs font-semibold">
                    {mod.title}
                    {mod.pageStart !== undefined &&
                      mod.pageEnd !== undefined && (
                        <span className="text-meta font-normal">
                          {" "}
                          (p. {String(mod.pageStart)}–{String(mod.pageEnd)})
                        </span>
                      )}
                  </p>
                  <p className="text-xs text-meta mt-0.5">{mod.description}</p>
                </div>
              </div>
            ))}
            {error.length > 0 && (
              <p className="text-xs text-destructive">{error}</p>
            )}
          </div>
        )}

        <DialogFooter>
          {suggestions === null ? (
            <>
              <DialogClose asChild>
                <Button variant="outline" size="sm">
                  Annuler
                </Button>
              </DialogClose>
              <Button
                size="sm"
                onClick={() => {
                  void handleGenerate();
                }}
                disabled={generateDisabled}
              >
                {loading ? "Génération..." : "Générer la structure"}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSuggestions(null);
                  setError("");
                }}
              >
                Modifier
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  void handleCreate();
                }}
                disabled={creating}
              >
                {creating
                  ? "Création..."
                  : "Créer ces " + String(suggestions.length) + " modules"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
