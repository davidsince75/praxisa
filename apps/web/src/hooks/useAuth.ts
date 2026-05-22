import { useState, useCallback } from "react";
import {
  api,
  setToken,
  clearAuth,
  getToken,
  isTokenExpired,
} from "@/lib/api.js";
import type { LoginResponse } from "@/lib/api.js";
import { queryClient } from "@/lib/query.js";

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
}

function parseStoredUser(): AuthUser | null {
  const raw = localStorage.getItem("praxisa_user");
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(() => {
    if (isTokenExpired()) {
      // Don't clear localStorage here — side effects in useState
      // initializers race with React's render cycle. The stale entries
      // will be overwritten on next login or cleaned by the 401 handler.
      return null;
    }
    return parseStoredUser();
  });

  const login = useCallback(
    async (email: string, password: string): Promise<void> => {
      const res = await api.post<LoginResponse>("/auth/login", {
        email,
        password,
      });
      setToken(res.token);
      localStorage.setItem("praxisa_user", JSON.stringify(res.user));
      setUser(res.user);
    },
    [],
  );

  const logout = useCallback((): void => {
    clearAuth();
    setUser(null);
    queryClient.clear();
  }, []);

  return {
    user,
    isAuthenticated: getToken() !== null && user !== null,
    isAdmin: user?.role === "admin",
    isInstructor: user?.role === "instructor",
    isStudent: user?.role === "student",
    login,
    logout,
  };
}
