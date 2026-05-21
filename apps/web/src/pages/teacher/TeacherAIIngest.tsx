import { useState, useRef } from "react";
import { Bot, Upload, CheckCircle2, Search } from "lucide-react";
import { Button } from "@/components/ui/button.js";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.js";
import { api } from "@/lib/api.js";
import type { AiQueryResponse, AiIngestResponse } from "@/lib/api.js";

export function TeacherAIIngestPage() {
  // ── Ingest state ──────────────────────────────────────────────────────────
  const [lessonId, setLessonId] = useState("");
  const [ingestText, setIngestText] = useState("");
  const [ingestLoading, setIngestLoading] = useState(false);
  const [ingestResult, setIngestResult] = useState<AiIngestResponse | null>(
    null,
  );
  const [ingestError, setIngestError] = useState<string | null>(null);

  // ── Test state ────────────────────────────────────────────────────────────
  const [testQuestion, setTestQuestion] = useState("");
  const [testLessonId, setTestLessonId] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<AiQueryResponse | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const testInputRef = useRef<HTMLInputElement>(null);

  async function handleIngest(e: React.FormEvent) {
    e.preventDefault();
    if (lessonId.trim().length === 0 || ingestText.trim().length === 0) return;
    setIngestLoading(true);
    setIngestResult(null);
    setIngestError(null);
    try {
      const res = await api.post<AiIngestResponse>("/ai/ingest", {
        lessonId: lessonId.trim(),
        text: ingestText.trim(),
      });
      setIngestResult(res);
    } catch (err: unknown) {
      setIngestError(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setIngestLoading(false);
    }
  }

  async function handleTest(e: React.FormEvent) {
    e.preventDefault();
    if (testQuestion.trim().length === 0) return;
    setTestLoading(true);
    setTestResult(null);
    setTestError(null);
    try {
      const res = await api.post<AiQueryResponse>("/ai/query", {
        question: testQuestion.trim(),
        ...(testLessonId.trim().length > 0
          ? { lessonId: testLessonId.trim() }
          : {}),
      });
      setTestResult(res);
    } catch (err: unknown) {
      setTestError(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setTestLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-6 space-y-8">
      {/* Title */}
      <div className="flex items-center gap-3">
        <Bot size={20} className="text-teal" />
        <div>
          <h1 className="text-xl font-bold text-dark">
            Assistant IA — Contenu
          </h1>
          <p className="text-xs text-meta mt-0.5">
            Ingérez le contenu de vos leçons pour alimenter la base de
            connaissances IA des apprenants.
          </p>
        </div>
      </div>

      {/* Ingest card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
            <Upload size={14} />
            Ingérer du contenu
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleIngest(e)} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-dark mb-1.5">
                ID de la leçon
              </label>
              <input
                type="text"
                value={lessonId}
                onChange={(e) => {
                  setLessonId(e.target.value);
                }}
                placeholder="uuid de la leçon"
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-dark placeholder:text-meta/50 focus:outline-none focus:ring-2 focus:ring-teal/30"
              />
              <p className="text-[11px] text-meta/60 mt-1">
                Trouvez l'UUID dans l'URL du constructeur de cours.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-dark mb-1.5">
                Contenu de la leçon
              </label>
              <textarea
                value={ingestText}
                onChange={(e) => {
                  setIngestText(e.target.value);
                }}
                rows={10}
                placeholder="Collez ici le texte intégral de la leçon…"
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-dark placeholder:text-meta/50 focus:outline-none focus:ring-2 focus:ring-teal/30 resize-y"
              />
              <p className="text-[11px] text-meta/60 mt-1">
                {ingestText.length.toLocaleString()} / 500 000 caractères
              </p>
            </div>

            {ingestError !== null && (
              <p className="text-xs text-destructive">{ingestError}</p>
            )}

            {ingestResult !== null && (
              <div className="flex items-center gap-2 text-xs text-teal font-bold">
                <CheckCircle2 size={14} />
                {ingestResult.chunkCount} chunks ingérés pour la leçon{" "}
                <span className="font-mono text-dark">
                  {ingestResult.lessonId}
                </span>
              </div>
            )}

            <Button
              type="submit"
              size="sm"
              disabled={
                ingestLoading ||
                lessonId.trim().length === 0 ||
                ingestText.trim().length === 0
              }
            >
              {ingestLoading ? "Ingestion…" : "Ingérer"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Test card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
            <Search size={14} />
            Tester une requête
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleTest(e)} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-dark mb-1.5">
                Question de test
              </label>
              <input
                ref={testInputRef}
                type="text"
                value={testQuestion}
                onChange={(e) => {
                  setTestQuestion(e.target.value);
                }}
                placeholder="Ex : Quels sont les objectifs de cette leçon ?"
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-dark placeholder:text-meta/50 focus:outline-none focus:ring-2 focus:ring-teal/30"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-dark mb-1.5">
                Restreindre à une leçon{" "}
                <span className="text-meta/60 font-normal">(optionnel)</span>
              </label>
              <input
                type="text"
                value={testLessonId}
                onChange={(e) => {
                  setTestLessonId(e.target.value);
                }}
                placeholder="uuid de la leçon"
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-dark placeholder:text-meta/50 focus:outline-none focus:ring-2 focus:ring-teal/30"
              />
            </div>

            {testError !== null && (
              <p className="text-xs text-destructive">{testError}</p>
            )}

            <Button
              type="submit"
              size="sm"
              disabled={testLoading || testQuestion.trim().length === 0}
            >
              {testLoading ? "Recherche…" : "Tester"}
            </Button>
          </form>

          {testResult !== null && (
            <div className="mt-5 space-y-3">
              <div className="rounded-lg bg-muted px-4 py-3">
                <p className="text-xs font-bold text-dark mb-1 uppercase tracking-wider">
                  Réponse
                </p>
                <p className="text-sm text-dark leading-relaxed">
                  {testResult.answer}
                </p>
                {testResult.escalated && (
                  <p className="text-[11px] text-amber-600 mt-2 font-bold">
                    ⚠ Escaladé — contenu non trouvé
                  </p>
                )}
              </div>
              {testResult.chunks.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-dark mb-1.5 uppercase tracking-wider">
                    Chunks utilisés ({testResult.chunks.length})
                  </p>
                  <div className="space-y-2">
                    {testResult.chunks.map((c, i) => (
                      <div
                        key={i}
                        className="rounded border border-border bg-white px-3 py-2 text-xs text-meta"
                      >
                        <p className="line-clamp-2">{c.chunkText}</p>
                        <p className="text-[10px] text-meta/50 mt-1">
                          sim {(c.similarity * 100).toFixed(0)}%
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
