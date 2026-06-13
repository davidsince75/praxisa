import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, getToken } from "@/lib/api.js";
import type { AuthMeResponse } from "@/lib/api.js";

/**
 * Live access-restriction status for the current user, read from GET /auth/me.
 *
 * The login flow caches the user (including isRestricted) in localStorage, but
 * that snapshot never refreshes — so an admin toggling a student's restriction
 * had no effect until the student logged out and back in. This hook treats the
 * server as the source of truth and keeps the cached snapshot in sync, so the
 * toggle takes effect on the next page load / window focus instead.
 *
 * Returns `undefined` while loading; callers fall back to the cached value.
 */
export function useRestrictionStatus(): boolean | undefined {
  const { data } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => api.get<AuthMeResponse>("/auth/me"),
    enabled: getToken() !== null,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const liveRestricted = data?.user.isRestricted;

  // Keep the localStorage snapshot coherent so a full reload (which re-seeds
  // useAuth from localStorage) doesn't flash the stale restriction state.
  useEffect(() => {
    if (liveRestricted === undefined) return;
    const raw = localStorage.getItem("psychostudy_user");
    if (raw === null) return;
    try {
      const stored = JSON.parse(raw) as { isRestricted?: boolean };
      if (stored.isRestricted !== liveRestricted) {
        localStorage.setItem(
          "psychostudy_user",
          JSON.stringify({ ...stored, isRestricted: liveRestricted }),
        );
      }
    } catch {
      // Corrupt snapshot — leave it; the next login overwrites it.
    }
  }, [liveRestricted]);

  return liveRestricted;
}
