import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MessageCircle, Pin, Lock, Send } from "lucide-react";
import { api } from "@/lib/api.js";
import type { ForumThreadDetailResponse, ForumReplyRow } from "@/lib/api.js";
import { Button } from "@/components/ui/button.js";
import { Badge } from "@/components/ui/badge.js";
import { Card, CardContent } from "@/components/ui/card.js";

function ReplyCard({ reply }: { reply: ForumReplyRow }) {
  const roleLabel =
    reply.authorRole === "instructor"
      ? "Formateur"
      : reply.authorRole === "admin"
        ? "Admin"
        : "";

  return (
    <div className="border-b border-rule last:border-0 px-4 py-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-semibold text-dark">
          {reply.authorFirstName} {reply.authorLastName}
        </span>
        {roleLabel.length > 0 && <Badge variant="default">{roleLabel}</Badge>}
        <span className="text-xs text-meta">
          {new Date(reply.createdAt).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
      <p className="text-sm text-dark whitespace-pre-wrap">{reply.body}</p>
    </div>
  );
}

export function ForumThreadPage({ backPath }: { backPath: string }) {
  const { threadId } = useParams<{ threadId: string }>();
  const qc = useQueryClient();
  const [replyBody, setReplyBody] = useState("");
  const [error, setError] = useState("");

  const { data, isLoading } = useQuery<ForumThreadDetailResponse>({
    queryKey: ["forum-thread", threadId],
    queryFn: () =>
      api.get<ForumThreadDetailResponse>(`/forums/${threadId ?? ""}`),
    enabled: threadId !== undefined,
  });

  const replyMutation = useMutation({
    mutationFn: () =>
      api.post(`/forums/${threadId ?? ""}/replies`, { body: replyBody }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["forum-thread", threadId] });
      setReplyBody("");
      setError("");
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : "Erreur");
    },
  });

  const thread = data?.thread;
  const replies = data?.replies ?? [];

  if (isLoading) {
    return <p className="text-meta text-sm">Chargement&hellip;</p>;
  }

  if (thread === undefined) {
    return (
      <div className="space-y-4">
        <Link
          to={backPath}
          className="inline-flex items-center gap-1 text-sm text-teal hover:underline"
        >
          <ArrowLeft size={14} />
          Retour
        </Link>
        <p className="text-rose text-sm">Discussion introuvable.</p>
      </div>
    );
  }

  const roleLabel =
    thread.authorRole === "instructor"
      ? "Formateur"
      : thread.authorRole === "admin"
        ? "Admin"
        : "";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link
        to={backPath}
        className="inline-flex items-center gap-1 text-sm text-teal hover:underline"
      >
        <ArrowLeft size={14} />
        Retour au forum
      </Link>

      {/* Thread header */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            {thread.isPinned && <Pin size={13} className="text-amber-500" />}
            {thread.isLocked && <Lock size={13} className="text-meta" />}
            <h1 className="text-lg font-semibold text-dark">{thread.title}</h1>
          </div>
          <div className="flex items-center gap-2 text-xs text-meta">
            <span>
              {thread.authorFirstName} {thread.authorLastName}
            </span>
            {roleLabel.length > 0 && (
              <Badge variant="default">{roleLabel}</Badge>
            )}
            <span>&middot;</span>
            <span>
              {new Date(thread.createdAt).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <p className="text-sm text-dark whitespace-pre-wrap">{thread.body}</p>
        </CardContent>
      </Card>

      {/* Replies */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-meta mb-3 flex items-center gap-2">
          <MessageCircle size={14} />
          {String(replies.length)} r&eacute;ponse
          {replies.length !== 1 ? "s" : ""}
        </h2>
        {replies.length > 0 && (
          <Card>
            <CardContent className="p-0">
              {replies.map((r) => (
                <ReplyCard key={r.id} reply={r} />
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Reply form */}
      {!thread.isLocked && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <textarea
              value={replyBody}
              onChange={(e) => {
                setReplyBody(e.target.value);
              }}
              rows={3}
              className="w-full rounded-md border border-rule px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-teal"
              placeholder="Votre r&eacute;ponse…"
            />
            {error.length > 0 && <p className="text-xs text-rose">{error}</p>}
            <Button
              size="sm"
              disabled={
                replyMutation.isPending || replyBody.trim().length === 0
              }
              onClick={() => {
                replyMutation.mutate();
              }}
            >
              <Send size={13} className="mr-1.5" />
              {replyMutation.isPending ? "Envoi…" : "Répondre"}
            </Button>
          </CardContent>
        </Card>
      )}

      {thread.isLocked && (
        <p className="text-sm text-meta text-center py-4">
          <Lock size={13} className="inline mr-1" />
          Cette discussion est verrouill&eacute;e.
        </p>
      )}
    </div>
  );
}
