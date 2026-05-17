/**
 * policy-engine
 *
 * Single source of truth for access decisions on high-impact commands.
 * All modules must route sensitive actions through evaluate() — never
 * implement inline access checks.
 *
 * Consumers: auth, learning, comms, crm, finance, ai, analytics, gdpr, migration modules.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type ActorType = "user" | "worker" | "ai" | "system";

export interface Actor {
  id: string;
  type: ActorType;
  roles: string[];
}

/** High-impact actions governed by policy. Extend as modules are built. */
export type PolicyAction =
  | "dsr:transition"
  | "dsr:evidence_export"
  | "pii:bulk_export"
  | "ai:approve"
  | "ai:execute_tier3"
  | "grade:publish"
  | "migration:execute"
  | "admin:impersonate"
  | "auth:mfa_bypass";

export interface PolicyRequest {
  actor: Actor;
  action: PolicyAction;
  resourceType: string;
  resourceId?: string;
  context?: Record<string, unknown>;
}

export interface PolicyResult {
  allowed: boolean;
  reasonCode: string;
  policyVersion: string;
  decisionId: string;
}

// ── Hard blocks ────────────────────────────────────────────────────────────────

/**
 * Actions that are ALWAYS denied regardless of role.
 * These are non-negotiable build manual requirements (§09).
 */
const HARD_BLOCKS: Partial<Record<PolicyAction, string>> = {
  "grade:publish":
    "HARD_BLOCK_AI_GRADE_PUBLISH — AI actor may never publish grades",
};

// ── Policy version ─────────────────────────────────────────────────────────────

/** Bump this version string whenever policy rules change. Changes require an ADR. */
export const POLICY_VERSION = "1.0.0";

// ── Evaluate ───────────────────────────────────────────────────────────────────

/**
 * Evaluate an access request against current policy rules.
 *
 * @example
 * const result = evaluate({
 *   actor: { id: userId, type: 'user', roles: ['admin'] },
 *   action: 'dsr:transition',
 *   resourceType: 'data_subject_request',
 *   resourceId: dsrId,
 * });
 * if (!result.allowed) throw new ForbiddenError(result.reasonCode);
 */
export function evaluate(request: PolicyRequest): PolicyResult {
  const decisionId = crypto.randomUUID();

  // AI actors are hard-blocked from grade publish regardless of any other context
  if (request.actor.type === "ai") {
    const hardBlock = HARD_BLOCKS[request.action];
    if (hardBlock) {
      return {
        allowed: false,
        reasonCode: hardBlock,
        policyVersion: POLICY_VERSION,
        decisionId,
      };
    }
  }

  // Workers and system actors may not impersonate users
  if (request.action === "admin:impersonate" && request.actor.type !== "user") {
    return {
      allowed: false,
      reasonCode: "NON_USER_IMPERSONATION_DENIED",
      policyVersion: POLICY_VERSION,
      decisionId,
    };
  }

  // DSR transitions require admin or gdpr_officer role
  if (
    request.action === "dsr:transition" ||
    request.action === "dsr:evidence_export"
  ) {
    if (
      !request.actor.roles.some((r) => ["admin", "gdpr_officer"].includes(r))
    ) {
      return {
        allowed: false,
        reasonCode: "INSUFFICIENT_ROLE_FOR_DSR",
        policyVersion: POLICY_VERSION,
        decisionId,
      };
    }
  }

  // Bulk PII export requires admin role + explicit context flag
  if (request.action === "pii:bulk_export") {
    const hasRole = request.actor.roles.includes("admin");
    const hasReason = typeof request.context?.["exportReason"] === "string";
    if (!hasRole || !hasReason) {
      return {
        allowed: false,
        reasonCode: "BULK_EXPORT_REQUIRES_ADMIN_AND_REASON",
        policyVersion: POLICY_VERSION,
        decisionId,
      };
    }
  }

  // Tier 3 AI execution requires instructor role
  if (request.action === "ai:execute_tier3") {
    if (!request.actor.roles.includes("instructor")) {
      return {
        allowed: false,
        reasonCode: "TIER3_AI_REQUIRES_INSTRUCTOR_ROLE",
        policyVersion: POLICY_VERSION,
        decisionId,
      };
    }
  }

  // Migration execution requires migration_lead role
  if (request.action === "migration:execute") {
    if (!request.actor.roles.includes("migration_lead")) {
      return {
        allowed: false,
        reasonCode: "MIGRATION_REQUIRES_MIGRATION_LEAD_ROLE",
        policyVersion: POLICY_VERSION,
        decisionId,
      };
    }
  }

  return {
    allowed: true,
    reasonCode: "ALLOWED",
    policyVersion: POLICY_VERSION,
    decisionId,
  };
}
