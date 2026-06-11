import { extractText } from "unpdf";

// ── Text normalization ─────────────────────────────────────────────────────────
// PDF text layers carry typographic artefacts that pollute prompts and
// embeddings: curly quotes, soft hyphens, ligature glyphs, TOC dot leaders.
// Normalization is targeted — NFKC would also mangle superscripts.

// Control range and soft hyphen are composed at runtime — literal invisible
// bytes in source survive neither editors nor diffs (same approach as the
// composed control characters in modules/files/files.test.ts).
const ch = String.fromCharCode;
const CONTROL_CHARS = new RegExp(
  `[${ch(0)}-${ch(8)}${ch(11)}${ch(12)}${ch(14)}-${ch(31)}${ch(127)}]`,
  "g",
);
const SOFT_HYPHEN = new RegExp(ch(173), "g");
const CURLY_APOSTROPHES = /[‘’ʼ]/g;
const CURLY_QUOTES = /[“”]/g;
const LIGATURE_FI = /ﬁ/g;
const LIGATURE_FL = /ﬂ/g;

export function normalizePdfText(text: string): string {
  return text
    .normalize("NFC")
    .replace(CURLY_APOSTROPHES, "'")
    .replace(CURLY_QUOTES, '"')
    .replace(SOFT_HYPHEN, "")
    .replace(LIGATURE_FI, "fi")
    .replace(LIGATURE_FL, "fl")
    .replace(/\.{4,}/g, " ") // table-of-contents dot leaders
    .replace(CONTROL_CHARS, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── Per-page extraction ────────────────────────────────────────────────────────

/**
 * Extract normalized text for each page of a PDF.
 * Returns one string per page (index 0 = page 1); pages without a text layer
 * (e.g. scanned images) yield empty strings.
 */
export async function extractPdfPages(buffer: Buffer): Promise<string[]> {
  // Copy: pdf.js may transfer (detach) the buffer it is given. The result
  // shape is asserted because unpdf's declarations reference pdfjs-dist types
  // that the type-aware linter cannot resolve (error-typed otherwise).
  const result = (await extractText(new Uint8Array(buffer), {
    mergePages: false,
  })) as { totalPages: number; text: string[] };
  return result.text.map(normalizePdfText);
}

/**
 * True when the extracted pages carry enough text to be exploitable.
 * Scanned PDFs without an OCR layer fail this check.
 */
export function hasUsableText(pages: string[]): boolean {
  const total = pages.reduce((n, p) => n + p.length, 0);
  return total >= 200;
}
