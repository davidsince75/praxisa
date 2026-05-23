import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Send, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api.js";
import type {
  MessageThreadsResponse,
  MessageThreadDetailResponse,
  SendMessageResponse,
  UserSearchResponse,
  UserSearchResult,
} from "@/lib/api.js";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface NewThreadFormProps {
  onSend: (recipientId: string, body: string) => void;
  sending: boolean;
}

function useDebounce(value: string, ms: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(value);
    }, ms);
    return () => {
      clearTimeout(t);
    };
  }, [value, ms]);
  return debounced;
}

function NewThreadForm({ onSend, sending }: NewThreadFormProps) {
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(
    null,
  );
  const [body, setBody] = useState("");

  const debouncedSearch = useDebounce(search, 300);

  const { data: searchData } = useQuery<UserSearchResponse>({
    queryKey: ["user-search", debouncedSearch],
    queryFn: () =>
      api.get<UserSearchResponse>(
        `/users/search?q=${encodeURIComponent(debouncedSearch)}`,
      ),
    enabled: debouncedSearch.length >= 2 && selectedUser === null,
  });

  const suggestions = searchData?.users ?? [];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedUser === null || !body.trim()) return;
    onSend(selectedUser.id, body.trim());
  }

  const ROLE_LABELS: Record<string, string> = {
    admin: "Admin",
    instructor: "Formateur",
    student: "Apprenant",
    migration_lead: "Migration",
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">
          Destinataire
        </label>
        {selectedUser !== null ? (
          <div className="flex items-center justify-between rounded-md border border-teal-200 bg-teal-50 px-3 py-2">
            <span className="text-sm font-medium text-slate-800">
              {selectedUser.firstName} {selectedUser.lastName}{" "}
              <span className="text-xs text-slate-500">
                ({selectedUser.email})
              </span>
            </span>
            <button
              type="button"
              onClick={() => {
                setSelectedUser(null);
                setSearch("");
              }}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Changer
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Rechercher par nom ou email…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
              }}
              autoFocus
            />
            {suggestions.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {suggestions.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      setSelectedUser(u);
                      setSearch("");
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0"
                  >
                    <span className="text-sm font-medium text-slate-800">
                      {u.firstName} {u.lastName}
                    </span>
                    <span className="text-xs text-slate-400 ml-2">
                      {u.email} · {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {debouncedSearch.length >= 2 && suggestions.length === 0 && (
              <p className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-400">
                Aucun utilisateur trouvé
              </p>
            )}
          </div>
        )}
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">
          Message
        </label>
        <textarea
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
          rows={4}
          placeholder="Votre message…"
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
          }}
        />
      </div>
      <Button
        type="submit"
        disabled={sending || selectedUser === null || !body.trim()}
      >
        <Send size={14} className="mr-1.5" />
        Envoyer
      </Button>
    </form>
  );
}

