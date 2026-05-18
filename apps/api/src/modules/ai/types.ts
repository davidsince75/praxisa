import { z } from "zod";

// ── Tier 1: Student Q&A ────────────────────────────────────────────────────────

export const aiQueryBodySchema = z.object({
  question: z.string().min(1).max(2000),
  lessonId: z.string().uuid().optional(),
});

export type AiQueryBody = z.infer<typeof aiQueryBodySchema>;

export interface AiQueryChunk {
  lessonId: string;
  chunkIndex: number;
  chunkText: string;
  similarity: number;
}

export interface AiQueryResponse {
  answer: string;
  citations: AiQueryChunk[];
  escalated: boolean;
  escalationReason?: string;
}

// ── Tier 2: Admin draft generation ────────────────────────────────────────────

export const aiAdminDraftBodySchema = z.object({
  intent: z.string().min(1).max(500),
  context: z.record(z.unknown()).optional(),
});

export type AiAdminDraftBody = z.infer<typeof aiAdminDraftBodySchema>;

export interface AiAdminDraftResponse {
  draft: string;
  intentClassification: string;
  requiresReview: true; // Always true — never auto-sent
  policyPassed: boolean;
}

// ── Ingest ─────────────────────────────────────────────────────────────────────

export const aiIngestBodySchema = z.object({
  lessonId: z.string().uuid(),
  text: z.string().min(1).max(500_000),
});

export type AiIngestBody = z.infer<typeof aiIngestBodySchema>;

export interface AiIngestResponse {
  lessonId: string;
  chunksStored: number;
}
