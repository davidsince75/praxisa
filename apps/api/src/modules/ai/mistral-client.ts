// Thin HTTP wrapper around the Mistral API.
// No SDK dependency — keeps the bundle small and the contract explicit.

const MISTRAL_BASE = "https://api.mistral.ai/v1";

export const MISTRAL_SMALL = "mistral-small-latest";
export const MISTRAL_EMBED = "mistral-embed";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function mistralPost<T>(
  path: string,
  body: unknown,
  apiKey: string,
): Promise<T> {
  const res = await fetch(`${MISTRAL_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mistral API error ${String(res.status)}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// ── Chat completion ────────────────────────────────────────────────────────────

interface ChatResponse {
  choices: { message: { content: string } }[];
}

export async function chatComplete(
  messages: ChatMessage[],
  model: string,
  apiKey: string,
): Promise<string> {
  const data = await mistralPost<ChatResponse>(
    "/chat/completions",
    { model, messages },
    apiKey,
  );

  const content = data.choices[0]?.message.content;
  if (content === undefined) throw new Error("Mistral returned no content");
  return content;
}

// ── Embeddings ─────────────────────────────────────────────────────────────────

interface EmbedResponse {
  data: { embedding: number[] }[];
}

/**
 * Embed one or more text strings.
 * Returns one float array per input string.
 * NOTE: Never pass raw student question text containing PII.
 */
export async function embedTexts(
  inputs: string[],
  apiKey: string,
): Promise<number[][]> {
  const data = await mistralPost<EmbedResponse>(
    "/embeddings",
    { model: MISTRAL_EMBED, input: inputs },
    apiKey,
  );

  return data.data.map((d) => d.embedding);
}
