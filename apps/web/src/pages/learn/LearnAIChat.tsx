import { useState, useRef, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Bot, Send, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button.js";
import { api } from "@/lib/api.js";
import type { AiQueryResponse, AiQueryChunk } from "@/lib/api.js";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  escalated?: boolean;
  chunks?: AiQueryChunk[];
}

interface ChunkListProps {
  chunks: AiQueryChunk[];
}

function ChunkList({ chunks }: ChunkListProps) {
  const [open, setOpen] = useState(false);
  if (chunks.length === 0) return null;
  return (
    <div className="mt-2 border border-border rounded-md text-xs">
      <button
        onClick={() => {
          setOpen(!open);
        }}
        className="w-full flex items-center justify-between px-3 py-2 text-meta hover:bg-muted/50 transition-colors"
      >
        <span className="font-bold uppercase tracking-wider">
          {chunks.length} source{chunks.length > 1 ? "s" : ""}
        </span>
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {open && (
        <div className="divide-y divide-border">
          {chunks.map((chunk, i) => (
            <div key={i} className="px-3 py-2 text-meta leading-relaxed">
              <p className="line-clamp-3">{chunk.chunkText}</p>
              <p className="mt-1 text-[10px] text-meta/50">
                sim {(chunk.similarity * 100).toFixed(0)}%
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function LearnAIChatPage() {
  const [searchParams] = useSearchParams();
  const lessonId = searchParams.get("lessonId") ?? undefined;
  const lessonTitle = searchParams.get("lessonTitle") ?? undefined;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSend() {
    const question = input.trim();
    if (question.length === 0 || loading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: question,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await api.post<AiQueryResponse>("/ai/query", {
        question,
        ...(lessonId !== undefined ? { lessonId } : {}),
      });

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: res.answer,
        escalated: res.escalated,
        chunks: res.chunks,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur inattendue";
      setError(msg);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 flex items-center gap-3 flex-shrink-0">
        <Bot size={18} className="text-teal" />
        <div>
          <h1 className="text-sm font-bold text-dark">Assistant IA</h1>
          {lessonTitle !== undefined ? (
            <p className="text-xs text-meta">
              Contexte : <span className="font-medium">{lessonTitle}</span>
            </p>
          ) : (
            <p className="text-xs text-meta">Base de connaissances globale</p>
          )}
        </div>
        {lessonId !== undefined && (
          <Link
            to="/learn/ai"
            className="ml-auto text-xs text-meta hover:text-dark transition-colors"
          >
            Mode global
          </Link>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <Bot size={32} className="text-meta/30 mb-3" />
            <p className="text-sm text-meta font-medium">
              Posez une question sur vos cours
            </p>
            <p className="text-xs text-meta/60 mt-1">
              {lessonTitle !== undefined
                ? `Les réponses seront contextualisées à "${lessonTitle}"`
                : "Je peux vous aider sur l'ensemble du contenu disponible"}
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="mr-2 mt-1 flex-shrink-0">
                <div className="w-6 h-6 rounded-full bg-teal/10 flex items-center justify-center">
                  <Bot size={12} className="text-teal" />
                </div>
              </div>
            )}
            <div
              className={`max-w-[75%] ${msg.role === "user" ? "max-w-[60%]" : ""}`}
            >
              <div
                className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-dark text-white"
                    : "bg-muted text-dark"
                }`}
              >
                {msg.content}
              </div>
              {msg.role === "assistant" && msg.escalated === true && (
                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-amber-600">
                  <AlertTriangle size={11} />
                  Réponse escaladée — contenu non trouvé dans les cours
                </div>
              )}
              {msg.role === "assistant" &&
                msg.chunks !== undefined &&
                msg.chunks.length > 0 && <ChunkList chunks={msg.chunks} />}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="mr-2 mt-1">
              <div className="w-6 h-6 rounded-full bg-teal/10 flex items-center justify-center">
                <Bot size={12} className="text-teal" />
              </div>
            </div>
            <div className="bg-muted rounded-xl px-4 py-3">
              <span className="text-sm text-meta animate-pulse">
                Réflexion en cours…
              </span>
            </div>
          </div>
        )}

        {error !== null && (
          <div className="flex justify-center">
            <p className="text-xs text-destructive bg-destructive/10 px-3 py-1.5 rounded-full">
              {error}
            </p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border px-6 py-4 flex-shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder="Posez votre question… (Entrée pour envoyer)"
            className="flex-1 resize-none rounded-lg border border-border bg-white px-3 py-2 text-sm text-dark placeholder:text-meta/50 focus:outline-none focus:ring-2 focus:ring-teal/30"
          />
          <Button
            size="sm"
            onClick={() => void handleSend()}
            disabled={input.trim().length === 0 || loading}
          >
            <Send size={14} />
          </Button>
        </div>
        <p className="text-[10px] text-meta/40 mt-1.5">
          Shift+Entrée pour un saut de ligne
        </p>
      </div>
    </div>
  );
}
