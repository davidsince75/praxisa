import { describe, expect, it } from "vitest";
import { buildDocumentChunks } from "./document-ingest.service.js";

function words(n: number, prefix = "mot"): string {
  return Array.from({ length: n }, (_, i) => `${prefix}${String(i)}`).join(" ");
}

describe("buildDocumentChunks", () => {
  it("groups consecutive small pages until the word budget", () => {
    const chunks = buildDocumentChunks(
      [words(8, "a"), words(8, "b"), words(8, "c")],
      20,
      3,
    );
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toMatchObject({
      chunkIndex: 0,
      pageStart: 1,
      pageEnd: 2,
    });
    expect(chunks[1]).toMatchObject({
      chunkIndex: 1,
      pageStart: 3,
      pageEnd: 3,
    });
  });

  it("splits oversized pages into same-page chunks", () => {
    const chunks = buildDocumentChunks([words(5, "a"), words(50, "b")], 20, 3);
    expect(chunks[0]).toMatchObject({ pageStart: 1, pageEnd: 1 });
    const pageTwoChunks = chunks.filter((c) => c.pageStart === 2);
    expect(pageTwoChunks).toHaveLength(3);
    for (const c of pageTwoChunks) {
      expect(c.pageEnd).toBe(2);
    }
  });

  it("skips empty pages without breaking page numbering", () => {
    const chunks = buildDocumentChunks(["", words(8, "a"), ""], 20, 3);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ pageStart: 2, pageEnd: 2 });
  });

  it("does not claim skipped pages inside a buffered range", () => {
    // page 2 is empty: the chunk spanning pages 1 and 3 must end at page 3
    // but a chunk flushed right after page 1 must not extend to page 2.
    const chunks = buildDocumentChunks(
      [words(18, "a"), "", words(18, "b")],
      20,
      3,
    );
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toMatchObject({ pageStart: 1, pageEnd: 1 });
    expect(chunks[1]).toMatchObject({ pageStart: 3, pageEnd: 3 });
  });

  it("drops chunks below the minimum word count", () => {
    const chunks = buildDocumentChunks([words(2, "a")], 20, 3);
    expect(chunks).toHaveLength(0);
  });

  it("keeps chunk indexes sequential across strategies", () => {
    const chunks = buildDocumentChunks(
      [words(50, "a"), words(8, "b"), words(8, "c")],
      20,
      3,
    );
    expect(chunks.map((c) => c.chunkIndex)).toEqual(
      Array.from({ length: chunks.length }, (_, i) => i),
    );
  });
});
