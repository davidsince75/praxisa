import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Inbox,
  RefreshCw,
  ArrowLeft,
  Send,
  Sparkles,
  Loader2,
  Unplug,
  Link2,
  MailOpen,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button.js";
import { Badge } from "@/components/ui/badge.js";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.js";
import { api } from "@/lib/api.js";
import type {
  GmailStatus,
  GmailAuthUrlResponse,
  GmailMessagesResponse,
  GmailMessageDetail,
  GmailAiDraftResponse,
} from "@/lib/api.js";

// ── Helpers ─────────────────────────────────────────────────────────────────────

function extractSenderName(from: string): string {
  const match = from.match(/^"?([^"<]+)"?\s*</);
  return match ? match[1].trim() : (from.split("@")[0] ?? from);
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "À l’instant";
  if (mins < 60) return `Il y a ${String(mins)} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Il y a ${String(hrs)}h`;
  const days = Math.floor(hrs / 24);
  return `Il y a ${String(days)}j`;
}

// ── Connect card ────────────────────────────────────────────────────────────────

function ConnectCard() {
  const [error, setError] = useState("");

  const authUrlMutation = useMutation({
    mutationFn: () => api.get<GmailAuthUrlResponse>("/gmail/auth-url"),
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      if (message.includes("manquante") || message.includes("501")) {
        setError(
          "Les variables d'environnement Google (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET) ne sont pas configurées.",
        );
      } else {
        setError(message);
      }
    },
  });

  return (
    <Card className="max-w-lg mx-auto mt-12">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 size={18} />
          Connecter Gmail
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-meta">
          Connectez le compte Gmail d&apos;admissions pour consulter et
          r&eacute;pondre aux emails directement depuis Psychostudy.
        </p>
        {error.length > 0 && (
          <p className="text-xs text-rose bg-rose/10 rounded-md px-3 py-2">
            {error}
          </p>
        )}
        <Button
          onClick={() => {
            setError("");
            authUrlMutation.mutate();
          }}
          disabled={authUrlMutation.isPending}
        >
          {authUrlMutation.isPending && (
            <Loader2 size={14} className="mr-2 animate-spin" />
          )}
          Autoriser l&apos;acc&egrave;s Gmail
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Message list ────────────────────────────────────────────────────────────────

interface MessageListProps {
  onSelect: (id: string) => void;
}

function MessageList({ onSelect }: MessageListProps) {
  const [searchQ, setSearchQ] = useState("");
  const [pageTokens, setPageTokens] = useState<string[]>([]);
  const currentToken = pageTokens[pageTokens.length - 1];

  const params = new URLSearchParams();
  if (searchQ.trim()) {
    params.set("q", searchQ.trim());
  }
  if (currentToken) {
    params.set("pageToken", currentToken);
  }

  const { data, isLoading, refetch } = useQuery<GmailMessagesResponse>({
    queryKey: ["gmail-messages", searchQ, currentToken],
    queryFn: () =>
      api.get<GmailMessagesResponse>(
        `/gmail/messages${params.toString() ? `?${params.toString()}` : ""}`,
      ),
  });

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={searchQ}
          onChange={(e) => {
            setSearchQ(e.target.value);
            setPageTokens([]);
          }}
          placeholder="Rechercher dans Gmail…"
          className="flex-1 rounded-md border border-rule bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal/40"
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            void refetch();
          }}
        >
          <RefreshCw size={14} />
        </Button>
      </div>

      {/* Messages */}
      {isLoading && (
        <div className="flex items-center justify-center py-12 text-meta">
          <Loader2 size={20} className="animate-spin" />
        </div>
      )}

      {data?.messages.length === 0 && !isLoading && (
        <p className="text-center text-meta py-8">Aucun email trouv&eacute;</p>
      )}

      <div className="divide-y divide-rule rounded-lg border border-rule bg-white overflow-hidden">
        {(data?.messages ?? []).map((m) => (
          <button
            key={m.id}
            onClick={() => {
              onSelect(m.id);
            }}
            className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${m.isUnread ? "bg-teal/5" : ""}`}
          >
            <div className="flex items-center gap-2 mb-0.5">
              {m.isUnread ? (
                <Mail size={13} className="text-teal shrink-0" />
              ) : (
                <MailOpen size={13} className="text-meta shrink-0" />
              )}
              <span
                className={`text-sm truncate ${m.isUnread ? "font-semibold text-dark" : "text-slate-700"}`}
              >
                {extractSenderName(m.from)}
              </span>
              <span className="ml-auto text-[11px] text-meta shrink-0">
                {relativeTime(m.date)}
              </span>
            </div>
            <p
              className={`text-sm truncate ${m.isUnread ? "font-medium text-slate-800" : "text-slate-600"}`}
            >
              {m.subject || "(sans objet)"}
            </p>
            <p className="text-xs text-meta truncate mt-0.5">{m.snippet}</p>
          </button>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          disabled={pageTokens.length === 0}
          onClick={() => {
            setPageTokens((prev) => prev.slice(0, -1));
          }}
        >
          Pr&eacute;c&eacute;dent
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!data?.nextPageToken}
          onClick={() => {
            const token = data?.nextPageToken;
            if (token) {
              setPageTokens((prev) => [...prev, token]);
            }
          }}
        >
          Suivant
        </Button>
      </div>
    </div>
  );
}

// ── Message detail ──────────────────────────────────────────────────────────────

interface MessageDetailProps {
  messageId: string;
  onBack: () => void;
}

function MessageDetail({ messageId, onBack }: MessageDetailProps) {
  const queryClient = useQueryClient();
  const [replyBody, setReplyBody] = useState("");
  const [showReply, setShowReply] = useState(false);

  const { data: msg, isLoading } = useQuery<GmailMessageDetail>({
    queryKey: ["gmail-message", messageId],
    queryFn: () => api.get<GmailMessageDetail>(`/gmail/messages/${messageId}`),
  });

  const aiDraftMutation = useMutation({
    mutationFn: () =>
      api.post<GmailAiDraftResponse>("/gmail/ai-draft", {
        emailSubject: msg?.subject ?? "",
        emailBody: msg?.body ?? "",
      }),
    onSuccess: (data) => {
      setReplyBody(data.draft);
      setShowReply(true);
    },
  });

  const replyMutation = useMutation({
    mutationFn: () =>
      api.post(`/gmail/messages/${messageId}/reply`, { body: replyBody }),
    onSuccess: () => {
      setReplyBody("");
      setShowReply(false);
      void queryClient.invalidateQueries({ queryKey: ["gmail-messages"] });
    },
  });

  if (isLoading || !msg) {
    return (
      <div className="flex items-center justify-center py-12 text-meta">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft size={16} />
        </Button>
        <h2 className="text-lg font-semibold text-dark truncate flex-1">
          {msg.subject || "(sans objet)"}
        </h2>
      </div>

      {/* Meta */}
      <div className="rounded-lg border border-rule bg-white p-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-dark">{msg.from}</span>
          <span className="text-meta text-xs">
            {new Date(msg.date).toLocaleString("fr-FR")}
          </span>
        </div>
        <p className="text-xs text-meta">&Agrave; : {msg.to}</p>
      </div>

      {/* Body */}
      <div
        className="rounded-lg border border-rule bg-white p-4 prose prose-sm max-w-none text-dark overflow-auto max-h-[50vh]"
        dangerouslySetInnerHTML={{ __html: msg.body }}
      />

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setShowReply(true);
          }}
        >
          <Send size={14} className="mr-1" />
          R&eacute;pondre
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            aiDraftMutation.mutate();
          }}
          disabled={aiDraftMutation.isPending}
        >
          {aiDraftMutation.isPending ? (
            <Loader2 size={14} className="mr-1 animate-spin" />
          ) : (
            <Sparkles size={14} className="mr-1" />
          )}
          Brouillon IA
        </Button>
      </div>

      {/* Reply form */}
      {showReply && (
        <div className="rounded-lg border border-rule bg-white p-4 space-y-3">
          <textarea
            value={replyBody}
            onChange={(e) => {
              setReplyBody(e.target.value);
            }}
            rows={8}
            className="w-full rounded-md border border-rule px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal/40 resize-none"
            placeholder="Votre réponse…"
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => {
                replyMutation.mutate();
              }}
              disabled={replyMutation.isPending || !replyBody.trim()}
            >
              {replyMutation.isPending ? (
                <Loader2 size={14} className="mr-1 animate-spin" />
              ) : (
                <Send size={14} className="mr-1" />
              )}
              Envoyer
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowReply(false);
                setReplyBody("");
              }}
            >
              Annuler
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────────

export function AdminEmailPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: status, isLoading: statusLoading } = useQuery<GmailStatus>({
    queryKey: ["gmail-status"],
    queryFn: () => api.get<GmailStatus>("/gmail/status"),
  });

  const disconnectMutation = useMutation({
    mutationFn: () => api.delete("/gmail/disconnect"),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["gmail-status"] });
    },
  });

  if (statusLoading) {
    return (
      <div className="p-6 flex items-center justify-center py-20 text-meta">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  if (!status?.connected) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold text-dark mb-4 flex items-center gap-2">
          <Inbox size={22} />
          Admissions
        </h1>
        <ConnectCard />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-dark flex items-center gap-2">
          <Inbox size={22} />
          Admissions
        </h1>
        <div className="flex items-center gap-2">
          <Badge variant="completed">{status.email}</Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              disconnectMutation.mutate();
            }}
            title="Déconnecter Gmail"
          >
            <Unplug size={14} />
          </Button>
        </div>
      </div>

      {/* Content */}
      {selectedId ? (
        <MessageDetail
          messageId={selectedId}
          onBack={() => {
            setSelectedId(null);
          }}
        />
      ) : (
        <MessageList
          onSelect={(id) => {
            setSelectedId(id);
          }}
        />
      )}
    </div>
  );
}
