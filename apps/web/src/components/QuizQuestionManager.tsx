import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  Trash2,
  ChevronDown,
  ChevronRight,
  Plus,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { api } from "@/lib/api.js";
import type {
  ExerciseWithQuestions,
  AIMCQResponse,
  AIMCQQuestion,
  CreateQuestionsResponse,
} from "@/lib/api.js";
import { Button } from "@/components/ui/button.js";

interface QuizQuestionManagerProps {
  exerciseId: string;
}

// ── Editable suggestion row (before creation) ─────────────────────────────────

interface EditableSuggestionProps {
  index: number;
  question: AIMCQQuestion;
  onChange: (updated: AIMCQQuestion) => void;
}

function EditableSuggestion({
  index,
  question,
  onChange,
}: EditableSuggestionProps) {
  return (
    <div className="bg-white border border-blue-100 rounded p-2 space-y-2">
      <textarea
        rows={2}
        value={question.questionText}
        onChange={(e) => {
          onChange({ ...question, questionText: e.target.value });
        }}
        className="w-full text-xs border border-slate-200 rounded px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400 text-dark font-medium"
        placeholder={"Question " + String(index + 1)}
      />
      <div className="space-y-1">
        {question.options.map((opt) => (
          <div key={opt.id} className="flex items-center gap-1.5">
            <input
              type="radio"
              name={"correct-" + String(index)}
              checked={opt.id === question.correctOptionId}
              onChange={() => {
                onChange({ ...question, correctOptionId: opt.id });
              }}
              className="accent-teal shrink-0"
              title="Bonne reponse"
            />
            <input
              type="text"
              value={opt.text}
              onChange={(e) => {
                const newOpts = question.options.map((o) =>
                  o.id === opt.id ? { ...o, text: e.target.value } : o,
                );
                onChange({ ...question, options: newOpts });
              }}
              className={
                "flex-1 text-[10px] border rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-300 " +
                (opt.id === question.correctOptionId
                  ? "border-teal/50 text-teal font-bold"
                  : "border-slate-200 text-meta")
              }
            />
          </div>
        ))}
      </div>
      {question.explanation.length > 0 && (
        <textarea
          rows={1}
          value={question.explanation}
          onChange={(e) => {
            onChange({ ...question, explanation: e.target.value });
          }}
          className="w-full text-[10px] border border-slate-200 rounded px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-blue-300 text-meta italic"
          placeholder="Explication"
        />
      )}
    </div>
  );
}

// ── Existing question row (after creation) ────────────────────────────────────

interface QuestionOption {
  id: string;
  text: string;
}

interface QuestionRowProps {
  exerciseId: string;
  questionId: string;
  index: number;
  questionText: string;
  options: QuestionOption[];
  correctOptionId?: string;
  explanation?: string | null;
  onDeleted: () => void;
  onUpdated: () => void;
}

