import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api.js";
import type { ExerciseWithQuestions, QuizAttemptResult } from "@/lib/api.js";
import { Button } from "@/components/ui/button.js";
import { cn } from "@/lib/utils.js";

// ── Quiz component ─────────────────────────────────────────────────────────────

interface QuizProps {
  exerciseId: string;
  enrolmentId: string;
  onComplete: () => void;
}

export function Quiz({ exerciseId, enrolmentId, onComplete }: QuizProps) {
  const queryClient = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QuizAttemptResult | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["exercise", exerciseId],
    queryFn: () => api.get<ExerciseWithQuestions>(`/exercises/${exerciseId}`),
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      api.post<QuizAttemptResult>(`/exercises/${exerciseId}/attempt`, {
        enrolmentId,
        answers,
      }),
    onSuccess: (res) => {
      setResult(res);
      if (res.passed) {
        void queryClient.invalidateQueries({
          queryKey: ["enrolment", enrolmentId],
        });
        onComplete();
      }
    },
  });

  if (isLoading) {
    return <p className="text-meta text-sm">Chargement du quiz…</p>;
  }

  if (data === undefined || data.questions.length === 0) {
    return (
      <p className="text-meta text-sm italic">Aucune question disponible.</p>
    );
  }

  const { questions } = data;
  const allAnswered = questions.every((q) => q.id in answers);

  if (result !== null) {
    return (
      <div className="space-y-4">
        <div
          className={cn(
            "rounded border px-5 py-4",
            result.passed
              ? "border-teal/30 bg-teal/5"
              : "border-rose/30 bg-rose/5",
          )}
        >
          <p className="font-semibold text-dark mb-1">
            {result.passed ? "Bravo ! Quiz réussi." : "Quiz non validé."}
          </p>
          <p className="text-sm text-meta">
            Score : {String(result.score)} / {String(result.maxScore)} (
            {String(Math.round((result.score / result.maxScore) * 100))}%)
          </p>
          {!result.passed && (
            <p className="text-xs text-meta mt-1">
              Score minimum requis : 70%. Réessayez.
            </p>
          )}
        </div>

        {/* Per-question feedback */}
        <div className="space-y-3">
          {result.feedback.map((fb, i) => {
            const q = questions.find((qq) => qq.id === fb.questionId);
            return (
              <div
                key={fb.questionId}
                className={cn(
                  "rounded border px-4 py-3 text-sm",
                  fb.correct
                    ? "border-teal/20 bg-teal/5"
                    : "border-rose/20 bg-rose/5",
                )}
              >
                <p className="font-medium text-dark mb-1">
                  {String(i + 1)}. {q?.questionText ?? ""}
                </p>
                <p className={fb.correct ? "text-teal" : "text-rose"}>
                  {fb.correct ? "✓ Correct" : "✗ Incorrect"}
                </p>
                {!fb.correct && fb.explanation !== null && (
                  <p className="text-meta text-xs mt-1">{fb.explanation}</p>
                )}
              </div>
            );
          })}
        </div>

        {!result.passed && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setAnswers({});
              setResult(null);
            }}
          >
            Réessayer
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-meta">
        {String(questions.length)} question{questions.length !== 1 ? "s" : ""} ·
        Score minimum pour valider : 70%
      </p>

      {questions.map((q, qi) => (
        <div key={q.id} className="space-y-3">
          <p className="text-sm font-medium text-dark">
            {String(qi + 1)}. {q.questionText}
          </p>
          <div className="space-y-2">
            {q.options.map((opt) => (
              <label
                key={opt.id}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 border rounded cursor-pointer transition-colors",
                  answers[q.id] === opt.id
                    ? "border-teal bg-teal/5 text-dark"
                    : "border-rule bg-white/50 text-meta hover:border-teal/40",
                )}
              >
                <input
                  type="radio"
                  name={q.id}
                  value={opt.id}
                  checked={answers[q.id] === opt.id}
                  onChange={() => {
                    setAnswers((a) => ({ ...a, [q.id]: opt.id }));
                  }}
                  className="accent-teal"
                />
                <span className="text-sm">{opt.text}</span>
              </label>
            ))}
          </div>
        </div>
      ))}

      <Button
        size="sm"
        disabled={!allAnswered || submitMutation.isPending}
        onClick={() => {
          submitMutation.mutate();
        }}
      >
        {submitMutation.isPending ? "Correction…" : "Soumettre le quiz"}
      </Button>
    </div>
  );
}
