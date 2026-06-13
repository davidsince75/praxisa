// Auth, users, GDPR, audit — shared API response types.
// Split out of lib/api.ts; consumed via re-export from @/lib/api.

// ── Typed response shapes ──────────────────────────────────────────────────────

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    role: string;
    firstName: string;
    lastName: string;
    isRestricted: boolean;
  };
}

// Self-registration returns the same shape as login (token + auto-login user).
export type RegisterResponse = LoginResponse;

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

// GET /auth/me — the live source of truth for the current user's account
// flags. Unlike the login-time localStorage snapshot, this reflects admin
// changes (e.g. toggling access restriction) without requiring re-login.
export interface AuthMeResponse {
  user: {
    id: string;
    email: string;
    role: string;
    firstName: string;
    lastName: string;
    emailVerified: boolean;
    isRestricted: boolean;
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
  isRestricted: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface UserListResponse {
  users: User[];
  meta: { total: number; page: number; limit: number; pages: number };
}

export interface UserDetail extends User {
  phone: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
}

export interface UserDetailResponse {
  user: UserDetail;
}

export interface UserSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
}

export interface UserSearchResponse {
  users: UserSearchResult[];
}

// ── Courses ────────────────────────────────────────────────────────────────────

export interface MyProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  createdAt: string;
}

export interface UserMeResponse {
  user: MyProfile;
}