export function MessagingView({ currentUserId }: { currentUserId: string }) {
  const qc = useQueryClient();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [newThreadError, setNewThreadError] = useState<string | null>(null);

  // Thread list
  const { data: threadsData, isLoading: threadsLoading } =
    useQuery<MessageThreadsResponse>({
      queryKey: ["message-threads"],
      queryFn: () => api.get<MessageThreadsResponse>("/messages/threads"),
      refetchInterval: 15000,
    });

  // Selected thread detail
  const { data: threadDetail, isLoading: threadLoading } =
    useQuery<MessageThreadDetailResponse>({
      queryKey: ["message-thread", selectedThreadId],
      queryFn: () =>
        api.get<MessageThreadDetailResponse>(
          `/messages/threads/${selectedThreadId ?? ""}`,
        ),
      enabled: selectedThreadId !== null,
      refetchInterval: 8000,
    });

  // Reply in thread
  const replyMutation = useMutation({
    mutationFn: ({ threadId, body }: { threadId: string; body: string }) =>
      api.post<{ message: unknown }>(`/messages/threads/${threadId}/messages`, {
        body,
      }),
    onSuccess: () => {
      setReplyBody("");
      void qc.invalidateQueries({
        queryKey: ["message-thread", selectedThreadId],
      });
      void qc.invalidateQueries({ queryKey: ["message-threads"] });
    },
  });

  // New thread
  const newThreadMutation = useMutation({
    mutationFn: ({
      recipientId,
      body,
    }: {
      recipientId: string;
      body: string;
    }) =>
      api.post<SendMessageResponse>("/messages/threads", { recipientId, body }),
    onSuccess: (data) => {
      setComposing(false);
      setNewThreadError(null);
      void qc.invalidateQueries({ queryKey: ["message-threads"] });
      setSelectedThreadId(data.threadId);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Erreur lors de l'envoi";
      setNewThreadError(msg);
    },
  });

  function handleSelectThread(threadId: string) {
    setSelectedThreadId(threadId);
    setComposing(false);
    void qc.invalidateQueries({ queryKey: ["message-threads"] });
  }

  function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedThreadId || !replyBody.trim()) return;
    replyMutation.mutate({
      threadId: selectedThreadId,
      body: replyBody.trim(),
    });
  }

  const threads = threadsData?.threads ?? [];

  return (
    <div className="flex h-[calc(100vh-8rem)] border border-slate-200 rounded-xl overflow-hidden bg-white">
      {/* ── Sidebar: thread list ── */}
      <div className="w-80 flex-shrink-0 border-r border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800 text-sm">Messages</h2>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setComposing(true);
              setSelectedThreadId(null);
            }}
          >
            Nouveau
          </Button>
        </div>

        {threadsLoading && (
          <div className="p-4 text-sm text-slate-500">Chargement…</div>
        )}

        {!threadsLoading && threads.length === 0 && (
          <div className="p-6 text-center text-sm text-slate-400">
            <MessageSquare size={32} className="mx-auto mb-2 opacity-30" />
            Aucune conversation
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {threads.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                handleSelectThread(t.id);
              }}
              className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                selectedThreadId === t.id ? "bg-teal-50" : ""
              }`}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-sm font-medium text-slate-800 truncate">
                  {t.other
                    ? `${t.other.firstName} ${t.other.lastName}`
                    : "Utilisateur inconnu"}
                </span>
                {t.unreadCount > 0 && (
                  <span className="ml-2 bg-teal-500 text-white text-xs rounded-full px-1.5 py-0.5 flex-shrink-0">
                    {t.unreadCount.toString()}
                  </span>
                )}
              </div>
              {t.lastMessage && (
                <p className="text-xs text-slate-500 truncate">
                  {t.lastMessage.senderId === currentUserId ? "Vous : " : ""}
                  {t.lastMessage.body}
                </p>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main panel ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* New thread composer */}
        {composing && (
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => {
                  setComposing(false);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <ChevronLeft size={18} />
              </button>
              <h3 className="font-semibold text-slate-800">Nouveau message</h3>
            </div>
            {newThreadError && (
              <p className="mb-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                {newThreadError}
              </p>
            )}
            <NewThreadForm
              onSend={(recipientId, body) => {
                newThreadMutation.mutate({ recipientId, body });
              }}
              sending={newThreadMutation.isPending}
            />
          </div>
        )}

        {/* Thread detail */}
        {selectedThreadId !== null && !composing && (
          <>
            {threadLoading && (
              <div className="flex-1 flex items-center justify-center text-sm text-slate-500">
                Chargement…
              </div>
            )}
            {!threadLoading && threadDetail && (
              <>
                {/* Message list */}
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                  {threadDetail.messages.map((msg) => {
                    const isOwn = msg.senderId === currentUserId;
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm ${
                            isOwn
                              ? "bg-teal-500 text-white"
                              : "bg-slate-100 text-slate-800"
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{msg.body}</p>
                          <p
                            className={`text-xs mt-1 ${
                              isOwn ? "text-teal-100" : "text-slate-400"
                            }`}
                          >
                            {formatDate(msg.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Reply box */}
                <form
                  onSubmit={handleReply}
                  className="border-t border-slate-200 p-3 flex gap-2 items-end"
                >
                  <textarea
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500"
                    rows={2}
                    placeholder="Répondre…"
                    value={replyBody}
                    onChange={(e) => {
                      setReplyBody(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleReply(e as unknown as React.FormEvent);
                      }
                    }}
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={replyMutation.isPending || !replyBody.trim()}
                  >
                    <Send size={14} />
                  </Button>
                </form>
              </>
            )}
          </>
        )}

        {/* Empty state */}
        {selectedThreadId === null && !composing && (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <MessageSquare size={48} className="mb-3 opacity-20" />
            <p className="text-sm">Sélectionnez une conversation</p>
          </div>
        )}
      </div>
    </div>
  );
}
