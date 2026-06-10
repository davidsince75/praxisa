import { useState } from "react";
import { Bot, Copy, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button.js";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.js";
import { api } from "@/lib/api.js";
import type { AiAdminDraftResponse } from "@/lib/api.js";

export function AdminAIDraftPage() {
  const [intent, setIntent] = useState("");
  const [contextRaw, setContextRaw] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiAdminDraftResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (intent.trim().length === 0) return;
    setLoading(true);
    setResult(null);
    setError(null);
    setCopied(false);

    let parsedContext: Record<string, unknown> | undefined;
    if (contextRaw.trim().length > 0) {
      try {
        parsedContext = JSON.parse(contextRaw) as Record<string, unknown>;
      } catch {
        setError("Le contexte n'est pas un JSON valide.");
        setLoading(false);
        return;
      }
    }

    try {
      const res = await api.post<AiAdminDraftResponse>("/ai/admin/draft", {
        intent: intent.trim(),
        ...(parsedContext !== undefined ? { context: parsedContext } : {}),
      });
      setResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (result === null) return;
    await navigator.clipboard.writeText(result.draft.draft);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-6 space-y-8">
      {/* Title */}
      <div className="flex items-center gap-3">
        <Bot size={20} className="text-teal" />
        <div>
          <h1 className="text-xl font-semibold text-dark">
            Assistant IA — Admin
          </h1>
          <p className="text-xs text-meta mt-0.5">
            Générez des brouillons de communications ou de contenus.{" "}
            <span className="font-semibold text-amber-600">
              Toute sortie requiert une révision humaine avant envoi.
            </span>
          </p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold uppercase tracking-wider">
            Nouveau brouillon
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-dark mb-1.5">
                Intention
              </label>
              <input
                type="text"
                value={intent}
                onChange={(e) => {
                  setIntent(e.target.value);
                }}
                maxLength={500}
                placeholder="Ex : Email de bienvenue pour les nouveaux apprenants du mois de juin"
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-dark placeholder:text-meta focus:outline-none focus:ring-2 focus:ring-teal/30"
              />
              <p className="text-xs text-meta mt-1">{intent.length} / 500</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-dark mb-1.5">
                Contexte{" "}
                <span className="text-meta font-normal">(JSON, optionnel)</span>
              </label>
              <textarea
                value={contextRaw}
                onChange={(e) => {
                  setContextRaw(e.target.value);
                }}
                rows={4}
                placeholder={
                  '{"courseName": "Sécurité au travail", "cohort": "Juin 2025"}'
                }
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm font-mono text-dark placeholder:text-meta focus:outline-none focus:ring-2 focus:ring-teal/30 resize-y"
              />
            </div>

            {error !== null && (
              <p className="text-xs text-destructive">{error}</p>
            )}

            <Button
              type="submit"
              size="sm"
              disabled={loading || intent.trim().length === 0}
            >
              {loading ? "Génération…" : "Générer le brouillon"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Result */}
      {result !== null && (
        <Card className="border-amber-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
                <Bot size={14} className="text-teal" />
                Brouillon généré
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleCopy()}
              >
                {copied ? (
                  <>
                    <CheckCircle2 size={13} className="mr-1.5 text-teal" />
                    Copié
                  </>
                ) : (
                  <>
                    <Copy size={13} className="mr-1.5" />
                    Copier
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Human review warning */}
            <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-4 py-3">
              <AlertTriangle
                size={14}
                className="text-amber-600 mt-0.5 flex-shrink-0"
              />
              <p className="text-xs text-amber-800 leading-relaxed">
                <span className="font-semibold">
                  Révision humaine obligatoire.
                </span>{" "}
                Ce brouillon est généré automatiquement et ne doit jamais être
                envoyé sans vérification préalable.
              </p>
            </div>

            {/* Draft body */}
            <div className="rounded-lg bg-white border border-border px-4 py-4 text-sm text-dark leading-relaxed whitespace-pre-wrap">
              {result.draft.draft}
            </div>

            {/* Metadata */}
            <div className="flex items-center gap-4 text-xs text-meta">
              <span>
                Classification :{" "}
                <span className="font-semibold text-dark">
                  {result.draft.intentClassification}
                </span>
              </span>
              <span>
                Politique :{" "}
                <span
                  className={`font-semibold ${result.draft.policyPassed ? "text-teal" : "text-destructive"}`}
                >
                  {result.draft.policyPassed ? "✓ Conforme" : "✗ Non conforme"}
                </span>
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
