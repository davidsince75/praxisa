// ── Safety classifier ──────────────────────────────────────────────────────────
// Keyword-based guards for Tier 1 student Q&A.
// Prevents Praxisa from acting as a medical or psychological diagnosis tool.

const CLINICAL_KEYWORDS = [
  // Medical diagnosis
  "diagnose",
  "diagnosis",
  "symptom",
  "medication",
  "drug dosage",
  "prescription",
  "disease",
  "disorder",
  "treatment plan",
  "clinical",
  "psychiatric",
  "antidepressant",
  "antipsychotic",
  "dosage",
  // Psychological / crisis
  "suicide",
  "self-harm",
  "self harm",
  "overdose",
  "crisis line",
  "kill myself",
  "end my life",
  // French equivalents
  "diagnostiquer",
  "diagnostic",
  "médicament",
  "ordonnance",
  "maladie",
  "automutilation",
  "suicide",
  "crise",
];

const PII_PATTERNS = [
  // French/EU social security number (NIR)
  /\b[12]\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{3}\s?\d{3}\s?\d{2}\b/,
  // Generic credit card-like (16 digits)
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/,
  // IBAN
  /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7,19}\b/,
  // Email address
  /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/,
];

/**
 * Returns true if the text appears to contain clinical or crisis intent.
 * When true, Tier 1 must escalate rather than generate a response.
 */
export function hasClinicalIntent(text: string): boolean {
  const lower = text.toLowerCase();
  return CLINICAL_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Returns true if the text likely contains personally identifiable information.
 * When true, embedding requests must be blocked (PII must not leave the server
 * in an embedding API call per the AI data governance policy).
 */
export function hasPii(text: string): boolean {
  return PII_PATTERNS.some((re) => re.test(text));
}
