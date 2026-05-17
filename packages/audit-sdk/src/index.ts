/**
 * audit-sdk
 *
 * Single entry point for emitting audit events to the append-only audit_events table.
 * No module in the codebase may write directly to audit_events.
 * All writes must go through emitEvent().
 *
 * Minimum required fields per build manual §08.
 */

import type { PolicyResult } from '@praxisa/policy-engine';

// ── Types ─────────────────────────────────────────────────────────────────────

export type DataClassification = 'pii:direct' | 'pii:pseudonymous' | 'non-pii';

export interface AuditEventInput {
  /** User or system that triggered the action */
  actorUserId: string;
  /** Structured event type — use dot notation e.g. 'dsr.transitioned', 'auth.login' */
  eventType: string;
  /** Domain entity affected */
  entityType: string;
  entityId?: string;
  /** From policy-engine evaluation — required for all policy-governed commands */
  policyDecision?: PolicyResult;
  /** PII classification of the data being accessed or modified */
  dataClassification: DataClassification;
  /** Request ID from the HTTP layer for trace correlation */
  requestId: string;
  /** Client IP — scrubbed to /24 subnet for pseudonymisation in non-critical events */
  sourceIp?: string;
  /** SHA-256 of user-agent string — never store raw UA */
  userAgentHash?: string;
  /** Additional structured context specific to this event type */
  metadata?: Record<string, unknown>;
}

export interface AuditEvent extends AuditEventInput {
  id: string;
  eventAt: Date;
}

// ── Sink interface ─────────────────────────────────────────────────────────────

/**
 * AuditSink is injected at app startup (real DB sink in production,
 * in-memory sink in tests). Never import a DB client directly here.
 */
export interface AuditSink {
  write(event: AuditEvent): Promise<void>;
}

// ── Module-level singleton sink ────────────────────────────────────────────────

let _sink: AuditSink | null = null;

export function initAuditSdk(sink: AuditSink): void {
  _sink = sink;
}

// ── emitEvent ─────────────────────────────────────────────────────────────────

/**
 * Emit a structured audit event. Throws if the SDK has not been initialised.
 *
 * @example
 * await emitEvent({
 *   actorUserId: user.id,
 *   eventType: 'dsr.transitioned',
 *   entityType: 'data_subject_request',
 *   entityId: dsr.id,
 *   policyDecision: result,
 *   dataClassification: 'pii:direct',
 *   requestId: req.id,
 * });
 */
export async function emitEvent(input: AuditEventInput): Promise<AuditEvent> {
  if (!_sink) {
    throw new Error(
      'audit-sdk: sink not initialised. Call initAuditSdk(sink) at application startup before emitting events.',
    );
  }

  const event: AuditEvent = {
    ...input,
    id: crypto.randomUUID(),
    eventAt: new Date(),
  };

  await _sink.write(event);
  return event;
}

// ── Test helpers ───────────────────────────────────────────────────────────────

/** In-memory sink for use in unit and integration tests. */
export class InMemoryAuditSink implements AuditSink {
  public events: AuditEvent[] = [];

  write(event: AuditEvent): Promise<void> {
    this.events.push(event);
    return Promise.resolve();
  }

  clear(): void {
    this.events = [];
  }

  findByType(eventType: string): AuditEvent[] {
    return this.events.filter(e => e.eventType === eventType);
  }
}
