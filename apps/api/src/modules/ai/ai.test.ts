import { describe, it, expect, vi, beforeEach } from "vitest";
import { chunkText } from "./embedding.service.js";
import { hasClinicalIntent, hasPii } from "./safety.js";

// ── chunkText ──────────────────────────────────────────────────────────────────

describe("chunkText", () => {
  it("returns empty array for empty string", () => {
    expect(chunkText("")).toEqual([]);
  });

  it("returns empty array for whitespace-only string", () => {
    expect(chunkText("   ")).toEqual([]);
  });

  it("returns single chunk when text is shorter than chunk size", () => {
    const text = "Hello world this is a test";
    const result = chunkText(text, 512, 64);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(text);
  });

  it("splits text into overlapping chunks", () => {
    // 10 words, chunkSize=4, overlap=2 → chunks start at 0, 2, 4, 6, 8
    const words = Array.from({ length: 10 }, (_, i) => `word${String(i)}`);
    const text = words.join(" ");
    const chunks = chunkText(text, 4, 2);

    // Each chunk should be <= 4 words
    for (const chunk of chunks) {
      expect(chunk.split(" ").length).toBeLessThanOrEqual(4);
    }
    // Should have more than one chunk
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("first and last words of text appear in first and last chunk respectively", () => {
    const words = Array.from({ length: 20 }, (_, i) => `w${String(i)}`);
    const text = words.join(" ");
    const chunks = chunkText(text, 6, 2);

    expect(chunks[0]).toContain("w0");
    expect(chunks[chunks.length - 1]).toContain("w19");
  });

  it("all words are covered across chunks", () => {
    const words = Array.from({ length: 30 }, (_, i) => `token${String(i)}`);
    const text = words.join(" ");
    const chunks = chunkText(text, 8, 2);
    const combined = chunks.join(" ");

    // Every word should appear at least once
    for (const word of words) {
      expect(combined).toContain(word);
    }
  });

  it("respects custom chunk size and overlap", () => {
    const words = Array.from({ length: 10 }, (_, i) => `x${String(i)}`);
    const text = words.join(" ");
    const chunks = chunkText(text, 5, 1);

    // chunkSize=5, overlap=1, 10 words → starts: 0, 4, 8 → 3 chunks
    expect(chunks).toHaveLength(3);
    expect(chunks[0]?.split(" ")).toHaveLength(5);
  });
});

// ── hasClinicalIntent ──────────────────────────────────────────────────────────

describe("hasClinicalIntent", () => {
  it("returns false for a normal learning question", () => {
    expect(hasClinicalIntent("How do I improve my negotiation skills?")).toBe(
      false,
    );
  });

  it("returns true for a suicide mention", () => {
    expect(hasClinicalIntent("I want to kill myself")).toBe(true);
  });

  it("returns true for a self-harm mention", () => {
    expect(hasClinicalIntent("I have been self-harming")).toBe(true);
  });

  it("returns true for medical diagnosis keyword", () => {
    expect(hasClinicalIntent("Can you diagnose my symptoms?")).toBe(true);
  });

  it("returns true for prescription keyword", () => {
    expect(
      hasClinicalIntent("What is the correct prescription for this?"),
    ).toBe(true);
  });

  it("returns true for French keyword automutilation", () => {
    expect(hasClinicalIntent("Je pratique l'automutilation")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(hasClinicalIntent("DIAGNOSIS")).toBe(true);
    expect(hasClinicalIntent("Suicide")).toBe(true);
  });

  it("returns false for an HR-related question in French", () => {
    expect(hasClinicalIntent("Comment gérer un conflit au travail?")).toBe(
      false,
    );
  });
});

// ── hasPii ─────────────────────────────────────────────────────────────────────

describe("hasPii", () => {
  it("returns false for clean text", () => {
    expect(hasPii("How do I create an invoice?")).toBe(false);
  });

  it("detects an email address", () => {
    expect(hasPii("Contact me at alice@example.com")).toBe(true);
  });

  it("detects a credit card number", () => {
    expect(hasPii("Card: 4111 1111 1111 1111")).toBe(true);
  });

  it("detects a French NIR (social security number)", () => {
    // Format: 1 digit sex + 2 birth year + 2 month + 2 dept + 3 commune + 3 serial + 2 key
    expect(hasPii("Mon NIR est 1 82 07 75 123 456 78")).toBe(true);
  });

  it("detects an IBAN", () => {
    expect(hasPii("My IBAN is FR7630006000011234567890189")).toBe(true);
  });

  it("returns false for a number that is not a credit card", () => {
    expect(hasPii("The answer is 1234")).toBe(false);
  });
});

// ── generateAdminDraft JSON parsing ───────────────────────────────────────────

vi.mock("./mistral-client.js", () => ({
  chatComplete: vi.fn(),
  MISTRAL_SMALL: "mistral-small-latest",
  embedTexts: vi.fn(),
}));

describe("generateAdminDraft JSON parsing (unit)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("parses well-formed JSON from LLM response", async () => {
    const { chatComplete } = await import("./mistral-client.js");
    (chatComplete as ReturnType<typeof vi.fn>).mockResolvedValue(
      JSON.stringify({
        subject: "Bienvenue chez Psychostudy",
        body: "Bonjour, voici votre accès.",
        intentClassification: "onboarding_welcome",
      }),
    );

    const { generateAdminDraft: generate } = await import("./rag.service.js");
    const draft = await generate("welcome new student", {}, "fake-key");

    expect(draft.subject).toBe("Bienvenue chez Psychostudy");
    expect(draft.body).toBe("Bonjour, voici votre accès.");
    expect(draft.intentClassification).toBe("onboarding_welcome");
  });

  it("returns fallback when LLM response is not valid JSON", async () => {
    const { chatComplete } = await import("./mistral-client.js");
    (chatComplete as ReturnType<typeof vi.fn>).mockResolvedValue(
      "Here is a draft email for you: Bonjour...",
    );

    const { generateAdminDraft: generate } = await import("./rag.service.js");
    const draft = await generate("some intent", {}, "fake-key");

    expect(draft.subject).toBe("(Draft — review required)");
    expect(draft.body).toContain("Bonjour");
    expect(draft.intentClassification).toBe("unknown");
  });
});
