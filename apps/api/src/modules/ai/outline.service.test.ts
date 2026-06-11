import { describe, expect, it } from "vitest";
import {
  groupPagesIntoWindows,
  outlineToPromptText,
  parseSectionsJson,
  tidySections,
} from "./outline.service.js";

// ── groupPagesIntoWindows ──────────────────────────────────────────────────────

describe("groupPagesIntoWindows", () => {
  it("splits pages into fixed-size windows with 1-based ranges", () => {
    const pages = Array.from({ length: 25 }, (_, i) => `page ${String(i + 1)}`);
    const windows = groupPagesIntoWindows(pages, 10);
    expect(windows).toHaveLength(3);
    expect(windows[0]).toMatchObject({ pageStart: 1, pageEnd: 10 });
    expect(windows[1]).toMatchObject({ pageStart: 11, pageEnd: 20 });
    expect(windows[2]).toMatchObject({ pageStart: 21, pageEnd: 25 });
  });

  it("prefixes each page with a page marker", () => {
    const windows = groupPagesIntoWindows(["alpha", "beta"], 10);
    expect(windows[0]?.text).toContain("[Page 1]");
    expect(windows[0]?.text).toContain("[Page 2]");
    expect(windows[0]?.text).toContain("beta");
  });

  it("truncates long pages to the char cap", () => {
    const windows = groupPagesIntoWindows(["x".repeat(5000)], 10, 100);
    const body = windows[0]?.text ?? "";
    expect(body.length).toBeLessThan(200);
  });
});

// ── parseSectionsJson ──────────────────────────────────────────────────────────

describe("parseSectionsJson", () => {
  it("parses a clean sections response", () => {
    const raw =
      '{"sections":[{"title":"Introduction","pageStart":1,"pageEnd":4,"summary":"Vue d\'ensemble."}]}';
    const sections = parseSectionsJson(raw);
    expect(sections).toEqual([
      {
        title: "Introduction",
        pageStart: 1,
        pageEnd: 4,
        summary: "Vue d'ensemble.",
      },
    ]);
  });

  it("tolerates markdown fences and surrounding prose", () => {
    const raw =
      'Voici le plan :\n```json\n{"sections":[{"title":"A","pageStart":2,"pageEnd":3,"summary":""}]}\n```\nFin.';
    const sections = parseSectionsJson(raw);
    expect(sections).toHaveLength(1);
    expect(sections?.[0]?.title).toBe("A");
  });

  it("returns null on non-JSON output", () => {
    expect(parseSectionsJson("Je ne peux pas répondre.")).toBeNull();
  });

  it("returns null on a wrong shape", () => {
    expect(parseSectionsJson('{"modules":[]}')).toBeNull();
  });

  it("clamps page numbers to be at least 1", () => {
    const raw =
      '{"sections":[{"title":"A","pageStart":-3,"pageEnd":0,"summary":""}]}';
    const sections = parseSectionsJson(raw);
    expect(sections?.[0]).toMatchObject({ pageStart: 1, pageEnd: 1 });
  });
});

// ── tidySections ───────────────────────────────────────────────────────────────

describe("tidySections", () => {
  it("sorts by page range and removes duplicates", () => {
    const tidy = tidySections([
      { title: "B", pageStart: 10, pageEnd: 20, summary: "" },
      { title: "A", pageStart: 1, pageEnd: 9, summary: "" },
      { title: "B", pageStart: 10, pageEnd: 20, summary: "" },
    ]);
    expect(tidy.map((s) => s.title)).toEqual(["A", "B"]);
  });

  it("clamps inverted ranges and drops empty titles", () => {
    const tidy = tidySections([
      { title: "X", pageStart: 8, pageEnd: 3, summary: "" },
      { title: "", pageStart: 1, pageEnd: 2, summary: "" },
    ]);
    expect(tidy).toHaveLength(1);
    expect(tidy[0]).toMatchObject({ pageStart: 8, pageEnd: 8 });
  });

  it("caps the number of sections", () => {
    const many = Array.from({ length: 60 }, (_, i) => ({
      title: `S${String(i)}`,
      pageStart: i + 1,
      pageEnd: i + 1,
      summary: "",
    }));
    expect(tidySections(many, 40)).toHaveLength(40);
  });
});

// ── outlineToPromptText ────────────────────────────────────────────────────────

describe("outlineToPromptText", () => {
  it("renders one line per section with page ranges", () => {
    const text = outlineToPromptText([
      { title: "Introduction", pageStart: 1, pageEnd: 4, summary: "Survol." },
      { title: "Aristote", pageStart: 5, pageEnd: 12, summary: "" },
    ]);
    expect(text).toBe("p. 1-4 — Introduction : Survol.\np. 5-12 — Aristote");
  });

  it("stops before exceeding the char budget", () => {
    const outline = Array.from({ length: 100 }, (_, i) => ({
      title: `Section ${String(i)} ${"x".repeat(50)}`,
      pageStart: i + 1,
      pageEnd: i + 2,
      summary: "y".repeat(50),
    }));
    const text = outlineToPromptText(outline, 500);
    expect(text.length).toBeLessThanOrEqual(500);
    expect(text).toContain("Section 0");
  });
});
