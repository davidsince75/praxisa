import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api.js";
import type {
  AIGenerateHomeworkResponse,
  AIGenerateLessonContentResponse,
  AIHomeworkSuggestion,
  AIMCQQuestion,
  AIMCQResponse,
  AISuggestResourcesResponse,
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
} from "@/components/ui/dialog.js";
import {
  BookOpen,
  ClipboardList,
  ExternalLink,
  FileText,
  HelpCircle,
  Loader2,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

// ── HTML building helpers ──────────────────────────────────────────────────────
// The selected resources are turned into a lesson-body HTML block. Every
// attribute and text node is escaped here; URLs all come from the API, which
// resolves them against real public sources (Wikipédia, Openverse, YouTube).

function escAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

interface ResourceSelection {
  articles: AISuggestResourcesResponse["articles"];
  references: AISuggestResourcesResponse["references"];
  videos: AISuggestResourcesResponse["videos"];
  videoSearches: AISuggestResourcesResponse["videoSearches"];
  images: AISuggestResourcesResponse["images"];
}

function buildResourcesHtml(sel: ResourceSelection): string {
  const parts: string[] = ["<hr /><h2>Pour aller plus loin</h2>"];

  if (sel.articles.length > 0 || sel.references.length > 0) {
    parts.push("<h3>Lectures complémentaires</h3><ul>");
    for (const a of sel.articles) {
      parts.push(
        `<li><a href="${escAttr(a.url)}" target="_blank" rel="noopener noreferrer">${escText(a.title)}</a>` +
          (a.description !== null ? ` — ${escText(a.description)}` : "") +
          " (Wikipédia)</li>",
      );
    }
    for (const r of sel.references) {
      parts.push(
        `<li><em>${escText(r.title)}</em>` +
          (r.author !== undefined ? `, ${escText(r.author)}` : "") +
          (r.year !== undefined ? ` (${escText(r.year)})` : "") +
          (r.note !== undefined ? ` — ${escText(r.note)}` : "") +
          "</li>",
      );
    }
    parts.push("</ul>");
  }

  if (sel.videos.length > 0 || sel.videoSearches.length > 0) {
    parts.push("<h3>Vidéos recommandées</h3>");
    for (const v of sel.videos) {
      parts.push(
        `<p><strong>${escText(v.title)}</strong>${v.channel.length > 0 ? ` — ${escText(v.channel)}` : ""}</p>`,
      );
      parts.push(
        `<div style="position:relative;padding-bottom:56.25%;height:0;margin:12px 0;border-radius:6px;overflow:hidden;"><iframe src="${escAttr(v.embedUrl)}" title="${escAttr(v.title)}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;" allowfullscreen></iframe></div>`,
      );
    }
    if (sel.videoSearches.length > 0) {
      parts.push("<ul>");
      for (const s of sel.videoSearches) {
        parts.push(
          `<li><a href="${escAttr(s.url)}" target="_blank" rel="noopener noreferrer">Rechercher sur YouTube : ${escText(s.query)}</a></li>`,
        );
      }
      parts.push("</ul>");
    }
  }

  if (sel.images.length > 0) {
    parts.push("<h3>Illustrations</h3>");
    for (const img of sel.images) {
      parts.push(
        `<figure style="margin:16px 0;"><img src="${escAttr(img.imageUrl)}" alt="${escAttr(img.title)}" style="max-width:100%;height:auto;border-radius:6px;" /><figcaption style="font-size:0.75rem;color:#6B6862;margin-top:4px;">« ${escText(img.title)} »` +
          (img.creator !== null ? `, par ${escText(img.creator)}` : "") +
          ` — licence ${escText(img.license)}` +
          (img.pageUrl !== null
            ? ` (<a href="${escAttr(img.pageUrl)}" target="_blank" rel="noopener noreferrer">source</a>)`
            : "") +
          "</figcaption></figure>",
      );
    }
  }

  return parts.join("");
}

// ── Shared bits ────────────────────────────────────────────────────────────────

type AssistantTab = "content" | "homework" | "quiz" | "resources";

const TABS: { id: AssistantTab; label: string; icon: LucideIcon }[] = [
  { id: "content", label: "Contenu", icon: FileText },
  { id: "homework", label: "Devoir", icon: ClipboardList },
  { id: "quiz", label: "Quiz", icon: HelpCircle },
  { id: "resources", label: "Ressources", icon: BookOpen },
];

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Erreur IA — réessayez.";
}

