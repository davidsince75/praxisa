import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  Trash2,
  ChevronDown,
  ChevronRight,
  Plus,
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
  const deleteMutation = useMutation({
    mutationFn: (questionId: string) =>
      api.delete("/exercises/" + exerciseId + "/questions/" + questionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
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
  const questions = data?.questions ?? [];
  return (
    <div className="space-y-2">
      {isLoading && <p className="text-[10px] text-meta">Chargement&hellip;</p>}
      {questions.length > 0 && (
        <div className="space-y-1">
          {questions.map((q, i) => (
            <QuestionRow
              key={q.id}
              index={i}
              questionText={q.questionText}
              options={q.options}
              correctOptionId={q.correctOptionId}
              onDelete={() => {
                deleteMutation.mutate(q.id);
              }}
            />
          ))}
        </div>
      )}
      {questions.length === 0 && !isLoading && !aiOpen && (
        <p className="text-[10px] text-meta italic py-1">
          Aucune question QCM.
        </p>
      )}
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
          {suggestions !== null && suggestions.length > 0 && (
            <div className="space-y-2 pt-1">
              <p className="text-[10px] text-meta">
                {String(suggestions.length) +
                  " question" +
                  (suggestions.length !== 1 ? "s" : "") +
                  " — vérifiez avant de créer :"}
              </p>
              {suggestions.map((q, i) => (
                <div
                  key={i}
                  className="bg-white border border-blue-100 rounded p-2 space-y-1"
                >
                  <p className="text-xs font-medium text-dark">
                    {String(i + 1) + ". " + q.questionText}
                  </p>
                  <ul className="space-y-0.5 pl-2">
                    {q.options.map((opt) => (
                      <li
                        key={opt.id}
                        className={
                          opt.id === q.correctOptionId
                            ? "text-[10px] text-teal font-bold"
                            : "text-[10px] text-meta"
                        }
                      >
                        {(opt.id === q.correctOptionId ? "✓ " : "  ") +
                          opt.text}
                      </li>
                    ))}
                  </ul>
                  {q.explanation.length > 0 && (
                    <p className="text-[10px] text-meta italic">
                      {q.explanation}
                    </p>
                  )}
                </div>
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

interface QuestionRowProps {
  index: number;
  questionText: string;
  options: { id: string; text: string }[];
  correctOptionId?: string;
  onDelete: () => void;
}

function QuestionRow({
  index,
  questionText,
  options,
  correctOptionId,
  onDelete,
}: QuestionRowProps) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-white border border-slate-200 rounded overflow-hidden">
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
          onClick={onDelete}
          className="text-meta hover:text-rose transition-colors p-0.5"
          title="Supprimer"
        >
          <Trash2 size={11} />
        </button>
      </div>
      {expanded && (
        <div className="px-5 pb-2 space-y-0.5">
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
        </div>
      )}
    </div>
  );
}
