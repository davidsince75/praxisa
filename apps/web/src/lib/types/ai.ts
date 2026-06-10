// AI chat, ingest, course structure, MCQ generation — shared API response types.
// Split out of lib/api.ts; consumed via re-export from @/lib/api.

// ── AI Assistant ───────────────────────────────────────────────────────────────

export interface AiQueryChunk {
  lessonId: string;
  chunkIndex: number;
  chunkText: string;
  similarity: number;
}

export interface AiQueryResponse {
  answer: string;
  chunks: AiQueryChunk[];
  escalated: boolean;
}

export interface AiIngestResponse {
  lessonId: string;
  chunkCount: number;
}

export interface AiAdminDraft {
  draft: string;
  intentClassification: string;
  requiresReview: true;
  policyPassed: boolean;
}

export interface AiAdminDraftResponse {
  draft: AiAdminDraft;
}

// ── AI: Course Structure ──────────────────────────────────────────────────────

export interface AIModuleSuggestion {
  title: string;
  description: string;
}

export interface AICourseStructureResponse {
  modules: AIModuleSuggestion[];
}

// ── AI: MCQ Generation ────────────────────────────────────────────────────────

export interface AIMCQOption {
  id: string;
  text: string;
}

export interface AIMCQQuestion {
  questionText: string;
  options: AIMCQOption[];
  correctOptionId: string;
  explanation: string;
}

export interface AIMCQResponse {
  questions: AIMCQQuestion[];
}
