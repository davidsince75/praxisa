import { useState } from "react";
import { api } from "@/lib/api.js";
import type { AICourseStructureResponse } from "@/lib/api.js";
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
import { Sparkles, BookOpen } from "lucide-react";

interface AICourseStructureDialogProps {
  courseId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}

export function AICourseStructureDialog({
  courseId,
  open,
  onOpenChange,
  onSuccess,
}: AICourseStructureDialogProps) {
  const [description, setDescription] = useState("");
  const [moduleCount, setModuleCount] = useState("5");
  const [suggestions, setSuggestions] = useState<
    { title: string; description: string }[] | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate(): Promise<void> {
    if (description.trim().length < 10) return;
    setLoading(true);
    setError("");
    setSuggestions(null);
    try {
      const res = await api.post<AICourseStructureResponse>(
        "/ai/course-structure",
        {
          description: description.trim(),
          moduleCount: Number(moduleCount),
        },
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
                  <p className="text-xs font-semibold">{mod.title}</p>
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
                disabled={loading || description.trim().length < 10}
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
