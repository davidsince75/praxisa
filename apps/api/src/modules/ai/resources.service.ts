// Resolves AI-suggested external resources against real public APIs so the
// platform never surfaces hallucinated links: Wikipédia (lectures), Openverse
// (images libres) and — when a YouTube Data API key is configured — YouTube
// search. Without a key, videos degrade to always-valid YouTube search links.
// Every resolver fails soft (returns []) so one flaky upstream never breaks
// the whole suggestion request.

import type {
  ResourceSuggestions,
  SuggestedReference,
} from "./authoring.service.js";

const FETCH_TIMEOUT_MS = 8000;
// Wikimedia asks API clients to identify themselves; Openverse tolerates it.
const USER_AGENT = "PraxisaLMS/1.0 (assistant pedagogique)";

interface MinimalLogger {
  warn: (obj: unknown, msg?: string) => void;
}

async function fetchJson<T>(
  url: string,
  logger?: MinimalLogger,
): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) {
      logger?.warn(
        { url, status: res.status },
        "resource resolver: upstream returned non-OK status",
      );
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    logger?.warn({ url, err }, "resource resolver: fetch failed");
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

export function dedupeBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const k = key(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

// ── Wikipédia (lectures complémentaires) ───────────────────────────────────────

export interface ResolvedArticle {
  title: string;
  url: string;
  description: string | null;
  source: "wikipedia";
}

interface WikiSearchResponse {
  pages?: {
    key?: string;
    title?: string;
    description?: string | null;
  }[];
}

export async function searchWikipedia(
  query: string,
  limit = 2,
  logger?: MinimalLogger,
): Promise<ResolvedArticle[]> {
  const url = new URL("https://fr.wikipedia.org/w/rest.php/v1/search/page");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(limit));

  const data = await fetchJson<WikiSearchResponse>(url.toString(), logger);
  if (data === null || !Array.isArray(data.pages)) return [];

  const articles: ResolvedArticle[] = [];
  for (const page of data.pages) {
    if (typeof page.key !== "string" || page.key.length === 0) continue;
    articles.push({
      title: typeof page.title === "string" ? page.title : page.key,
      url: `https://fr.wikipedia.org/wiki/${encodeURIComponent(page.key)}`,
      description:
        typeof page.description === "string" && page.description.length > 0
          ? page.description
          : null,
      source: "wikipedia",
    });
  }
  return articles;
}

// ── Openverse (images sous licence libre) ──────────────────────────────────────

export interface ResolvedImage {
  title: string;
  imageUrl: string;
  thumbnailUrl: string | null;
  pageUrl: string | null;
  license: string;
  licenseUrl: string | null;
  creator: string | null;
}

interface OpenverseResponse {
  results?: {
    title?: string | null;
    url?: string;
    thumbnail?: string | null;
    license?: string;
    license_url?: string | null;
    creator?: string | null;
    foreign_landing_url?: string | null;
  }[];
}

export function formatOpenverseLicense(license: string): string {
  const normalized = license.trim().toLowerCase();
  if (normalized === "cc0") return "CC0";
  if (normalized === "pdm") return "Domaine public";
  if (normalized.startsWith("by")) return `CC ${normalized.toUpperCase()}`;
  return normalized.toUpperCase();
}

function httpsOrNull(value: unknown): string | null {
  return typeof value === "string" && value.startsWith("https://")
    ? value
    : null;
}

export async function searchOpenverseImages(
  query: string,
  limit = 3,
  logger?: MinimalLogger,
): Promise<ResolvedImage[]> {
  const url = new URL("https://api.openverse.org/v1/images/");
  url.searchParams.set("q", query);
  url.searchParams.set("page_size", String(limit));
  // Commercial-use licences only (CC0, PDM, BY, BY-SA) — safe for an LMS.
  url.searchParams.set("license_type", "commercial");

  const data = await fetchJson<OpenverseResponse>(url.toString(), logger);
  if (data === null || !Array.isArray(data.results)) return [];

  const images: ResolvedImage[] = [];
  for (const result of data.results) {
    const imageUrl = httpsOrNull(result.url);
    if (imageUrl === null) continue;
    images.push({
      title:
        typeof result.title === "string" && result.title.length > 0
          ? result.title
          : "Illustration",
      imageUrl,
      thumbnailUrl: httpsOrNull(result.thumbnail),
      pageUrl: httpsOrNull(result.foreign_landing_url),
      license: formatOpenverseLicense(result.license ?? ""),
      licenseUrl: httpsOrNull(result.license_url),
      creator:
        typeof result.creator === "string" && result.creator.length > 0
          ? result.creator
          : null,
    });
  }
  return images;
}

// ── YouTube (vidéos publiques) ─────────────────────────────────────────────────

export interface ResolvedVideo {
  videoId: string;
  title: string;
  channel: string;
  url: string;
  embedUrl: string;
  thumbnailUrl: string | null;
}

export interface VideoSearchLink {
  query: string;
  url: string;
}

interface YoutubeSearchResponse {
  items?: {
    id?: { videoId?: string };
    snippet?: {
      title?: string;
      channelTitle?: string;
      thumbnails?: { medium?: { url?: string } };
    };
  }[];
}

export async function searchYoutubeVideos(
  query: string,
  apiKey: string,
  limit = 2,
  logger?: MinimalLogger,
): Promise<ResolvedVideo[]> {
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("videoEmbeddable", "true");
  url.searchParams.set("safeSearch", "strict");
  url.searchParams.set("relevanceLanguage", "fr");
  url.searchParams.set("maxResults", String(limit));
  url.searchParams.set("q", query);
  url.searchParams.set("key", apiKey);

  const data = await fetchJson<YoutubeSearchResponse>(url.toString(), logger);
  if (data === null || !Array.isArray(data.items)) return [];

  const videos: ResolvedVideo[] = [];
  for (const item of data.items) {
    const videoId = item.id?.videoId;
    if (typeof videoId !== "string" || videoId.length === 0) continue;
    videos.push({
      videoId,
      title: decodeHtmlEntities(item.snippet?.title ?? "Vidéo"),
      channel: decodeHtmlEntities(item.snippet?.channelTitle ?? ""),
      url: `https://www.youtube.com/watch?v=${videoId}`,
      embedUrl: `https://www.youtube.com/embed/${videoId}`,
      thumbnailUrl: httpsOrNull(item.snippet?.thumbnails?.medium?.url),
    });
  }
  return videos;
}

export function youtubeSearchLink(query: string): VideoSearchLink {
  return {
    query,
    url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
  };
}

// ── Orchestrator ───────────────────────────────────────────────────────────────

export interface ResolvedResources {
  articles: ResolvedArticle[];
  references: SuggestedReference[];
  videos: ResolvedVideo[];
  videoSearches: VideoSearchLink[];
  images: ResolvedImage[];
}

export interface ResolveResourcesOptions {
  youtubeApiKey?: string;
  logger?: MinimalLogger;
}

export async function resolveResources(
  suggestions: ResourceSuggestions,
  opts: ResolveResourcesOptions = {},
): Promise<ResolvedResources> {
  const { youtubeApiKey, logger } = opts;

  const [articleLists, imageLists, videoLists] = await Promise.all([
    Promise.all(
      suggestions.wikipediaQueries.map((q) => searchWikipedia(q, 2, logger)),
    ),
    Promise.all(
      suggestions.imageQueries.map((q) => searchOpenverseImages(q, 3, logger)),
    ),
    Promise.all(
      youtubeApiKey !== undefined
        ? suggestions.videoQueries.map((q) =>
            searchYoutubeVideos(q, youtubeApiKey, 2, logger),
          )
        : [],
    ),
  ]);

  return {
    articles: dedupeBy(articleLists.flat(), (a) => a.url).slice(0, 4),
    references: suggestions.references,
    videos: dedupeBy(videoLists.flat(), (v) => v.videoId).slice(0, 4),
    videoSearches: suggestions.videoQueries.map(youtubeSearchLink),
    images: dedupeBy(imageLists.flat(), (i) => i.imageUrl).slice(0, 6),
  };
}