interface ReadyDocument {
  fileId: string;
  title: string;
}

function SourceSelect({
  idPrefix,
  documents,
  hasPendingDocuments,
  value,
  onChange,
}: {
  idPrefix: string;
  documents: ReadyDocument[];
  hasPendingDocuments: boolean;
  value: string;
  onChange: (fileId: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={`${idPrefix}-source`}>Source</Label>
      <select
        id={`${idPrefix}-source`}
        className="w-full h-11 border border-input bg-background px-3 text-sm text-mid transition-colors duration-200 hover:border-mid focus:border-teal"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
      >
        <option value="">Connaissances générales (sans document)</option>
        {documents.map((doc) => (
          <option key={doc.fileId} value={doc.fileId}>
            Document : {doc.title}
          </option>
        ))}
      </select>
      {documents.length === 0 && (
        <p className="text-xs text-meta">
          {hasPendingDocuments
            ? "Un document est en cours de préparation — il apparaîtra ici une fois indexé."
            : "Astuce : ajoutez et préparez un document de référence (carte « Documents de référence » du cours) pour un contenu fidèle à votre support."}
        </p>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface AILessonAssistantProps {
  courseId: string;
  moduleId: string;
  /** null while the lesson is not saved yet — exercise tabs need a lesson row. */
  lessonId: string | null;
  lessonTitle: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Insert generated HTML into the lesson editor (not saved until the teacher saves). */
  onInsertHtml: (html: string, mode: "replace" | "append") => void;
  /** Called after the assistant created exercises/questions via the API. */
  onEntitiesCreated: () => void;
}

export function AILessonAssistant({
  courseId,
  moduleId,
  lessonId,
  lessonTitle,
  open,
  onOpenChange,
  onInsertHtml,
  onEntitiesCreated,
}: AILessonAssistantProps) {
  const [tab, setTab] = useState<AssistantTab>("content");
  const [sourceFileId, setSourceFileId] = useState("");

  // Content
  const [instructions, setInstructions] = useState("");
  const [contentResult, setContentResult] =
    useState<AIGenerateLessonContentResponse | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState("");

  // Homework
  const [homeworkType, setHomeworkType] = useState<"assignment" | "reflection">(
    "assignment",
  );
  const [homework, setHomework] = useState<AIHomeworkSuggestion | null>(null);
  const [homeworkLoading, setHomeworkLoading] = useState(false);
  const [homeworkCreating, setHomeworkCreating] = useState(false);
  const [homeworkError, setHomeworkError] = useState("");
  const [homeworkSuccess, setHomeworkSuccess] = useState("");

  // Quiz
  const [quizTopic, setQuizTopic] = useState("");
  const [quizCount, setQuizCount] = useState("5");
  const [quizQuestions, setQuizQuestions] = useState<AIMCQQuestion[] | null>(
    null,
  );
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizCreating, setQuizCreating] = useState(false);
  const [quizError, setQuizError] = useState("");
  const [quizSuccess, setQuizSuccess] = useState("");

  // Resources
  const [resources, setResources] = useState<AISuggestResourcesResponse | null>(
    null,
  );
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [resourcesError, setResourcesError] = useState("");
  const [checkedArticles, setCheckedArticles] = useState<Set<number>>(
    new Set(),
  );
  const [checkedReferences, setCheckedReferences] = useState<Set<number>>(
    new Set(),
  );
  const [checkedVideos, setCheckedVideos] = useState<Set<number>>(new Set());
  const [checkedSearches, setCheckedSearches] = useState<Set<number>>(
    new Set(),
  );
  const [checkedImages, setCheckedImages] = useState<Set<number>>(new Set());

  const documentsQuery = useQuery<CourseDocumentsResponse>({
    queryKey: ["course-documents", courseId],
    queryFn: () =>
      api.get<CourseDocumentsResponse>(`/courses/${courseId}/documents`),
    enabled: open,
  });
  const allDocuments = documentsQuery.data?.documents ?? [];
  const readyDocuments: ReadyDocument[] = allDocuments
    .filter((d) => d.ingest.status === "ready")
    .map((d) => ({ fileId: d.fileId, title: d.title }));
  const hasPendingDocuments = allDocuments.some(
    (d) => d.ingest.status === "processing",
  );

  // Fresh state at every opening of the dialog.
  useEffect(() => {
    if (!open) return;
    setTab("content");
    setInstructions("");
    setContentResult(null);
    setContentError("");
    setHomework(null);
    setHomeworkError("");
    setHomeworkSuccess("");
    setQuizTopic(lessonTitle);
    setQuizQuestions(null);
    setQuizError("");
    setQuizSuccess("");
    setResources(null);
    setResourcesError("");
  }, [open, lessonTitle]);

  // Preselect the first ready document once per opening — never after the
  // teacher has touched the select (an explicit « sans document » choice
  // must stick).
  const sourcePresetRef = useRef(false);
  useEffect(() => {
    if (!open) {
      sourcePresetRef.current = false;
      return;
    }
    if (sourcePresetRef.current || documentsQuery.isLoading) return;
    if (readyDocuments.length > 0) {
      sourcePresetRef.current = true;
      setSourceFileId(readyDocuments[0].fileId);
    }
  }, [open, documentsQuery.isLoading, readyDocuments]);

  function handleSourceChange(fileId: string): void {
    sourcePresetRef.current = true;
    setSourceFileId(fileId);
  }

  const lessonExists = lessonId !== null;
  const exercisesPath = `/courses/${courseId}/modules/${moduleId}/lessons/${lessonId ?? ""}/exercises`;

  // ── Actions ──────────────────────────────────────────────────────────────

  async function handleGenerateContent(): Promise<void> {
    setContentLoading(true);
    setContentError("");
    setContentResult(null);
    try {
      const res = await api.post<AIGenerateLessonContentResponse>(
        "/ai/generate-lesson-content",
        {
          lessonTitle,
          ...(sourceFileId.length > 0 ? { fileId: sourceFileId } : {}),
          ...(instructions.trim().length > 0
            ? { instructions: instructions.trim() }
            : {}),
        },
      );
      setContentResult(res);
    } catch (err: unknown) {
      setContentError(errorMessage(err));
    } finally {
      setContentLoading(false);
    }
  }

  function handleInsertContent(mode: "replace" | "append"): void {
    if (contentResult === null) return;
    onInsertHtml(contentResult.html, mode);
    onOpenChange(false);
  }

  async function handleGenerateHomework(): Promise<void> {
    setHomeworkLoading(true);
    setHomeworkError("");
    setHomeworkSuccess("");
    setHomework(null);
    try {
      const res = await api.post<AIGenerateHomeworkResponse>(
        "/ai/generate-homework",
        {
          lessonTitle,
          type: homeworkType,
          ...(sourceFileId.length > 0 ? { fileId: sourceFileId } : {}),
        },
      );
      setHomework(res.homework);
    } catch (err: unknown) {
      setHomeworkError(errorMessage(err));
    } finally {
      setHomeworkLoading(false);
    }
  }

  async function handleCreateHomework(): Promise<void> {
    if (homework === null || !lessonExists) return;
    setHomeworkCreating(true);
    setHomeworkError("");
    try {
      await api.post(exercisesPath, {
        title: homework.title,
        description: homework.description,
        type: homework.type,
        maxScore: homework.maxScore,
      });
      onEntitiesCreated();
      setHomework(null);
      setHomeworkSuccess(
        "Exercice créé — il apparaît dans la colonne « Exercices » de la leçon.",
      );
    } catch (err: unknown) {
      setHomeworkError(errorMessage(err));
    } finally {
      setHomeworkCreating(false);
    }
  }

  async function handleGenerateQuiz(): Promise<void> {
    if (quizTopic.trim().length < 3) return;
    setQuizLoading(true);
    setQuizError("");
    setQuizSuccess("");
    setQuizQuestions(null);
    try {
      const res = await api.post<AIMCQResponse>("/ai/generate-mcq", {
        topic: quizTopic.trim(),
        count: Number(quizCount),
      });
      setQuizQuestions(res.questions);
    } catch (err: unknown) {
      setQuizError(errorMessage(err));
    } finally {
      setQuizLoading(false);
    }
  }

  async function handleCreateQuiz(): Promise<void> {
    if (quizQuestions === null || quizQuestions.length === 0 || !lessonExists)
      return;
    setQuizCreating(true);
    setQuizError("");
    try {
      const created = await api.post<{ exercise: { id: string } }>(
        exercisesPath,
        {
          title: `Quiz : ${quizTopic.trim()}`.slice(0, 200),
          type: "quiz",
          maxScore: quizQuestions.length,
        },
      );
      await api.post(`/exercises/${created.exercise.id}/questions`, {
        questions: quizQuestions,
      });
      onEntitiesCreated();
      setQuizQuestions(null);
      setQuizSuccess(
        `Quiz créé avec ${String(quizQuestions.length)} questions — gérez-le depuis la colonne « Exercices ».`,
      );
    } catch (err: unknown) {
      setQuizError(errorMessage(err));
    } finally {
      setQuizCreating(false);
    }
  }

  async function handleGenerateResources(): Promise<void> {
    setResourcesLoading(true);
    setResourcesError("");
    setResources(null);
    try {
      const res = await api.post<AISuggestResourcesResponse>(
        "/ai/suggest-resources",
        { lessonTitle },
      );
      setResources(res);
      // Everything verified is pre-checked; generic search links only when
      // no resolved video is available.
      setCheckedArticles(new Set(res.articles.map((_, i) => i)));
      setCheckedReferences(new Set(res.references.map((_, i) => i)));
      setCheckedVideos(new Set(res.videos.map((_, i) => i)));
      setCheckedSearches(
        res.videos.length === 0
          ? new Set(res.videoSearches.map((_, i) => i))
          : new Set(),
      );
      setCheckedImages(new Set(res.images.map((_, i) => i)));
    } catch (err: unknown) {
      setResourcesError(errorMessage(err));
    } finally {
      setResourcesLoading(false);
    }
  }

  function toggleIndex(
    set: Set<number>,
    setter: (next: Set<number>) => void,
    index: number,
  ): void {
    const next = new Set(set);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    setter(next);
  }

  const selectionCount =
    checkedArticles.size +
    checkedReferences.size +
    checkedVideos.size +
    checkedSearches.size +
    checkedImages.size;

  function handleInsertResources(): void {
    if (resources === null || selectionCount === 0) return;
    const html = buildResourcesHtml({
      articles: resources.articles.filter((_, i) => checkedArticles.has(i)),
      references: resources.references.filter((_, i) =>
        checkedReferences.has(i),
      ),
      videos: resources.videos.filter((_, i) => checkedVideos.has(i)),
      videoSearches: resources.videoSearches.filter((_, i) =>
        checkedSearches.has(i),
      ),
      images: resources.images.filter((_, i) => checkedImages.has(i)),
    });
    onInsertHtml(html, "append");
    onOpenChange(false);
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles size={18} className="text-teal" />
            Assistant IA — {lessonTitle}
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div
          className="flex flex-wrap gap-1 border-b border-rule px-1"
          role="tablist"
          aria-label="Fonctions de l'assistant IA"
        >
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setTab(t.id);
                }}
                className={
                  active
                    ? "flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold text-teal border-b-2 border-teal -mb-px"
                    : "flex items-center gap-1.5 px-3 py-2.5 text-sm text-meta hover:text-dark border-b-2 border-transparent -mb-px transition-colors"
                }
              >
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-1 py-3 space-y-4">
          {/* ── Contenu ─────────────────────────────────────────────────── */}
          {tab === "content" && (
            <div className="space-y-4">
              {contentResult === null ? (
                <>
                  <SourceSelect
                    idPrefix="ai-content"
                    documents={readyDocuments}
                    hasPendingDocuments={hasPendingDocuments}
                    value={sourceFileId}
                    onChange={handleSourceChange}
                  />
                  <div className="space-y-1">
                    <Label htmlFor="ai-content-instructions">
                      Consignes (optionnel)
                    </Label>
                    <textarea
                      id="ai-content-instructions"
                      className="w-full border border-input bg-background px-3 py-2 text-sm resize-none h-20 transition-colors duration-200 hover:border-mid focus:border-teal"
                      placeholder="Angle, niveau, points à insister…"
                      value={instructions}
                      onChange={(e) => {
                        setInstructions(e.target.value);
                      }}
                    />
                  </div>
                  <p className="text-xs text-meta">
                    {sourceFileId.length > 0
                      ? "Le contenu sera rédigé uniquement à partir du document sélectionné, avec citation des pages."
                      : "Sans document, le contenu est rédigé à partir des connaissances générales du modèle — à relire attentivement."}
                  </p>
                </>
              ) : (
                <>
                  <div
                    className="prose prose-sm max-w-none border border-rule rounded-md p-4 bg-background"
                    dangerouslySetInnerHTML={{ __html: contentResult.html }}
                  />
                  {contentResult.sources.length > 0 && (
                    <p className="text-xs text-meta">
                      Sources :{" "}
                      {contentResult.sources
                        .map(
                          (s) =>
                            `p. ${String(s.pageStart)}–${String(s.pageEnd)}`,
                        )
                        .join(", ")}
                    </p>
                  )}
                </>
              )}
              {contentError.length > 0 && (
                <p className="text-xs text-destructive">{contentError}</p>
              )}
              <div className="flex flex-wrap gap-2">
                {contentResult === null ? (
                  <Button
                    size="sm"
                    disabled={contentLoading}
                    onClick={() => {
                      void handleGenerateContent();
                    }}
                  >
                    {contentLoading ? (
                      <Loader2 size={13} className="mr-1.5 animate-spin" />
                    ) : (
                      <Sparkles size={13} className="mr-1.5" />
                    )}
                    {contentLoading ? "Génération…" : "Générer le contenu"}
                  </Button>
                ) : (
                  <>
                    <Button
                      size="sm"
                      onClick={() => {
                        handleInsertContent("replace");
                      }}
                    >
                      Remplacer le contenu de la leçon
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        handleInsertContent("append");
                      }}
                    >
                      Ajouter à la suite
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setContentResult(null);
                      }}
                    >
                      Régénérer
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── Devoir ──────────────────────────────────────────────────── */}
          {tab === "homework" && !lessonExists && (
            <p className="text-xs text-meta">
              Les devoirs sont rattachés à une leçon existante — enregistrez
              d&apos;abord la leçon, puis rouvrez l&apos;assistant. Les onglets
              « Contenu » et « Ressources » sont utilisables dès maintenant.
            </p>
          )}
          {tab === "homework" && lessonExists && (
            <div className="space-y-4">
              {homework === null ? (
                <>
                  <SourceSelect
                    idPrefix="ai-homework"
                    documents={readyDocuments}
                    hasPendingDocuments={hasPendingDocuments}
                    value={sourceFileId}
                    onChange={handleSourceChange}
                  />
                  <div className="space-y-1">
                    <Label htmlFor="ai-homework-type">
                      Type d&apos;exercice
                    </Label>
                    <select
                      id="ai-homework-type"
                      className="w-full h-11 border border-input bg-background px-3 text-sm text-mid transition-colors duration-200 hover:border-mid focus:border-teal"
                      value={homeworkType}
                      onChange={(e) => {
                        setHomeworkType(
                          e.target.value as "assignment" | "reflection",
                        );
                      }}
                    >
                      <option value="assignment">Devoir à rendre</option>
                      <option value="reflection">Travail de réflexion</option>
                    </select>
                  </div>
                </>
              ) : (
                <div className="border border-rule rounded-md p-4 bg-background space-y-2">
                  <p className="text-sm font-semibold text-dark">
                    {homework.title}
                  </p>
                  <p className="text-sm text-mid whitespace-pre-wrap">
                    {homework.description}
                  </p>
                  <p className="text-xs text-meta">
                    Noté sur {String(homework.maxScore)} ·{" "}
                    {homework.type === "assignment"
                      ? "Devoir à rendre"
                      : "Travail de réflexion"}
                  </p>
                </div>
              )}
              {homeworkError.length > 0 && (
                <p className="text-xs text-destructive">{homeworkError}</p>
              )}
              {homeworkSuccess.length > 0 && (
                <p className="text-xs text-teal">{homeworkSuccess}</p>
              )}
              <div className="flex flex-wrap gap-2">
                {homework === null ? (
                  <Button
                    size="sm"
                    disabled={homeworkLoading}
                    onClick={() => {
                      void handleGenerateHomework();
                    }}
                  >
                    {homeworkLoading ? (
                      <Loader2 size={13} className="mr-1.5 animate-spin" />
                    ) : (
                      <Sparkles size={13} className="mr-1.5" />
                    )}
                    {homeworkLoading ? "Génération…" : "Suggérer un sujet"}
                  </Button>
                ) : (
                  <>
                    <Button
                      size="sm"
                      disabled={homeworkCreating}
                      onClick={() => {
                        void handleCreateHomework();
                      }}
                    >
                      {homeworkCreating ? "Création…" : "Créer l'exercice"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setHomework(null);
                      }}
                    >
                      Régénérer
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── Quiz ────────────────────────────────────────────────────── */}
          {tab === "quiz" && !lessonExists && (
            <p className="text-xs text-meta">
              Les quiz sont rattachés à une leçon existante — enregistrez
              d&apos;abord la leçon, puis rouvrez l&apos;assistant. Les onglets
              « Contenu » et « Ressources » sont utilisables dès maintenant.
            </p>
          )}
          {tab === "quiz" && lessonExists && (
            <div className="space-y-4">
              {quizQuestions === null ? (
                <>
                  <div className="space-y-1">
                    <Label htmlFor="ai-quiz-topic">Thème du quiz</Label>
                    <Input
                      id="ai-quiz-topic"
                      value={quizTopic}
                      onChange={(e) => {
                        setQuizTopic(e.target.value);
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ai-quiz-count">Nombre de questions</Label>
                    <select
                      id="ai-quiz-count"
                      className="w-28 h-11 border border-input bg-background px-3 text-sm text-mid transition-colors duration-200 hover:border-mid focus:border-teal"
                      value={quizCount}
                      onChange={(e) => {
                        setQuizCount(e.target.value);
                      }}
                    >
                      {[3, 5, 7, 10].map((n) => (
                        <option key={n} value={String(n)}>
                          {String(n)}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  {quizQuestions.map((q, i) => (
                    <div
                      key={i}
                      className="border border-rule rounded-md p-3 bg-background"
                    >
                      <p className="text-sm font-semibold text-dark">
                        {String(i + 1)}. {q.questionText}
                      </p>
                      <div className="mt-1 space-y-0.5">
                        {q.options.map((opt) => (
                          <p
                            key={opt.id}
                            className={
                              opt.id === q.correctOptionId
                                ? "text-xs text-teal font-semibold"
                                : "text-xs text-meta"
                            }
                          >
                            {opt.id === q.correctOptionId ? "✓ " : "· "}
                            {opt.text}
                          </p>
                        ))}
                      </div>
                      {q.explanation.length > 0 && (
                        <p className="text-xs text-meta italic mt-1">
                          {q.explanation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {quizError.length > 0 && (
                <p className="text-xs text-destructive">{quizError}</p>
              )}
              {quizSuccess.length > 0 && (
                <p className="text-xs text-teal">{quizSuccess}</p>
              )}
              <div className="flex flex-wrap gap-2">
                {quizQuestions === null ? (
                  <Button
                    size="sm"
                    disabled={quizLoading || quizTopic.trim().length < 3}
                    onClick={() => {
                      void handleGenerateQuiz();
                    }}
                  >
                    {quizLoading ? (
                      <Loader2 size={13} className="mr-1.5 animate-spin" />
                    ) : (
                      <Sparkles size={13} className="mr-1.5" />
                    )}
                    {quizLoading ? "Génération…" : "Générer les questions"}
                  </Button>
                ) : (
                  <>
                    <Button
                      size="sm"
                      disabled={quizCreating}
                      onClick={() => {
                        void handleCreateQuiz();
                      }}
                    >
                      {quizCreating
                        ? "Création…"
                        : `Créer le quiz (${String(quizQuestions.length)} questions)`}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setQuizQuestions(null);
                      }}
                    >
                      Régénérer
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── Ressources ──────────────────────────────────────────────── */}
          {tab === "resources" && (
            <div className="space-y-4">
              {resources === null ? (
                <p className="text-xs text-meta">
                  L&apos;assistant propose des lectures, vidéos et images libres
                  pour prolonger la leçon. Chaque lien est vérifié auprès de
                  sources réelles (Wikipédia, Openverse, YouTube) — aucune URL
                  n&apos;est inventée.
                </p>
              ) : (
                <div className="space-y-4">
                  {resources.articles.length > 0 && (
                    <fieldset className="space-y-1.5">
                      <legend className="text-xs font-semibold uppercase tracking-wider text-meta mb-1">
                        Articles Wikipédia
                      </legend>
                      {resources.articles.map((a, i) => (
                        <label
                          key={a.url}
                          className="flex items-start gap-2 text-sm py-1 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 accent-teal"
                            checked={checkedArticles.has(i)}
                            onChange={() => {
                              toggleIndex(
                                checkedArticles,
                                setCheckedArticles,
                                i,
                              );
                            }}
                          />
                          <span className="flex-1">
                            <span className="text-dark">{a.title}</span>
                            {a.description !== null && (
                              <span className="text-meta">
                                {" "}
                                — {a.description}
                              </span>
                            )}{" "}
                            <a
                              href={a.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-0.5 text-teal hover:text-teal-dark"
                              aria-label={`Ouvrir l'article « ${a.title} » dans un nouvel onglet`}
                            >
                              <ExternalLink size={11} />
                            </a>
                          </span>
                        </label>
                      ))}
                    </fieldset>
                  )}

                  {resources.references.length > 0 && (
                    <fieldset className="space-y-1.5">
                      <legend className="text-xs font-semibold uppercase tracking-wider text-meta mb-1">
                        Ouvrages de référence (à vérifier)
                      </legend>
                      {resources.references.map((r, i) => (
                        <label
                          key={`${r.title}-${String(i)}`}
                          className="flex items-start gap-2 text-sm py-1 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 accent-teal"
                            checked={checkedReferences.has(i)}
                            onChange={() => {
                              toggleIndex(
                                checkedReferences,
                                setCheckedReferences,
                                i,
                              );
                            }}
                          />
                          <span className="flex-1 text-mid">
                            <em>{r.title}</em>
                            {r.author !== undefined && `, ${r.author}`}
                            {r.year !== undefined && ` (${r.year})`}
                            {r.note !== undefined && (
                              <span className="text-meta"> — {r.note}</span>
                            )}
                          </span>
                        </label>
                      ))}
                    </fieldset>
                  )}

                  {(resources.videos.length > 0 ||
                    resources.videoSearches.length > 0) && (
                    <fieldset className="space-y-1.5">
                      <legend className="text-xs font-semibold uppercase tracking-wider text-meta mb-1">
                        Vidéos (YouTube)
                      </legend>
                      {resources.videos.map((v, i) => (
                        <label
                          key={v.videoId}
                          className="flex items-start gap-2 text-sm py-1 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 accent-teal"
                            checked={checkedVideos.has(i)}
                            onChange={() => {
                              toggleIndex(checkedVideos, setCheckedVideos, i);
                            }}
                          />
                          {v.thumbnailUrl !== null && (
                            <img
                              src={v.thumbnailUrl}
                              alt=""
                              className="h-12 w-20 object-cover rounded border border-rule flex-shrink-0"
                            />
                          )}
                          <span className="flex-1">
                            <span className="text-dark">{v.title}</span>
                            {v.channel.length > 0 && (
                              <span className="text-meta"> — {v.channel}</span>
                            )}{" "}
                            <a
                              href={v.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-0.5 text-teal hover:text-teal-dark"
                              aria-label={`Ouvrir la vidéo « ${v.title} » dans un nouvel onglet`}
                            >
                              <ExternalLink size={11} />
                            </a>
                          </span>
                        </label>
                      ))}
                      {resources.videoSearches.map((s, i) => (
                        <label
                          key={s.url}
                          className="flex items-start gap-2 text-sm py-1 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 accent-teal"
                            checked={checkedSearches.has(i)}
                            onChange={() => {
                              toggleIndex(
                                checkedSearches,
                                setCheckedSearches,
                                i,
                              );
                            }}
                          />
                          <span className="flex-1 text-mid">
                            Lien de recherche : «&nbsp;{s.query}&nbsp;»{" "}
                            <a
                              href={s.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-0.5 text-teal hover:text-teal-dark"
                              aria-label={`Ouvrir la recherche YouTube « ${s.query} » dans un nouvel onglet`}
                            >
                              <ExternalLink size={11} />
                            </a>
                          </span>
                        </label>
                      ))}
                      {resources.videos.length === 0 && (
                        <p className="text-xs text-meta">
                          Recherche YouTube non configurée côté serveur — des
                          liens de recherche sont proposés à la place de vidéos
                          précises.
                        </p>
                      )}
                    </fieldset>
                  )}

                  {resources.images.length > 0 && (
                    <fieldset className="space-y-1.5">
                      <legend className="text-xs font-semibold uppercase tracking-wider text-meta mb-1">
                        Images libres de droits
                      </legend>
                      {resources.images.map((img, i) => (
                        <label
                          key={img.imageUrl}
                          className="flex items-start gap-2 text-sm py-1 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 accent-teal"
                            checked={checkedImages.has(i)}
                            onChange={() => {
                              toggleIndex(checkedImages, setCheckedImages, i);
                            }}
                          />
                          <img
                            src={img.thumbnailUrl ?? img.imageUrl}
                            alt=""
                            className="h-14 w-20 object-cover rounded border border-rule flex-shrink-0"
                          />
                          <span className="flex-1">
                            <span className="text-dark">{img.title}</span>
                            <span className="text-meta">
                              {img.creator !== null && ` — ${img.creator}`} ·
                              licence {img.license}
                            </span>{" "}
                            {img.pageUrl !== null && (
                              <a
                                href={img.pageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-0.5 text-teal hover:text-teal-dark"
                                aria-label={`Ouvrir la page source de l'image « ${img.title} » dans un nouvel onglet`}
                              >
                                <ExternalLink size={11} />
                              </a>
                            )}
                          </span>
                        </label>
                      ))}
                    </fieldset>
                  )}

                  {resources.articles.length === 0 &&
                    resources.references.length === 0 &&
                    resources.videos.length === 0 &&
                    resources.videoSearches.length === 0 &&
                    resources.images.length === 0 && (
                      <p className="text-xs text-meta">
                        Aucune ressource trouvée pour ce sujet — réessayez avec
                        un titre de leçon plus précis.
                      </p>
                    )}
                </div>
              )}
              {resourcesError.length > 0 && (
                <p className="text-xs text-destructive">{resourcesError}</p>
              )}
              <div className="flex flex-wrap gap-2">
                {resources === null ? (
                  <Button
                    size="sm"
                    disabled={resourcesLoading}
                    onClick={() => {
                      void handleGenerateResources();
                    }}
                  >
                    {resourcesLoading ? (
                      <Loader2 size={13} className="mr-1.5 animate-spin" />
                    ) : (
                      <Sparkles size={13} className="mr-1.5" />
                    )}
                    {resourcesLoading
                      ? "Recherche…"
                      : "Rechercher des ressources"}
                  </Button>
                ) : (
                  <>
                    <Button
                      size="sm"
                      disabled={selectionCount === 0}
                      onClick={handleInsertResources}
                    >
                      Insérer la sélection ({String(selectionCount)})
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        void handleGenerateResources();
                      }}
                    >
                      Relancer la recherche
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
