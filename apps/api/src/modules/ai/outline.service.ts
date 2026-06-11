import { z } from "zod";
import type { OutlineSection } from "../../db/schema/index.js";
import { chatComplete, MISTRAL_SMALL } from "./mistral-client.js";

// ── Tuning ─────────────────────────────────────────────────────────────────────

const WINDOW_PAGES = 10; // pages summarized per map call
const PAGE_CHAR_CAP = 1800; // chars of each page included in a prompt
const REDUCE_THRESHOLD = 8; // below this many raw sections, skip the reduce call
const MAX_SECTIONS = 40;

// ── Pure helpers (unit-tested) ─────────────────────────────────────────────────

export interface PageWindow {
  pageStart: number;
  pageEnd: number;
  text: string;
}

/**
 * Group extracted pages into windows for the map phase.
 * Page numbers are 1-based. Each page is truncated to PAGE_CHAR_CAP and
 * prefixed with a [Page N] marker so the model can attribute sections.
 */
export function groupPagesIntoWindows(
  pages: string[],
  windowSize = WINDOW_PAGES,
  pageCharCap = PAGE_CHAR_CAP,
): PageWindow[] {
  const windows: PageWindow[] = [];
  for (let start = 0; start < pages.length; start += windowSize) {
    const slice = pages.slice(start, start + windowSize);
    const text = slice
      .map((page, i) => {
        const pageNo = start + i + 1;
        return `[Page ${String(pageNo)}]\n${page.slice(0, pageCharCap)}`;
      })
      .join("\n\n");
    windows.push({
      pageStart: start + 1,
      pageEnd: start + slice.length,
      text,
    });
  }
  return windows;
}

const sectionsResponseSchema = z.object({
  sections: z.array(
    z.object({
      title: z.string().min(1).max(200),
      pageStart: z.number().int(),
      pageEnd: z.number().int(),
      summary: z.string().max(1000).default(""),
    }),
  ),
});

/**
 * Parse a model response expected to contain {"sections":[...]}.
 * Tolerates markdown fences and surrounding prose. Returns null when no
 * valid JSON of the right shape can be recovered.
 */
export function parseSectionsJson(raw: string): OutlineSection[] | null {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }

  const result = sectionsResponseSchema.safeParse(parsed);
  if (!result.success) return null;

  return result.data.sections.map((s) => ({
    title: s.title.trim(),
    pageStart: Math.max(1, Math.round(s.pageStart)),
    pageEnd: Math.max(1, Math.round(s.pageEnd)),
    summary: s.summary.trim(),
  }));
}

/**
 * Sort by page, clamp inverted ranges, drop duplicates and empty titles.
 */
