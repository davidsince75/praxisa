/**
 * shared-types
 *
 * API DTOs, error codes, and domain enums shared between the API and frontend apps.
 * Generated OpenAPI client types will also be placed here.
 * No business logic — types only.
 */

// ── Error standard ────────────────────────────────────────────────────────────

export interface ApiError {
  code: string;
  message: string;
  retryable: boolean;
  requestId: string;
  details?: Record<string, unknown>;
}

// ── Pagination ─────────────────────────────────────────────────────────────────

export interface CursorPage<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

// ── User / roles ───────────────────────────────────────────────────────────────

export type UserRole = 'student' | 'instructor' | 'admin' | 'gdpr_officer' | 'migration_lead';

export interface UserDto {
  id: string;
  email: string;
  roles: UserRole[];
  createdAt: string;
}

// ── DSR ────────────────────────────────────────────────────────────────────────

export type DsrType = 'access' | 'erasure' | 'rectification' | 'portability' | 'objection';

export type DsrStatus =
  | 'open'
  | 'in_progress'
  | 'waiting_on_data_subject'
  | 'suspended'
  | 'completed'
  | 'rejected';

export interface DsrDto {
  id: string;
  type: DsrType;
  status: DsrStatus;
  submittedAt: string;
  dueBefore: string;   // 30 days from submittedAt — enforced by GDPR Art. 12
  completedAt: string | null;
}

// ── AI capability tiers ────────────────────────────────────────────────────────

export type AiCapability = 'student_qa' | 'admin_intent' | 'admin_draft' | 'instructor_assessment';
export type AiApprovalState = 'auto_approved' | 'pending_review' | 'approved' | 'rejected';
