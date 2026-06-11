import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api.js";
import type {
  AICourseStructureResponse,
  DocumentIngestStatusResponse,
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
  coursePdfId?: string | null;
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
  coursePdfId,
  open,
  onOpenChange,
  onSuccess,
}: AICourseStructureDialogProps) {
  const hasPdf = coursePdfId !== null && coursePdfId !== undefined;
  const [source, setSource] = useState<"pdf" | "description">("description");
  const [description, setDescription] = useState("");
  const [moduleCount, setModuleCount] = useState("5");
  const [suggestions, setSuggestions] = useState<
    AICourseStructureResponse["modules"] | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState("");

  // Default to the course PDF as source whenever the dialog opens with one.
  useEffect(() => {
    if (open) {
      setSource(hasPdf ? "pdf" : "description");
    }
  }, [open, hasPdf]);

  const ingestQuery = useQuery<DocumentIngestStatusResponse>({
    queryKey: ["document-ingest", coursePdfId],
    queryFn: () =>
      api.get<DocumentIngestStatusResponse>(
        `/ai/documents/${coursePdfId ?? ""}/ingest`,
      ),
    enabled: open && hasPdf,
    refetchInterval: (query) =>
      query.state.data?.status === "processing" ? 2500 : false,
  });
  const ingest = ingestQuery.data;

  async function handlePrepare(): Promise<void> {
    if (!hasPdf) return;
    setPreparing(true);
    setError("");
    try {
      await api.post(`/ai/documents/${coursePdfId}/ingest`, {});
      await ingestQuery.refetch();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur de préparation");
    } finally {
      setPreparing(false);
    }
  }

  async function handleGenerate(): Promise<void> {
    const usePdf = source === "pdf" && hasPdf;
    if (!usePdf && description.trim().length < 10) return;
    setLoading(true);
    setError("");
    setSuggestions(null);
    try {
      const body = usePdf
        ? { fileId: coursePdfId, moduleCount: Number(moduleCount) }
        : { description: description.trim(), moduleCount: Number(moduleCount) };
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
      for (const mod of suggestions) {
        await api.post("/courses/" + courseId + "/modules", {
          title: mod.title,
          description: mod.description,
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
    (source === "pdf" && hasPdf
      ? ingest?.status !== "ready"
      : description.trim().length < 10);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles size={18} className="text-teal-600" />
            Structurer le cours avec l&apos;IA
          </DialogTitle>
        </DialogHeader>

        {suggestions === null ? (
          <div className="space-y-4 py-2">
            {hasPdf && (
              <fieldset className="space-y-1">
                <legend className="text-sm font-medium mb-1">Source</legend>
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
                      className="h-4 w-4 accent-teal-600"
                    />
                    PDF du cours
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
                      className="h-4 w-4 accent-teal-600"
                    />
                    Description manuelle
                  </label>
                </div>
              </fieldset>
            )}

            {source === "pdf" && hasPdf ? (
              <div className="rounded-md border border-border p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <FileText size={14} className="text-teal-600" />
                  {ingest === undefined ? (
                    <span className="text-meta">Vérification du document…</span>
                  ) : ingest.status === "ready" ? (
                    <span>
                      Document indexé — {String(ingest.pageCount ?? "?")} pages,{" "}
                      {String(ingest.chunkCount ?? "?")} extraits.
                    </span>
                  ) : ingest.status === "processing" ? (
                    <span className="flex items-center gap-2 text-meta">
                      <Loader2 size={13} className="animate-spin" />
                      {STAGE_LABELS[ingest.stage ?? ""] ??
                        "Préparation en cours…"}
                    </span>
                  ) : ingest.status === "failed" ? (
                    <span className="text-destructive">
                      Échec de la préparation
                      {ingest.error !== null && ingest.error !== undefined
                        ? ` : ${ingest.error}`
                        : ""}
                    </span>
                  ) : (
                    <span className="text-meta">
                      Le document doit d&apos;abord être préparé (analyse du
                      plan et indexation).
                    </span>
                  )}
                </div>
                {(ingest?.status === "none" || ingest?.status === "failed") && (
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
                      : ingest.status === "failed"
                        ? "Relancer la préparation"
                        : "Préparer le document"}
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <Label htmlFor="ai-desc">Description du cours</Label>
                <textarea
                  id="ai-desc"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none h-28 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="Décrivez le contenu, les objectifs et le public cible..."
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                  }}
                />
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="ai-count">Nombre de modules</Label>
              <Input
                id="ai-count"
                type="number"
                min={2}
                max={12}
                value={moduleCount}
                onChange={(e) => {
                  setModuleCount(e.target.value);
                }}
                className="w-24"
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        ) : (
          <div className="space-y-3 py-2 max-h-96 overflow-y-auto">
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
                  <BookOpen size={14} className="text-teal-600" />
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
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter className="gap-2">
          {suggestions === null ? (
            <>
              <DialogClose asChild>
                <Button variant="ghost" size="sm">
                  Annuler
                </Button>
              </DialogClose>
              <Button
                size="sm"
                onClick={() => {
                  void handleGenerate();
                }}
                disabled={generateDisabled}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                {loading ? "Génération..." : "Générer la structure"}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
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
                className="bg-teal-600 hover:bg-teal-700 text-white"
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
