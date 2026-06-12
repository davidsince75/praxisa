import { describe, it, expect, vi, afterEach } from "vitest";
import {
  decodeHtmlEntities,
  dedupeBy,
  formatOpenverseLicense,
  resolveResources,
  searchOpenverseImages,
  searchWikipedia,
  searchYoutubeVideos,
  youtubeSearchLink,
} from "./resources.service.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetchJson(payload: unknown, ok = true): ReturnType<typeof vi.fn> {
  const fn = vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(payload),
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

// ── Pure helpers ───────────────────────────────────────────────────────────────

describe("decodeHtmlEntities", () => {
  it("decodes the common entities", () => {
    expect(decodeHtmlEntities("Freud &amp; Jung &#39;1900&#39; &lt;3")).toBe(
      "Freud & Jung '1900' <3",
    );
  });

  it("does not double-decode &amp;lt;", () => {
    expect(decodeHtmlEntities("&amp;lt;")).toBe("&lt;");
  });
});

describe("dedupeBy", () => {
  it("keeps the first occurrence per key", () => {
    const items = [
      { id: "a", n: 1 },
      { id: "a", n: 2 },
      { id: "b", n: 3 },
    ];
    expect(dedupeBy(items, (i) => i.id)).toEqual([
      { id: "a", n: 1 },
      { id: "b", n: 3 },
    ]);
  });
});

describe("formatOpenverseLicense", () => {
  it("formats CC licences", () => {
    expect(formatOpenverseLicense("by-sa")).toBe("CC BY-SA");
    expect(formatOpenverseLicense("by")).toBe("CC BY");
  });

  it("formats CC0 and public domain", () => {
    expect(formatOpenverseLicense("cc0")).toBe("CC0");
    expect(formatOpenverseLicense("pdm")).toBe("Domaine public");
  });

  it("upper-cases unknown licences", () => {
    expect(formatOpenverseLicense("sampling+")).toBe("SAMPLING+");
  });
});

describe("youtubeSearchLink", () => {
  it("builds an encoded results URL", () => {
    expect(youtubeSearchLink("théorie de l'attachement")).toEqual({
      query: "théorie de l'attachement",
      url: "https://www.youtube.com/results?search_query=th%C3%A9orie%20de%20l'attachement",
    });
  });
});

// ── Wikipedia ──────────────────────────────────────────────────────────────────

describe("searchWikipedia", () => {
  it("maps pages to article links", async () => {
    stubFetchJson({
      pages: [
        {
          key: "Théorie_de_l'attachement",
          title: "Théorie de l'attachement",
          description: "Théorie psychologique",
        },
        { title: "Sans clé" },
      ],
    });

    const articles = await searchWikipedia("attachement");
    expect(articles).toHaveLength(1);
    expect(articles[0]).toEqual({
      title: "Théorie de l'attachement",
      url: `https://fr.wikipedia.org/wiki/${encodeURIComponent("Théorie_de_l'attachement")}`,
      description: "Théorie psychologique",
      source: "wikipedia",
    });
  });

  it("returns [] on upstream failure", async () => {
    stubFetchJson({}, false);
    expect(await searchWikipedia("x")).toEqual([]);
  });

  it("returns [] when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("réseau")));
    expect(await searchWikipedia("x")).toEqual([]);
  });
});

// ── Openverse ──────────────────────────────────────────────────────────────────

describe("searchOpenverseImages", () => {
  it("maps results and drops non-https images", async () => {
    stubFetchJson({
      results: [
        {
          title: "Brain diagram",
          url: "https://img.example/brain.jpg",
          thumbnail: "https://img.example/brain_small.jpg",
          license: "by-sa",
          license_url: "https://creativecommons.org/licenses/by-sa/4.0/",
          creator: "Jane Doe",
          foreign_landing_url: "https://flickr.example/photo/1",
        },
        { title: "Insecure", url: "http://img.example/http.jpg" },
      ],
    });

    const images = await searchOpenverseImages("brain");
    expect(images).toHaveLength(1);
    expect(images[0]).toEqual({
      title: "Brain diagram",
      imageUrl: "https://img.example/brain.jpg",
      thumbnailUrl: "https://img.example/brain_small.jpg",
      pageUrl: "https://flickr.example/photo/1",
      license: "CC BY-SA",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
      creator: "Jane Doe",
    });
  });

  it("requests commercial-use licences", async () => {
    const fn = stubFetchJson({ results: [] });
    await searchOpenverseImages("brain");
    const calledUrl = String(fn.mock.calls[0]?.[0]);
    expect(calledUrl).toContain("license_type=commercial");
  });
});

// ── YouTube ────────────────────────────────────────────────────────────────────

describe("searchYoutubeVideos", () => {
  it("maps items and skips entries without a videoId", async () => {
    stubFetchJson({
      items: [
        {
          id: { videoId: "abc123" },
          snippet: {
            title: "L&#39;exp&eacute;rience de Harlow", // partial entities
            channelTitle: "Psy &amp; Co",
            thumbnails: {
              medium: { url: "https://i.ytimg.com/vi/abc123/m.jpg" },
            },
          },
        },
        { id: {}, snippet: { title: "sans id" } },
      ],
    });

    const videos = await searchYoutubeVideos("harlow", "fake-key");
    expect(videos).toHaveLength(1);
    expect(videos[0]?.videoId).toBe("abc123");
    expect(videos[0]?.url).toBe("https://www.youtube.com/watch?v=abc123");
    expect(videos[0]?.embedUrl).toBe("https://www.youtube.com/embed/abc123");
    expect(videos[0]?.channel).toBe("Psy & Co");
  });
});

// ── resolveResources ───────────────────────────────────────────────────────────

describe("resolveResources", () => {
  it("resolves without a YouTube key: search links only, no video calls", async () => {
    const fn = stubFetchJson({ pages: [], results: [] });

    const resolved = await resolveResources({
      references: [{ title: "Ouvrage" }],
      wikipediaQueries: ["concept"],
      videoQueries: ["requête vidéo"],
      imageQueries: ["image query"],
    });

    expect(resolved.videos).toEqual([]);
    expect(resolved.videoSearches).toEqual([
      youtubeSearchLink("requête vidéo"),
    ]);
    expect(resolved.references).toEqual([{ title: "Ouvrage" }]);

    const calledUrls = fn.mock.calls.map((c) => String(c[0]));
    expect(calledUrls.some((u) => u.includes("googleapis.com"))).toBe(false);
    expect(calledUrls.some((u) => u.includes("fr.wikipedia.org"))).toBe(true);
    expect(calledUrls.some((u) => u.includes("api.openverse.org"))).toBe(true);
  });

  it("dedupes articles across queries and caps lists", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((rawUrl: unknown) => {
        const url = String(rawUrl);
        const payload = url.includes("fr.wikipedia.org")
          ? {
              pages: [
                { key: "Même_page", title: "Même page", description: null },
              ],
            }
          : { results: [] };
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(payload),
        });
      }),
    );

    const resolved = await resolveResources({
      references: [],
      wikipediaQueries: ["a", "b", "c"],
      videoQueries: [],
      imageQueries: [],
    });

    expect(resolved.articles).toHaveLength(1);
  });
});
