import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { api } from "@/lib/api.js";
import type { MyRatingResponse } from "@/lib/api.js";

// ── Course rating card ────────────────────────────────────────────────────────

interface CourseRatingCardProps {
  courseId: string;
}

export function CourseRatingCard({ courseId }: CourseRatingCardProps) {
  const queryClient = useQueryClient();
  const [hovered, setHovered] = useState(0);
  const [selected, setSelected] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { data } = useQuery<MyRatingResponse>({
    queryKey: ["my-rating", courseId],
    queryFn: () => api.get<MyRatingResponse>(`/courses/${courseId}/my-rating`),
  });

  useEffect(() => {
    if (data?.rating !== null && data?.rating !== undefined && selected === 0) {
      setSelected(data.rating.rating);
      setComment(data.rating.comment ?? "");
    }
  }, [data, selected]);

  const mutation = useMutation({
    mutationFn: (body: { rating: number; comment?: string }) =>
      api.post<{ rating: unknown }>(`/courses/${courseId}/ratings`, body),
    onSuccess: () => {
      setSubmitted(true);
      void queryClient.invalidateQueries({
        queryKey: ["my-rating", courseId],
      });
    },
  });

  const hasExisting = data?.rating !== null && data?.rating !== undefined;
  const display = hovered > 0 ? hovered : selected;

  return (
    <div className="p-4 border-t border-rule">
      <p className="text-[11px] font-bold uppercase tracking-wider text-meta mb-2">
        Évaluer ce cours
      </p>
      {submitted ? (
        <p className="text-xs text-teal font-medium">
          Merci pour votre évaluation !
        </p>
      ) : (
        <>
          <div className="flex gap-1 mb-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onMouseEnter={() => {
                  setHovered(n);
                }}
                onMouseLeave={() => {
                  setHovered(0);
                }}
                onClick={() => {
                  setSelected(n);
                }}
                className="p-0.5"
              >
                <Star
                  size={16}
                  className={
                    n <= display
                      ? "text-yellow-400 fill-yellow-400"
                      : "text-meta/30"
                  }
                />
              </button>
            ))}
          </div>
          <textarea
            className="w-full rounded border border-rule bg-cream/40 px-2 py-1.5 text-xs text-dark resize-none focus:outline-none focus:ring-1 focus:ring-teal placeholder:text-meta/40"
            rows={2}
            maxLength={500}
            placeholder="Commentaire (optionnel)"
            value={comment}
            onChange={(e) => {
              setComment(e.target.value);
            }}
          />
          <button
            disabled={selected === 0 || mutation.isPending}
            onClick={() => {
              mutation.mutate({
                rating: selected,
                ...(comment.trim().length > 0
                  ? { comment: comment.trim() }
                  : {}),
              });
            }}
            className="mt-2 w-full text-[11px] font-bold uppercase tracking-wider text-center py-1.5 rounded bg-teal/20 text-teal hover:bg-teal/30 disabled:opacity-40 transition-colors"
          >
            {mutation.isPending
              ? "Envoi…"
              : hasExisting
                ? "Modifier votre évaluation"
                : "Envoyer"}
          </button>
        </>
      )}
    </div>
  );
}
