const PDF_MAGIC = Buffer.from("%PDF-");

/** Max accepted PDF size: 50 MB (route bodyLimit is 55 MB for overhead). */
export const MAX_PDF_BYTES = 50 * 1024 * 1024;

/**
 * True when the buffer starts with the %PDF- magic bytes. The client-declared
 * Content-Type is not trusted — this checks the actual content.
 */
export function hasPdfMagicBytes(buffer: Buffer): boolean {
  return (
    buffer.length >= PDF_MAGIC.length &&
    buffer.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)
  );
}

/**
 * Decode the URL-encoded X-Filename header. Returns null instead of throwing
 * on malformed percent-encoding (e.g. "%zz"), which would otherwise be a 500.
 */
export function decodeFilenameHeader(raw: string): string | null {
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

/**
 * Make a filename safe for a quoted Content-Disposition value: strips control
 * characters, double quotes, backslashes and slashes, and caps the length.
 * Falls back to "document.pdf" when nothing safe remains.
 */
export function sanitizeFilename(filename: string): string {
  const cleaned = Array.from(filename)
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      if (code < 0x20 || code === 0x7f) return false;
      return ch !== '"' && ch !== "\\" && ch !== "/";
    })
    .join("")
    .trim()
    .slice(0, 200);

  return cleaned === "" ? "document.pdf" : cleaned;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validate a route param as a UUID before it reaches a Postgres uuid column. */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
