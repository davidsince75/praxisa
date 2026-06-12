import { describe, it, expect } from "vitest";
import {
  extractJsonObject,
  homeworkSystemPrompt,
  parseHomeworkSuggestion,
  parseResourceSuggestions,
  sanitizeGeneratedHtml,
  stripCodeFences,
} from "./authoring.service.js";

// ── stripCodeFences ────────────────────────────────────────────────────────────

describe("stripCodeFences", () => {
  it("returns plain HTML unchanged", () => {
    expect(stripCodeFences("<h2>Titre</h2><p>Texte</p>")).toBe(
      "<h2>Titre</h2><p>Texte</p>",
    );
  });

  it("unwraps an ```html fence", () => {
    const raw = "```html\n<h2>Titre</h2>\n<p>Texte</p>\n```";
    expect(stripCodeFences(raw)).toBe("<h2>Titre</h2>\n<p>Texte</p>");
  });

  it("unwraps a bare ``` fence", () => {
    const raw = "```\n<p>Texte</p>\n```";
    expect(stripCodeFences(raw)).toBe("<p>Texte</p>");
  });

  it("trims surrounding whitespace", () => {
    expect(stripCodeFences("  <p>x</p>  ")).toBe("<p>x</p>");
  });
});

// ── sanitizeGeneratedHtml ──────────────────────────────────────────────────────

describe("sanitizeGeneratedHtml", () => {
  it("keeps allowed lesson markup", () => {
    const html =
      "<h2>Section</h2><p>Un <strong>point</strong> et <em>une nuance</em>.</p><ul><li>a</li></ul>";
    expect(sanitizeGeneratedHtml(html)).toBe(html);
  });

  it("removes script blocks entirely", () => {
    const html = "<p>ok</p><script>alert(1)</script><p>fin</p>";
    expect(sanitizeGeneratedHtml(html)).toBe("<p>ok</p><p>fin</p>");
  });

  it("removes style blocks entirely", () => {
    const html = "<style>p{color:red}</style><p>ok</p>";
    expect(sanitizeGeneratedHtml(html)).toBe("<p>ok</p>");
  });

  it("strips iframe tags but keeps inner text", () => {
    const html = '<iframe src="https://evil.example">repli</iframe><p>ok</p>';
    expect(sanitizeGeneratedHtml(html)).toBe("repli<p>ok</p>");
  });

  it("strips html/body wrappers but keeps content", () => {
    const html = "<html><body><h2>Titre</h2></body></html>";
    expect(sanitizeGeneratedHtml(html)).toBe("<h2>Titre</h2>");
  });

  it("removes inline event handlers", () => {
    const html = '<p onclick="alert(1)" class="x">ok</p>';
    expect(sanitizeGeneratedHtml(html)).toBe('<p class="x">ok</p>');
  });

  it("removes javascript: URLs in href", () => {
    const html = '<a href="javascript:alert(1)">lien</a>';
    expect(sanitizeGeneratedHtml(html)).toBe("<a>lien</a>");
  });

  it("does not mangle prose that looks like an attribute", () => {
    const html = "<p>En français, onze = 11.</p>";
    expect(sanitizeGeneratedHtml(html)).toBe(html);
  });

  it("unwraps a fenced response before sanitising", () => {
    const raw = "```html\n<p>ok</p><script>x()</script>\n```";
    expect(sanitizeGeneratedHtml(raw)).toBe("<p>ok</p>");
  });
});

// ── extractJsonObject ──────────────────────────────────────────────────────────

describe("extractJsonObject", () => {
  it("parses a clean JSON object", () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 });
  });

  it("extracts JSON surrounded by prose", () => {
    expect(extractJsonObject('Voici :\n{"a":1}\nVoilà.')).toEqual({ a: 1 });
  });

  it("returns null when no JSON is present", () => {
    expect(extractJsonObject("pas de json ici")).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    expect(extractJsonObject('{"a":')).toBeNull();
  });
});

// ── parseHomeworkSuggestion ────────────────────────────────────────────────────

