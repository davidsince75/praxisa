const API_BASE = "/v1";
const TOKEN_KEY = "psychostudy_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem("psychostudy_user");
}

export function isTokenExpired(): boolean {
  const token = getToken();
  if (token === null) return true;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return true;
    // JWT uses base64url — convert to standard base64 for atob
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4;
    if (pad > 0) {
      b64 += "=".repeat(4 - pad);
    }
    const payload = JSON.parse(atob(b64)) as { exp?: number };
    if (typeof payload.exp !== "number") return false;
    return payload.exp * 1000 < Date.now();
  } catch {
    // If we can't decode the token, don't wipe the session —
    // let the API 401 handler deal with truly invalid tokens.
    return false;
  }
}

function decodeTokenExp(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4;
    if (pad > 0) {
      b64 += "=".repeat(4 - pad);
    }
    const payload = JSON.parse(atob(b64)) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

/**
 * Milliseconds until the session token expires; null when unknown.
 * Drives the session-expiry warning banner (RGAA: timeout with warning).
 */
export function getTokenRemainingMs(): number | null {
  const token = getToken();
  if (token === null) return null;
  const exp = decodeTokenExp(token);
  return exp === null ? null : exp * 1000 - Date.now();
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Turn an API error payload into a readable string. Several routes return
 * zod's flatten() output ({ formErrors, fieldErrors }) as `error` — rendering
 * that object directly produced "[object Object]" in dialogs.
 */
function toErrorMessage(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "object" && value !== null) {
    const flat = value as {
      formErrors?: unknown;
      fieldErrors?: unknown;
    };
    const parts: string[] = [];
    if (Array.isArray(flat.formErrors)) {
      parts.push(...flat.formErrors.filter((e) => typeof e === "string"));
    }
    if (typeof flat.fieldErrors === "object" && flat.fieldErrors !== null) {
      for (const [field, errors] of Object.entries(flat.fieldErrors)) {
        if (Array.isArray(errors)) {
          const messages = errors.filter((e) => typeof e === "string");
          if (messages.length > 0) {
            parts.push(`${field} : ${messages.join(", ")}`);
          }
        }
      }
    }
    if (parts.length > 0) return parts.join(" — ");
  }
  return fallback;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
    ...(token !== null ? { Authorization: `Bearer ${token}` } : {}),
    ...(init.headers as Record<string, string> | undefined),
  };

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (!res.ok) {
    const body = (await res
      .json()
      .catch(() => ({ message: res.statusText }))) as {
      message?: unknown;
      error?: unknown;
    };
    const message = toErrorMessage(body.message ?? body.error, res.statusText);
    if (res.status === 401) {
      clearAuth();
      window.location.href = "/login";
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  // Binary file upload — sends File as application/octet-stream (no base64 overhead)
  upload: <T>(path: string, file: File) =>
    request<T>(path, {
      method: "POST",
      body: file,
      headers: {
        "Content-Type": "application/octet-stream",
        "X-Filename": encodeURIComponent(file.name),
        "X-Mime-Type": file.type,
      } as Record<string, string>,
    }),
};

// ── Typed response shapes — split by domain, re-exported for compatibility ─────

export * from "./types/auth.js";
export * from "./types/courses.js";
export * from "./types/learner.js";
export * from "./types/analytics.js";
export * from "./types/messaging.js";
export * from "./types/grading.js";
export * from "./types/ai.js";
export * from "./types/ratings.js";
export * from "./types/admin.js";