function QuestionRow({
  exerciseId,
  questionId,
  index,
  questionText,
  options,
  correctOptionId,
  explanation,
  onDeleted,
  onUpdated,
}: QuestionRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(questionText);
  const [editOptions, setEditOptions] = useState<QuestionOption[]>(options);
  const [editCorrect, setEditCorrect] = useState(correctOptionId ?? "");
  const [editExplanation, setEditExplanation] = useState(explanation ?? "");
  const [saveError, setSaveError] = useState("");

  const patchMutation = useMutation({
    mutationFn: () =>
      api.patch("/exercises/" + exerciseId + "/questions/" + questionId, {
        questionText: editText,
        options: editOptions,
        correctOptionId: editCorrect,
        explanation: editExplanation.length > 0 ? editExplanation : null,
      }),
    onSuccess: () => {
      setEditing(false);
      setSaveError("");
      onUpdated();
    },
    onError: (err: unknown) => {
      setSaveError(err instanceof Error ? err.message : "Erreur");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      api.delete("/exercises/" + exerciseId + "/questions/" + questionId),
    onSuccess: () => {
      onDeleted();
    },
  });

  function startEdit(): void {
    setEditText(questionText);
    setEditOptions(options);
    setEditCorrect(correctOptionId ?? "");
    setEditExplanation(explanation ?? "");
    setSaveError("");
    setEditing(true);
    setExpanded(true);
  }

  function cancelEdit(): void {
    setEditing(false);
    setSaveError("");
  }

  return (
    <div className="bg-white border border-slate-200 rounded overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-2 px-2 py-1.5">
        <button
          onClick={() => {
            setExpanded((v) => !v);
          }}
          className="text-meta hover:text-dark transition-colors"
        >
          {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </button>
        <span className="flex-1 text-xs text-dark truncate">
          {String(index + 1) + ". " + questionText}
        </span>
        <button
          onClick={startEdit}
          className="text-meta hover:text-teal transition-colors p-0.5"
          title="Modifier"
        >
          <Pencil size={11} />
        </button>
        <button
          onClick={() => {
            deleteMutation.mutate();
          }}
          disabled={deleteMutation.isPending}
          className="text-meta hover:text-rose transition-colors p-0.5"
          title="Supprimer"
        >
          <Trash2 size={11} />
        </button>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="px-4 pb-3 space-y-2 border-t border-rule/50 pt-2">
          {editing ? (
            /* Edit form */
            <div className="space-y-2">
              <textarea
                rows={2}
                value={editText}
                onChange={(e) => {
                  setEditText(e.target.value);
                }}
                className="w-full text-xs border border-slate-200 rounded px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-teal text-dark"
                placeholder="Texte de la question"
              />
              <div className="space-y-1">
                {editOptions.map((opt) => (
                  <div key={opt.id} className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      name={"edit-correct-" + questionId}
                      checked={opt.id === editCorrect}
                      onChange={() => {
                        setEditCorrect(opt.id);
                      }}
                      className="accent-teal shrink-0"
                      title="Bonne reponse"
                    />
                    <input
                      type="text"
                      value={opt.text}
                      onChange={(e) => {
                        setEditOptions(
                          editOptions.map((o) =>
                            o.id === opt.id
                              ? { ...o, text: e.target.value }
                              : o,
                          ),
                        );
                      }}
                      className={
                        "flex-1 text-[10px] border rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 " +
                        (opt.id === editCorrect
                          ? "border-teal/50 text-teal font-bold focus:ring-teal/40"
                          : "border-slate-200 text-meta focus:ring-blue-300")
                      }
                    />
                  </div>
                ))}
              </div>
              <textarea
                rows={1}
                value={editExplanation}
                onChange={(e) => {
                  setEditExplanation(e.target.value);
                }}
                className="w-full text-[10px] border border-slate-200 rounded px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-blue-300 text-meta italic"
                placeholder="Explication (optionnel)"
              />
              {saveError.length > 0 && (
                <p className="text-[10px] text-rose">{saveError}</p>
              )}
              <div className="flex gap-1.5">
                <button
                  disabled={
                    patchMutation.isPending || editText.trim().length === 0
                  }
                  onClick={() => {
                    patchMutation.mutate();
                  }}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded bg-teal text-white hover:bg-teal/90 disabled:opacity-40 transition-colors"
                >
                  <Check size={10} />
                  {patchMutation.isPending ? "Sauvegarde…" : "Enregistrer"}
                </button>
                <button
                  onClick={cancelEdit}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded text-meta hover:text-dark transition-colors"
                >
                  <X size={10} />
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            /* Read-only view */
            <div className="space-y-0.5">
              {options.map((opt) => (
                <p
                  key={opt.id}
                  className={
                    opt.id === correctOptionId
                      ? "text-[10px] text-teal font-bold"
                      : "text-[10px] text-meta"
                  }
                >
                  {(opt.id === correctOptionId ? "✓ " : "  ") + opt.text}
                </p>
              ))}
              {explanation !== null &&
                explanation !== undefined &&
                explanation.length > 0 && (
                  <p className="text-[10px] text-meta/60 italic mt-1">
                    {explanation}
                  </p>
                )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function QuizQuestionManager({ exerciseId }: QuizQuestionManagerProps) {
  const queryClient = useQueryClient();
  const [aiOpen, setAiOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState("5");
  const [suggestions, setSuggestions] = useState<AIMCQQuestion[] | null>(null);
  const [aiError, setAiError] = useState("");
  const [generating, setGenerating] = useState(false);
  const queryKey = ["quiz-questions", exerciseId];

  const { data, isLoading } = useQuery<ExerciseWithQuestions>({
    queryKey,
    queryFn: () => api.get<ExerciseWithQuestions>("/exercises/" + exerciseId),
  });

  const createMutation = useMutation({
    mutationFn: (questions: AIMCQQuestion[]) =>
      api.post<CreateQuestionsResponse>(
        "/exercises/" + exerciseId + "/questions",
        { questions },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
      setSuggestions(null);
      setAiOpen(false);
      setTopic("");
    },
  });

  async function handleGenerate(): Promise<void> {
    if (topic.trim().length === 0) return;
    setGenerating(true);
    setAiError("");
    setSuggestions(null);
    try {
      const res = await api.post<AIMCQResponse>("/ai/generate-mcq", {
        topic: topic.trim(),
        count: Number(count),
      });
      setSuggestions(res.questions);
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : "Erreur IA");
    } finally {
      setGenerating(false);
    }
  }

  function updateSuggestion(index: number, updated: AIMCQQuestion): void {
    if (suggestions === null) return;
    const next = suggestions.map((q, i) => (i === index ? updated : q));
    setSuggestions(next);
  }

  function refetch(): void {
    void queryClient.invalidateQueries({ queryKey });
  }

  const questions = data?.questions ?? [];

  return (
    <div className="space-y-2">
      {isLoading && <p className="text-[10px] text-meta">Chargement&hellip;</p>}

      {/* Existing questions */}
      {questions.length > 0 && (
        <div className="space-y-1">
          {questions.map((q, i) => (
            <QuestionRow
              key={q.id}
              exerciseId={exerciseId}
              questionId={q.id}
              index={i}
              questionText={q.questionText}
              options={q.options}
              correctOptionId={q.correctOptionId}
              explanation={q.explanation}
              onDeleted={refetch}
              onUpdated={refetch}
            />
          ))}
        </div>
      )}

      {questions.length === 0 && !isLoading && !aiOpen && (
        <p className="text-[10px] text-meta italic py-1">
          Aucune question QCM.
        </p>
      )}

      {/* AI generation panel */}
      {aiOpen ? (
        <div className="bg-blue-50/60 border border-blue-200 rounded p-3 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
            Générer avec l&apos;IA
          </p>
          <input
            placeholder="Sujet ou thème des questions"
            value={topic}
            onChange={(e) => {
              setTopic(e.target.value);
            }}
            className="w-full h-8 px-2 text-xs border border-blue-200 rounded bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-meta shrink-0">Nombre :</label>
            <select
              value={count}
              onChange={(e) => {
                setCount(e.target.value);
              }}
              className="h-7 px-1.5 text-xs border border-slate-200 rounded bg-white text-slate-700"
            >
              {[3, 5, 7, 10].map((n) => (
                <option key={n} value={String(n)}>
                  {String(n)}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              disabled={generating || topic.trim().length === 0}
              onClick={() => {
                void handleGenerate();
              }}
              className="ml-auto h-7 text-xs"
            >
              <Sparkles size={11} className="mr-1" />
              {generating ? "Génération…" : "Générer"}
            </Button>
            <button
              onClick={() => {
                setAiOpen(false);
                setSuggestions(null);
                setAiError("");
              }}
              className="text-meta hover:text-dark text-xs"
            >
              Annuler
            </button>
          </div>
          {aiError.length > 0 && (
            <p className="text-[10px] text-rose">{aiError}</p>
          )}

          {/* Editable suggestions */}
          {suggestions !== null && suggestions.length > 0 && (
            <div className="space-y-2 pt-1">
              <p className="text-[10px] text-meta">
                {String(suggestions.length) +
                  " question" +
                  (suggestions.length !== 1 ? "s" : "") +
                  " — modifiez si nécessaire, puis créez :"}
              </p>
              {suggestions.map((q, i) => (
                <EditableSuggestion
                  key={i}
                  index={i}
                  question={q}
                  onChange={(updated) => {
                    updateSuggestion(i, updated);
                  }}
                />
              ))}
              <Button
                size="sm"
                className="w-full h-7 text-xs"
                disabled={createMutation.isPending}
                onClick={() => {
                  createMutation.mutate(suggestions);
                }}
              >
                <Plus size={11} className="mr-1" />
                {createMutation.isPending
                  ? "Création…"
                  : "Créer ces " + String(suggestions.length) + " questions"}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={() => {
            setAiOpen(true);
          }}
          className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-600 hover:text-blue-700 transition-colors"
        >
          <Sparkles size={11} />
          Générer avec l&apos;IA
        </button>
      )}
    </div>
  );
}
