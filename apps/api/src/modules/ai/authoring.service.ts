// AI course-authoring helpers: prompt templates, model-response parsing and
// HTML sanitisation for the lesson / homework / resource generation routes.
// Pure functions only — unit-tested without network or DB.

import { z } from "zod";

// ── Prompts ────────────────────────────────────────────────────────────────────

export const LESSON_CONTENT_GROUNDED_PROMPT = `Tu es un concepteur pédagogique pour Praxisa. À partir des extraits du support de cours fournis, rédige le contenu d'une leçon en HTML, en français.

RÈGLES STRICTES :
- Réponds UNIQUEMENT avec un fragment HTML — pas de <html>, <head> ou <body>, pas de Markdown, pas de bloc de code.
- Balises autorisées : <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>, <blockquote>, <hr />.
- Structure : une courte introduction, 2 à 4 sections titrées <h2>, puis une section <h2>Points clés</h2> avec une liste <ul>.
- 400 à 800 mots.
- Appuie-toi UNIQUEMENT sur les extraits fournis — n'invente aucun fait.
- Cite les pages sources entre parenthèses, par exemple (p. 12-14), d'après les indications de pages des extraits.
- Si les extraits ne suffisent pas pour traiter le sujet, dis-le explicitement à la fin.`;

export const LESSON_CONTENT_FREE_PROMPT = `Tu es un concepteur pédagogique pour Praxisa. Rédige le contenu d'une leçon en HTML, en français, à partir du titre et des consignes fournis.

RÈGLES STRICTES :
- Réponds UNIQUEMENT avec un fragment HTML — pas de <html>, <head> ou <body>, pas de Markdown, pas de bloc de code.
- Balises autorisées : <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>, <blockquote>, <hr />.
- Structure : une courte introduction, 2 à 4 sections titrées <h2>, puis une section <h2>Points clés</h2> avec une liste <ul>.
- 400 à 800 mots.
- Contenu pédagogique rigoureux et factuel ; reste prudent sur les points débattus et signale-les explicitement.`;

export function homeworkSystemPrompt(
  type: "assignment" | "reflection",
): string {
  const nature =
    type === "assignment"
      ? "un devoir à rendre (dissertation, étude de cas ou analyse)"
      : "un travail de réflexion personnelle";
  return `Tu es un concepteur pédagogique pour Praxisa. Rédige un sujet pour ${nature} portant sur la leçon indiquée, en français.

RÈGLES STRICTES :
- Réponds UNIQUEMENT en JSON valide, rien d'autre.
- Format exact : {"title":"string","description":"string","maxScore":20}
- title : intitulé court du sujet (max 120 caractères).
- description : le sujet complet (250 mots max) — consigne précise, attendus, critères d'évaluation. Sépare les paragraphes par des sauts de ligne.
- maxScore : barème total de la note (entier, 20 par défaut).
- Si des extraits du support de cours sont fournis, appuie-toi dessus.`;
}

export const RESOURCE_SUGGESTIONS_PROMPT = `Tu es un assistant pédagogique pour Praxisa. Pour la leçon indiquée, propose des ressources externes qui renforcent le sujet. Tes propositions seront vérifiées et résolues vers de vraies sources — ne fournis JAMAIS d'URL.

RÈGLES STRICTES :
- Réponds UNIQUEMENT en JSON valide, rien d'autre.
- Format exact : {"references":[{"title":"string","author":"string","year":"string","note":"string"}],"wikipediaQueries":["string"],"videoQueries":["string"],"imageQueries":["string"]}
- references : 2 à 4 ouvrages ou articles de référence RÉELS et reconnus sur le sujet. N'inclus une référence que si tu es certain qu'elle existe (auteur et titre réels) — en cas de doute, omets-la. note = pourquoi cette lecture est utile (1 phrase).
- wikipediaQueries : 2 à 3 termes de recherche (concepts clés de la leçon) pour trouver des articles Wikipédia en français.
- videoQueries : 1 à 2 requêtes de recherche YouTube en français pour des vidéos éducatives sur le sujet.
- imageQueries : 1 à 2 requêtes en anglais pour rechercher des images libres de droits illustrant la leçon.
- Tout le reste en français.`;

// ── JSON extraction ────────────────────────────────────────────────────────────

export function extractJsonObject(raw: string): unknown {
  const match = raw.match(/\{[\s\S]*\}/);
  if (match === null) return null;
  try {
    return JSON.parse(match[0]) as unknown;
  } catch {
    return null;
  }
}

// ── Generated-HTML cleanup ─────────────────────────────────────────────────────
// The model is asked for a plain HTML fragment, but may wrap it in Markdown
// code fences or produce markup we never want inside lesson bodies. The CSP
// (script-src 'self') is the hard XSS boundary — this is defence in depth.

