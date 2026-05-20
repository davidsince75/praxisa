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

// ── Users ──────────────────────────────────────────────────────────────────────

export type UserRole = "admin" | "instructor" | "student" | "migration_lead";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  emailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt?: string;
}

// GET /v1/users → { users, meta }
export interface UserListResponse {
  users: User[];
  meta: { total: number; page: number; limit: number; pages: number };
}

// ── Courses ────────────────────────────────────────────────────────────────────

export interface Course {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: "draft" | "published" | "archived";
  instructorId: string | null;
  language: string;
  thumbnailUrl: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

// GET /v1/courses → { courses }
export interface CourseListResponse {
  courses: Course[];
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
  enrolments: { id: string; courseId: string; enrolledAt: string }[];
  lessonProgress: { lessonId: string; completedAt: string | null }[];
  policyConsents: { policyId: string; consentedAt: string }[];
  auditEvents: { id: string; eventType: string; eventAt: string }[];
}
