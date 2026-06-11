import { describe, expect, it } from "vitest";
import {
  extractPdfPages,
  hasUsableText,
  normalizePdfText,
} from "./pdf-extract.js";

// Composed control characters — avoids escape sequences in string literals
const ch = String.fromCharCode;
const BELL = ch(7);
const SOFT_HYPHEN = ch(173);
const RIGHT_QUOTE = ch(8217); // U+2019
const LIG_FI = ch(64257); // U+FB01

// ── normalizePdfText ───────────────────────────────────────────────────────────

describe("normalizePdfText", () => {
  it("replaces curly apostrophes with straight ones", () => {
    expect(normalizePdfText(`l${RIGHT_QUOTE}introspection`)).toBe(
      "l'introspection",
    );
  });

  it("removes soft hyphens", () => {
    expect(normalizePdfText(`psycho${SOFT_HYPHEN}logie`)).toBe("psychologie");
  });

  it("expands fi ligatures", () => {
    expect(normalizePdfText(`dé${LIG_FI}nition`)).toBe("définition");
  });

  it("collapses table-of-contents dot leaders", () => {
    expect(normalizePdfText("Introduction .......... 14")).toBe(
      "Introduction 14",
    );
  });

  it("strips control characters", () => {
    expect(normalizePdfText(`avant${BELL}après`)).toBe("avant après");
  });

  it("collapses runs of spaces and blank lines", () => {
    expect(normalizePdfText("a   b\n\n\n\nc")).toBe("a b\n\nc");
  });

  it("applies NFC normalization to combining accents", () => {
    const decomposed = "e" + ch(769); // e + combining acute
    expect(normalizePdfText(decomposed)).toBe("é");
  });
});

// ── extractPdfPages (against a real, runtime-assembled PDF) ────────────────────

/**
 * Assemble a minimal valid PDF with one Helvetica text line per page.
 * Offsets in the xref table are computed from the actual byte layout, so
 * pdf.js parses it without falling back to reconstruction.
 */
function buildTestPdf(pageTexts: string[]): Buffer {
  const header = "%PDF-1.4\n";
  const objects: string[] = [];
  const pageCount = pageTexts.length;
  const kids = pageTexts.map((_, i) => `${String(3 + i)} 0 R`).join(" ");

  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  objects.push(
    `2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${String(pageCount)} >>\nendobj\n`,
  );

  const fontObjNo = 3 + pageCount * 2;
  for (let i = 0; i < pageCount; i++) {
    const pageObjNo = 3 + i;
    const contentObjNo = 3 + pageCount + i;
    objects.push(
      `${String(pageObjNo)} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${String(fontObjNo)} 0 R >> >> /Contents ${String(contentObjNo)} 0 R >>\nendobj\n`,
    );
  }
  for (let i = 0; i < pageCount; i++) {
    const contentObjNo = 3 + pageCount + i;
    const stream = `BT /F1 12 Tf 72 720 Td (${pageTexts[i] ?? ""}) Tj ET`;
    objects.push(
      `${String(contentObjNo)} 0 obj\n<< /Length ${String(stream.length)} >>\nstream\n${stream}\nendstream\nendobj\n`,
    );
  }
  objects.push(
    `${String(fontObjNo)} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`,
  );

  // Compute byte offsets for the xref table
  const offsets: number[] = [];
  let position = header.length;
  for (const obj of objects) {
    offsets.push(position);
    position += obj.length;
  }

  const xrefStart = position;
  const xrefEntries = offsets
    .map((o) => `${String(o).padStart(10, "0")} 00000 n \n`)
    .join("");
  const xref = `xref\n0 ${String(objects.length + 1)}\n0000000000 65535 f \n${xrefEntries}`;
  const trailer = `trailer\n<< /Size ${String(objects.length + 1)} /Root 1 0 R >>\nstartxref\n${String(xrefStart)}\n%%EOF\n`;

  return Buffer.from(header + objects.join("") + xref + trailer, "latin1");
}

describe("extractPdfPages", () => {
  it("extracts one string per page in order", async () => {
    const pdf = buildTestPdf([
      "Histoire de l'introspection",
      "Aristote et la psychologie",
    ]);
    const pages = await extractPdfPages(pdf);
    expect(pages).toHaveLength(2);
    expect(pages[0]).toContain("introspection");
    expect(pages[1]).toContain("Aristote");
  });
});

// ── hasUsableText ──────────────────────────────────────────────────────────────

describe("hasUsableText", () => {
  it("rejects pages with almost no text (scanned document)", () => {
    expect(hasUsableText(["", " ", ""])).toBe(false);
  });

  it("accepts pages with enough cumulative text", () => {
    expect(hasUsableText(["x".repeat(150), "y".repeat(100)])).toBe(true);
  });
});
