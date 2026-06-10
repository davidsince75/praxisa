import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PenLine, Calendar } from "lucide-react";
import { api } from "@/lib/api.js";
import type { SubmissionResponse, Submission } from "@/lib/api.js";
import { Button } from "@/components/ui/button.js";
import { cn } from "@/lib/utils.js";

// ── Submission form (assignment / reflection) ──────────────────────────────────

interface SubmissionFormProps {
  exerciseId: string;
  enrolmentId: string;
  exerciseTitle: string;
  exerciseType: string;
  dueAt: string | null;
}

export function SubmissionForm({
  exerciseId,
  enrolmentId,
  exerciseTitle,
  exerciseType,
  dueAt,
}: SubmissionFormProps) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [saved, setSaved] = useState<Submission | null>(null);

  const { data: existing } = useQuery<SubmissionResponse>({
    queryKey: ["submission", enrolmentId, exerciseId],
    queryFn: () =>
      api.get<SubmissionResponse>(
        `/enrolments/${enrolmentId}/exercises/${exerciseId}/submission`,
      ),
    retry: false,
  });

  useEffect(() => {
    if (existing?.submission !== undefined && body === "") {
      setBody(existing.submission.body);
      setSaved(existing.submission);
    }
  }, [existing, body]);

  const submitMutation = useMutation({
    mutationFn: () =>
      api.post<SubmissionResponse>(
        `/enrolments/${enrolmentId}/exercises/${exerciseId}/submit`,
        { body },
      ),
    onSuccess: (data) => {
      setSaved(data.submission);
      void queryClient.invalidateQueries({
        queryKey: ["submission", enrolmentId, exerciseId],
      });
    },
  });

  const typeLabel = exerciseType === "assignment" ? "Devoir" : "Réflexion";

  return (
    <div className="border border-slate-200 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <PenLine size={15} className="text-teal" />
          {typeLabel} : {exerciseTitle}
        </div>
        {dueAt !== null && (
          <span
            className={cn(
              "flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded",
              new Date(dueAt) < new Date()
                ? "text-rose bg-rose/10"
                : "text-meta bg-cream",
            )}
          >
            <Calendar size={10} />
            {new Date(dueAt).toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </span>
        )}
      </div>

      {saved !== null && saved.status === "graded" && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 space-y-1">
          <p className="text-xs font-bold text-teal uppercase tracking-wider">
            Note reçue
          </p>
          {saved.score !== null && (
            <p className="text-sm font-semibold text-slate-800">
              Score : {saved.score.toString()}
            </p>
          )}
          {saved.feedback !== null && (
            <p className="text-sm text-slate-700">{saved.feedback}</p>
          )}
        </div>
      )}

      {saved !== null && saved.status === "submitted" && (
        <p className="text-xs text-amber-600 font-medium">
          Réponse soumise — en attente de correction.
        </p>
      )}

      <textarea
        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        rows={6}
        placeholder="Rédigez votre réponse ici…"
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
        }}
        disabled={saved?.status === "graded"}
      />

      {saved?.status !== "graded" && (
        <Button
          size="sm"
          disabled={submitMutation.isPending || !body.trim()}
          onClick={() => {
            submitMutation.mutate();
          }}
        >
          <PenLine size={13} className="mr-1.5" />
          {submitMutation.isPending
            ? "Envoi…"
            : saved !== null
              ? "Soumettre à nouveau"
              : "Soumettre"}
        </Button>
      )}
    </div>
  );
}
