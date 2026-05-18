import { z } from "zod";

// ── Row shape ──────────────────────────────────────────────────────────────────
// Each incoming row must have a rowRef (e.g. "Sheet1:R5") and arbitrary data.

export const rawRowSchema = z.object({
  rowRef: z.string().min(1),
  data: z.record(z.unknown()),
});

export type RawRow = z.infer<typeof rawRowSchema>;

// ── Batch creation ─────────────────────────────────────────────────────────────

export const createBatchSchema = z.object({
  sourceFile: z.string().min(1).max(500),
  sha256: z.string().length(64).optional(),
  rows: z.array(rawRowSchema).min(1).max(50000),
});

export type CreateBatchBody = z.infer<typeof createBatchSchema>;

// ── Normalised user row ────────────────────────────────────────────────────────

export interface NormalisedUserRow {
  firstName: string;
  lastName: string;
  email: string;
  role: "student" | "instructor" | "admin" | "migration_lead";
  phone?: string;
}

// ── Validation result ──────────────────────────────────────────────────────────

export interface ValidationIssue {
  ruleId: string;
  field: string;
  severity: "error" | "warning";
  message: string;
}

export interface RowResult {
  rowRef: string;
  rawData: Record<string, unknown>;
  normalised: NormalisedUserRow | null;
  issues: ValidationIssue[];
  accepted: boolean;
}

// ── Reconciliation ─────────────────────────────────────────────────────────────

export interface ReconciliationCheck {
  checkId: string;
  description: string;
  passed: boolean;
  detail: Record<string, unknown>;
}

export interface ReconciliationReport {
  batchId: string;
  runAt: string;
  checks: ReconciliationCheck[];
  passed: boolean;
}
