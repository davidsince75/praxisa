const API_BASE = "/v1";
const TOKEN_KEY = "praxisa_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
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

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token !== null ? { Authorization: `Bearer ${token}` } : {}),
    ...(init.headers as Record<string, string> | undefined),
  };

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (!res.ok) {
    const body = (await res
      .json()
      .catch(() => ({ message: res.statusText }))) as {
      message?: string;
      error?: string;
    };
    const message = body.message ?? body.error ?? res.statusText;
    if (res.status === 401) {
      console.error(`[api] 401 on ${init.method ?? "GET"} ${path}:`, message);
      clearToken();
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
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

// ── Typed response shapes (match API exactly) ──────────────────────────────────

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    role: string;
    firstName: string;
    lastName: string;
  };
}

export interface DsrRequest {
  id: string;
  userId: string;
  type: "erasure" | "access" | "portability" | "rectification";
  status: "pending" | "in_progress" | "completed" | "rejected";
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  completedBy: string | null;
  notes: string | null;
}

// GET /v1/gdpr/requests → { requests: DsrRequest[] }
export interface DsrListResponse {
  requests: DsrRequest[];
}

export interface AuditEvent {
  id: string;
  eventAt: string;
  actorUserId: string | null;
  eventType: string;
  entityType: string;
  entityId: string;
  dataClassification: string;
  requestId: string | null;
  sourceIp: string | null;
  metadata: Record<string, unknown> | null;
}

// GET /v1/audit/events → { events, pagination: { limit, offset, count } }
export interface AuditEventsResponse {
  events: AuditEvent[];
  pagination: { limit: number; offset: number; count: number };
}

export interface SarExport {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    isActive: boolean;
    createdAt: string;
  };
  enrolments: Array<{ id: string; courseId: string; enrolledAt: string }>;
  lessonProgress: Array<{ lessonId: string; completedAt: string | null }>;
  policyConsents: Array<{ policyId: string; consentedAt: string }>;
  auditEvents: Array<{ id: string; eventType: string; eventAt: string }>;
}
