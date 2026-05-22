import { useState, useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api.js";
import type { NotificationsResponse } from "@/lib/api.js";

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return "À l'instant";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Il y a ${String(diffMin)} min`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `Il y a ${String(diffHr)} h`;
  const diffDay = Math.floor(diffHr / 24);
  return `Il y a ${String(diffDay)} j`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data } = useQuery<NotificationsResponse>({
    queryKey: ["notifications"],
    queryFn: () => api.get<NotificationsResponse>("/notifications"),
    refetchInterval: 30_000,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) =>
      api.patch<undefined>(`/notifications/${id}/read`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () =>
      api.post<{ updated: number }>("/notifications/read-all", {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, []);

  const items = data?.notifications.slice(0, 10) ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <div ref={ref} className="px-3 pb-2 relative">
      <button
        onClick={() => {
          setOpen((prev) => !prev);
        }}
        className="relative flex items-center gap-3 w-full px-3 py-2.5 text-xs font-bold uppercase tracking-widest text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
      >
        <Bell size={15} />
        Notifications
        {unreadCount > 0 && (
          <span className="absolute top-1.5 left-7 w-2 h-2 rounded-full bg-red-500" />
        )}
      </button>

      {open && (
        <div className="absolute left-0 bottom-full mb-1 w-80 bg-white shadow-xl rounded-lg border border-rule z-50 overflow-hidden">
          {items.length === 0 ? (
            <p className="py-8 text-center text-xs text-meta">
              Aucune notification
            </p>
          ) : (
            <>
              <div className="max-h-72 overflow-y-auto">
                {items.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => {
                      markReadMutation.mutate(n.id);
                    }}
                    className={`w-full text-left px-4 py-3 border-b border-rule last:border-0 hover:bg-gray-50 transition-colors ${
                      n.readAt === null ? "bg-teal/5" : ""
                    }`}
                  >
                    <p className="text-xs font-bold text-dark truncate">
                      {n.title}
                    </p>
                    <p className="text-[11px] text-meta truncate">{n.body}</p>
                    <p className="text-[10px] text-meta/60 mt-0.5">
                      {relativeTime(n.createdAt)}
                    </p>
                  </button>
                ))}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={() => {
                    markAllMutation.mutate();
                  }}
                  className="w-full px-4 py-2.5 text-xs font-medium text-teal hover:bg-teal/5 transition-colors border-t border-rule"
                >
                  Tout marquer lu
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
