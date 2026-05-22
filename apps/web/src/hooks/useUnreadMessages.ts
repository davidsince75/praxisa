import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api.js";
import type { UnreadCountResponse } from "@/lib/api.js";

export function useUnreadMessages(): number {
  const { data } = useQuery({
    queryKey: ["messages-unread-count"],
    queryFn: () => api.get<UnreadCountResponse>("/messages/unread-count"),
    refetchInterval: 30_000,
  });
  return data?.unread ?? 0;
}