describe("parseHomeworkSuggestion", () => {
  it("parses a valid suggestion", () => {
    const raw = JSON.stringify({
      title: "Étude de cas",
      description: "Analysez le cas suivant.",
      maxScore: 20,
    });
    expect(parseHomeworkSuggestion(raw)).toEqual({
      title: "Étude de cas",
      description: "Analysez le cas suivant.",
      maxScore: 20,
    });
  });

  it("defaults maxScore to 20 when missing or invalid", () => {
    const raw = JSON.stringify({ title: "T", description: "D" });
    expect(parseHomeworkSuggestion(raw)?.maxScore).toBe(20);

    const bad = JSON.stringify({
      title: "T",
      description: "D",
      maxScore: "vingt",
    });
    expect(parseHomeworkSuggestion(bad)?.maxScore).toBe(20);
  });

  it("clamps maxScore into 1..100", () => {
    const high = JSON.stringify({
      title: "T",
      description: "D",
      maxScore: 500,
    });
    expect(parseHomeworkSuggestion(high)?.maxScore).toBe(100);

    const low = JSON.stringify({ title: "T", description: "D", maxScore: 0 });
    expect(parseHomeworkSuggestion(low)?.maxScore).toBe(1);
  });

  it("truncates an over-long title to 200 chars", () => {
    const raw = JSON.stringify({
      title: "x".repeat(500),
      description: "D",
    });
    expect(parseHomeworkSuggestion(raw)?.title).toHaveLength(200);
  });

  it("returns null when required fields are missing", () => {
    expect(parseHomeworkSuggestion('{"title":"seul"}')).toBeNull();
    expect(parseHomeworkSuggestion("rien")).toBeNull();
  });
});

// ── parseResourceSuggestions ───────────────────────────────────────────────────

describe("parseResourceSuggestions", () => {
  it("parses a full suggestion payload", () => {
    const raw = JSON.stringify({
      references: [
        {
          title: "L'attachement",
          author: "Bowlby",
          year: 1969,
          note: "Fondateur.",
        },
      ],
      wikipediaQueries: ["théorie de l'attachement"],
      videoQueries: ["expérience de Harlow"],
      imageQueries: ["attachment theory diagram"],
    });
    const parsed = parseResourceSuggestions(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.references).toEqual([
      {
        title: "L'attachement",
        author: "Bowlby",
        year: "1969",
        note: "Fondateur.",
      },
    ]);
    expect(parsed?.wikipediaQueries).toEqual(["théorie de l'attachement"]);
    expect(parsed?.videoQueries).toEqual(["expérience de Harlow"]);
    expect(parsed?.imageQueries).toEqual(["attachment theory diagram"]);
  });

  it("clamps list lengths (3 wiki, 2 video, 2 image, 4 references)", () => {
    const raw = JSON.stringify({
      references: Array.from({ length: 9 }, (_, i) => ({
        title: `R${String(i)}`,
      })),
      wikipediaQueries: ["a", "b", "c", "d", "e"],
      videoQueries: ["a", "b", "c"],
      imageQueries: ["a", "b", "c"],
    });
    const parsed = parseResourceSuggestions(raw);
    expect(parsed?.references).toHaveLength(4);
    expect(parsed?.wikipediaQueries).toHaveLength(3);
    expect(parsed?.videoQueries).toHaveLength(2);
    expect(parsed?.imageQueries).toHaveLength(2);
  });

  it("drops blank queries", () => {
    const raw = JSON.stringify({
      wikipediaQueries: ["  ", "valide"],
    });
    expect(parseResourceSuggestions(raw)?.wikipediaQueries).toEqual(["valide"]);
  });

  it("returns null when everything is empty", () => {
    expect(parseResourceSuggestions("{}")).toBeNull();
    expect(
      parseResourceSuggestions('{"references":[],"wikipediaQueries":[]}'),
    ).toBeNull();
    expect(parseResourceSuggestions("pas de json")).toBeNull();
  });
});

// ── homeworkSystemPrompt ───────────────────────────────────────────────────────

describe("homeworkSystemPrompt", () => {
  it("mentions the right exercise nature per type", () => {
    expect(homeworkSystemPrompt("assignment")).toContain("devoir à rendre");
    expect(homeworkSystemPrompt("reflection")).toContain(
      "réflexion personnelle",
    );
  });

  it("pins the JSON contract", () => {
    expect(homeworkSystemPrompt("assignment")).toContain(
      '{"title":"string","description":"string","maxScore":20}',
    );
  });
});
