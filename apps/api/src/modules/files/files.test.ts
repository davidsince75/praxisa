import { describe, expect, it } from "vitest";
import {
  MAX_PDF_BYTES,
  decodeFilenameHeader,
  hasPdfMagicBytes,
  isUuid,
  sanitizeFilename,
} from "./validation.js";

// Composed control characters — avoids escape sequences in string literals
const CR = String.fromCharCode(13);
const LF = String.fromCharCode(10);
const BACKSLASH = String.fromCharCode(92);

// ── PDF magic bytes ────────────────────────────────────────────────────────────

describe("hasPdfMagicBytes", () => {
  it("accepts a buffer starting with %PDF-", () => {
    const pdf = Buffer.concat([
      Buffer.from("%PDF-1.7 sample"),
      Buffer.alloc(64, 1),
    ]);
    expect(hasPdfMagicBytes(pdf)).toBe(true);
  });

  it("rejects HTML masquerading as PDF (spoofed mime type)", () => {
    expect(hasPdfMagicBytes(Buffer.from("<html><script>x</script>"))).toBe(
      false,
    );
  });

  it("rejects an empty buffer", () => {
    expect(hasPdfMagicBytes(Buffer.alloc(0))).toBe(false);
  });

  it("rejects a buffer shorter than the magic prefix", () => {
    expect(hasPdfMagicBytes(Buffer.from("%PD"))).toBe(false);
  });

  it("rejects %PDF appearing after the start", () => {
    expect(hasPdfMagicBytes(Buffer.from("junk%PDF-1.4"))).toBe(false);
  });
});

// ── X-Filename decoding ────────────────────────────────────────────────────────

describe("decodeFilenameHeader", () => {
  it("decodes a URL-encoded filename", () => {
    expect(decodeFilenameHeader("cours%20de%20psycho.pdf")).toBe(
      "cours de psycho.pdf",
    );
  });

  it("decodes accented characters", () => {
    expect(decodeFilenameHeader("le%C3%A7on.pdf")).toBe("leçon.pdf");
  });

  it("returns null (not throws) on malformed percent-encoding", () => {
    expect(decodeFilenameHeader("bad%zz.pdf")).toBeNull();
  });

  it("returns null on a lone trailing percent", () => {
    expect(decodeFilenameHeader("file%")).toBeNull();
  });
});

// ── Content-Disposition filename sanitization ──────────────────────────────────

describe("sanitizeFilename", () => {
  it("keeps an ordinary filename unchanged", () => {
    expect(sanitizeFilename("cours de psycho.pdf")).toBe("cours de psycho.pdf");
  });

  it("preserves accented characters", () => {
    expect(sanitizeFilename("leçon évaluée.pdf")).toBe("leçon évaluée.pdf");
  });

  it("strips double quotes (header-injection guard)", () => {
    const quote = String.fromCharCode(34);
    const input = "a" + quote + "; dummy=" + quote + "x.pdf";
    expect(sanitizeFilename(input)).toBe("a; dummy=x.pdf");
  });

  it("strips CR/LF control characters", () => {
    expect(sanitizeFilename("evil" + CR + LF + "Set-Cookie: x.pdf")).toBe(
      "evilSet-Cookie: x.pdf",
    );
  });

  it("strips backslashes and slashes (path-traversal lookalikes)", () => {
    const win = ".." + BACKSLASH + ".." + BACKSLASH + "sys.pdf";
    expect(sanitizeFilename(win)).toBe("....sys.pdf");
    expect(sanitizeFilename("../../etc/passwd.pdf")).toBe("....etcpasswd.pdf");
  });

  it("caps the length at 200 characters", () => {
    const long = "a".repeat(300) + ".pdf";
    expect(sanitizeFilename(long).length).toBe(200);
  });

  it("falls back to document.pdf when nothing safe remains", () => {
    const quote = String.fromCharCode(34);
    expect(sanitizeFilename(quote + quote + quote)).toBe("document.pdf");
    expect(sanitizeFilename("")).toBe("document.pdf");
    expect(sanitizeFilename(CR + LF)).toBe("document.pdf");
  });
});

// ── UUID route param ───────────────────────────────────────────────────────────

describe("isUuid", () => {
  it("accepts a valid v4 UUID", () => {
    expect(isUuid("3f2504e0-4f89-41d3-9a0c-0305e82c3301")).toBe(true);
  });

  it("accepts uppercase UUIDs", () => {
    expect(isUuid("3F2504E0-4F89-41D3-9A0C-0305E82C3301")).toBe(true);
  });

  it("rejects garbage that would 500 against a Postgres uuid column", () => {
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid("1; DROP TABLE uploaded_files;--")).toBe(false);
    expect(isUuid("")).toBe(false);
  });

  it("rejects a UUID with a missing segment", () => {
    expect(isUuid("3f2504e0-4f89-41d3-9a0c")).toBe(false);
  });
});

// ── Size limit constant ────────────────────────────────────────────────────────

describe("MAX_PDF_BYTES", () => {
  it("is 50 MB", () => {
    expect(MAX_PDF_BYTES).toBe(50 * 1024 * 1024);
  });
});