export function stripCodeFences(raw: string): string {
  const out = raw.trim();
  const inner = out.match(/^```(?:html)?\s*\n([\s\S]*?)\n?```\s*$/i)?.[1];
  if (inner !== undefined) return inner.trim();
  return out;
}

const FORBIDDEN_BLOCKS = [
  /<script[\s\S]*?<\/script\s*>/gi,
  /<style[\s\S]*?<\/style\s*>/gi,
];
// Tag-level strip (content is kept): structural wrappers and embed vectors.
const FORBIDDEN_TAGS =
  /<\/?(?:script|style|iframe|object|embed|form|link|meta|base|html|head|body)\b[^>]*>/gi;
const EVENT_HANDLER_ATTRS = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const JS_URL_ATTRS = /\s+(?:href|src)\s*=\s*(["'])\s*javascript:[^"']*\1/gi;

export function sanitizeGeneratedHtml(raw: string): string {
  let out = stripCodeFences(raw);
  for (const re of FORBIDDEN_BLOCKS) {
    out = out.replace(re, "");
  }
  out = out.replace(FORBIDDEN_TAGS, "");
  // Attribute-level cleanup is applied inside tags only, so prose like
  // « onze = 11 » is never touched.
  out = out.replace(/<[a-z][^>]*>/gi, (tag) =>
    tag.replace(EVENT_HANDLER_ATTRS, "").replace(JS_URL_ATTRS, ""),
  );
  return out.trim();
}

// ── Homework suggestion parsing ────────────────────────────────────────────────

export interface HomeworkSuggestion {
  title: string;
  description: string;
  maxScore: number;
}

const homeworkSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  maxScore: z.unknown().optional(),
});

export function parseHomeworkSuggestion(
  raw: string,
): HomeworkSuggestion | null {
  const json = extractJsonObject(raw);
  if (json === null) return null;
  const parsed = homeworkSchema.safeParse(json);
  if (!parsed.success) return null;

  const rawScore = parsed.data.maxScore;
  const rounded =
    typeof rawScore === "number" && Number.isFinite(rawScore)
      ? Math.round(rawScore)
      : 20;
  const maxScore = Math.min(100, Math.max(1, rounded));

  return {
    title: parsed.data.title.trim().slice(0, 200),
    description: parsed.data.description.trim().slice(0, 5000),
    maxScore,
  };
}

// ── Resource suggestion parsing ────────────────────────────────────────────────

export interface SuggestedReference {
  title: string;
  author?: string;
  year?: string;
  note?: string;
}

export interface ResourceSuggestions {
  references: SuggestedReference[];
  wikipediaQueries: string[];
  videoQueries: string[];
  imageQueries: string[];
}

const resourceSuggestionsSchema = z.object({
  references: z
    .array(
      z.object({
        title: z.string().min(1),
        author: z.string().optional(),
        year: z.union([z.string(), z.number()]).optional(),
        note: z.string().optional(),
      }),
    )
    .optional(),
  wikipediaQueries: z.array(z.string()).optional(),
  videoQueries: z.array(z.string()).optional(),
  imageQueries: z.array(z.string()).optional(),
});

function clampQueries(
  values: string[] | undefined,
  maxCount: number,
  maxLength: number,
): string[] {
  return (values ?? [])
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
    .slice(0, maxCount)
    .map((v) => v.slice(0, maxLength));
}

export function parseResourceSuggestions(
  raw: string,
): ResourceSuggestions | null {
  const json = extractJsonObject(raw);
  if (json === null) return null;
  const parsed = resourceSuggestionsSchema.safeParse(json);
  if (!parsed.success) return null;

  const references = (parsed.data.references ?? [])
    .slice(0, 4)
    .map((r) => ({
      title: r.title.trim().slice(0, 200),
      ...(r.author !== undefined && r.author.trim().length > 0
        ? { author: r.author.trim().slice(0, 120) }
        : {}),
      ...(r.year !== undefined && String(r.year).trim().length > 0
        ? { year: String(r.year).trim().slice(0, 12) }
        : {}),
      ...(r.note !== undefined && r.note.trim().length > 0
        ? { note: r.note.trim().slice(0, 300) }
        : {}),
    }))
    .filter((r) => r.title.length > 0);

  const suggestions: ResourceSuggestions = {
    references,
    wikipediaQueries: clampQueries(parsed.data.wikipediaQueries, 3, 120),
    videoQueries: clampQueries(parsed.data.videoQueries, 2, 120),
    imageQueries: clampQueries(parsed.data.imageQueries, 2, 120),
  };

  const isEmpty =
    suggestions.references.length === 0 &&
    suggestions.wikipediaQueries.length === 0 &&
    suggestions.videoQueries.length === 0 &&
    suggestions.imageQueries.length === 0;

  return isEmpty ? null : suggestions;
}
