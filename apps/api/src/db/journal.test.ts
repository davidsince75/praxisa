import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

interface JournalEntry {
  idx: number;
  when: number;
  tag: string;
}

const journal = JSON.parse(
  readFileSync(
    new URL("./migrations/meta/_journal.json", import.meta.url),
    "utf8",
  ),
) as { entries: JournalEntry[] };

// Drizzle's migrator only applies a journal entry when its "when" value is
// strictly greater than the highest created_at already recorded in
// drizzle.__drizzle_migrations. A single out-of-order timestamp makes every
// later-added migration get skipped silently on already-initialised databases
// (this happened: entry 0000 carried a 2026 timestamp while the rest of the
// series used 2025 — uploaded_files, user_profiles and content_body were
// never created in long-lived environments).
describe("migration journal", () => {
  it("has strictly increasing when timestamps", () => {
    for (let i = 1; i < journal.entries.length; i++) {
      const prev = journal.entries[i - 1];
      const curr = journal.entries[i];
      if (prev === undefined || curr === undefined) continue;
      expect(
        curr.when,
        `${curr.tag} must have a when greater than ${prev.tag}`,
      ).toBeGreaterThan(prev.when);
    }
  });

  it("has sequential idx values starting at 0", () => {
    journal.entries.forEach((entry, i) => {
      expect(entry.idx, `${entry.tag} idx`).toBe(i);
    });
  });

  it("has a tag matching each idx prefix", () => {
    for (const entry of journal.entries) {
      const prefix = String(entry.idx).padStart(4, "0");
      expect(entry.tag.startsWith(prefix), `${entry.tag} prefix`).toBe(true);
    }
  });
});
