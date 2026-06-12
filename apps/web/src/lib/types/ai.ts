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
  /** Page range of the source PDF covered by the module (fileId mode only). */
  pageStart?: number;
  pageEnd?: number;
}

export interface AICourseStructureResponse {
  modules: AIModuleSuggestion[];
}

// ── AI: Document ingest (course PDF preparation) ─────────────────────────────

export type DocumentIngestState = "none" | "processing" | "ready" | "failed";

export interface DocumentIngestStatusResponse {
  status: DocumentIngestState;
  stage?: string | null;
  error?: string | null;
  pageCount?: number | null;
  chunkCount?: number | null;
  updatedAt?: string;
}

export interface AIDraftLessonSource {
  pageStart: number;
  pageEnd: number;
  excerpt: string;
}

export interface AIDraftLessonResponse {
  content: string;
  sources: AIDraftLessonSource[];
}

// ── AI: Lesson authoring assistant ────────────────────────────────────────────

export interface AIGenerateLessonContentResponse {
  html: string;
  sources: AIDraftLessonSource[];
}

export interface AIHomeworkSuggestion {
  title: string;
  description: string;
  type: "assignment" | "reflection";
  maxScore: number;
}

export interface AIGenerateHomeworkResponse {
  homework: AIHomeworkSuggestion;
}

// External resources — every URL is resolved server-side against a real
// public API (Wikipédia, Openverse, YouTube); none comes from the model.

export interface AIResourceArticle {
  title: string;
  url: string;
  description: string | null;
  source: "wikipedia";
}

export interface AIResourceReference {
  title: string;
  author?: string;
  year?: string;
  note?: string;
}

export interface AIResourceVideo {
  videoId: string;
  title: string;
  channel: string;
  url: string;
  embedUrl: string;
  thumbnailUrl: string | null;
}

export interface AIResourceVideoSearch {
  query: string;
  url: string;
}

export interface AIResourceImage {
  title: string;
  imageUrl: string;
  thumbnailUrl: string | null;
  pageUrl: string | null;
  license: string;
  licenseUrl: string | null;
  creator: string | null;
}

export interface AISuggestResourcesResponse {
  articles: AIResourceArticle[];
  references: AIResourceReference[];
  videos: AIResourceVideo[];
  videoSearches: AIResourceVideoSearch[];
  images: AIResourceImage[];
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