export function tidySections(
  sections: OutlineSection[],
  maxSections = MAX_SECTIONS,
): OutlineSection[] {
  const cleaned = sections
    .filter((s) => s.title.length > 0)
    .map((s) => ({
      ...s,
      pageEnd: Math.max(s.pageStart, s.pageEnd),
    }))
    .sort((a, b) => a.pageStart - b.pageStart || a.pageEnd - b.pageEnd);

  const seen = new Set<string>();
  const deduped = cleaned.filter((s) => {
    const key = `${s.title.toLowerCase()}|${String(s.pageStart)}|${String(s.pageEnd)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return deduped.slice(0, maxSections);
}

/**
 * Serialize an outline for inclusion in a prompt: one line per section,
 * truncated to maxChars.
 */
export function outlineToPromptText(
  outline: OutlineSection[],
  maxChars = 12_000,
): string {
  const lines = outline.map(
    (s) =>
      `p. ${String(s.pageStart)}-${String(s.pageEnd)} — ${s.title}${s.summary.length > 0 ? ` : ${s.summary}` : ""}`,
  );
  let out = "";
  for (const line of lines) {
    if (out.length + line.length + 1 > maxChars) break;
    out += (out.length > 0 ? "\n" : "") + line;
  }
  return out;
}

// ── Map-reduce outline construction ────────────────────────────────────────────

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return fn();
  }
}

const MAP_SYSTEM_PROMPT = `Tu es un assistant pédagogique qui analyse un document de cours.
On te donne le texte de quelques pages consécutives, chaque page précédée d'un marqueur [Page N].
Identifie les sections ou chapitres présents dans ces pages.

RÈGLES STRICTES :
- Réponds UNIQUEMENT en JSON valide, rien d'autre.
- Format exact : {"sections":[{"title":"string","pageStart":N,"pageEnd":N,"summary":"string"},...]}
- 1 à 6 sections, titres courts (max 80 caractères), summary en 1-2 phrases françaises.
- pageStart et pageEnd doivent rester dans l'intervalle de pages fourni.
- Si une section continue visiblement au-delà de la fenêtre, termine-la à la dernière page fournie.`;

function reduceSystemPrompt(pageCount: number): string {
  return `Tu es un assistant pédagogique. On te donne la liste brute des sections détectées fenêtre par fenêtre dans un document de ${String(pageCount)} pages. Les fenêtres se chevauchent parfois : fusionne les fragments qui appartiennent à la même section (titres similaires ou plages de pages contiguës), corrige les plages, et produis un plan cohérent et ordonné du document.

RÈGLES STRICTES :
- Réponds UNIQUEMENT en JSON valide, rien d'autre.
- Format exact : {"sections":[{"title":"string","pageStart":N,"pageEnd":N,"summary":"string"},...]}
- Maximum ${String(MAX_SECTIONS)} sections, ordonnées par pageStart.
- Conserve les titres en français.`;
}

/**
 * Build a document outline with a map-reduce over page windows.
 * Map: each window of pages -> candidate sections.
 * Reduce: consolidate window fragments into one coherent ordered outline.
 * Degrades gracefully: an unparseable window becomes a single page-range
 * section; an unparseable reduce returns the tidied raw sections.
 */
export async function buildOutline(
  pages: string[],
  mistralApiKey: string,
): Promise<OutlineSection[]> {
  const windows = groupPagesIntoWindows(pages);
  const mapped: OutlineSection[] = [];

  for (const window of windows) {
    let sections: OutlineSection[] | null = null;
    try {
      const raw = await withRetry(() =>
        chatComplete(
          [
            { role: "system", content: MAP_SYSTEM_PROMPT },
            {
              role: "user",
              content: `Pages ${String(window.pageStart)} à ${String(window.pageEnd)} :\n\n${window.text}`,
            },
          ],
          MISTRAL_SMALL,
          mistralApiKey,
        ),
      );
      sections = parseSectionsJson(raw);
    } catch {
      sections = null;
    }

    if (sections === null || sections.length === 0) {
      // Graceful fallback: keep the page range visible in the outline.
      mapped.push({
        title: `Pages ${String(window.pageStart)} à ${String(window.pageEnd)}`,
        pageStart: window.pageStart,
        pageEnd: window.pageEnd,
        summary: "",
      });
    } else {
      mapped.push(...sections);
    }
  }

  const raw = tidySections(mapped, MAX_SECTIONS * 3);
  if (raw.length <= REDUCE_THRESHOLD) return tidySections(raw);

  try {
    const reduced = await withRetry(() =>
      chatComplete(
        [
          { role: "system", content: reduceSystemPrompt(pages.length) },
          {
            role: "user",
            content: `Sections brutes :\n${JSON.stringify({ sections: raw })}`,
          },
        ],
        MISTRAL_SMALL,
        mistralApiKey,
      ),
    );
    const consolidated = parseSectionsJson(reduced);
    if (consolidated !== null && consolidated.length > 0) {
      return tidySections(consolidated);
    }
  } catch {
    // fall through to the raw mapped outline
  }

  return tidySections(raw);
}
