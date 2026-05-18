import type {
  RawRow,
  RowResult,
  NormalisedUserRow,
  ValidationIssue,
} from "./types.js";

// ── Field-name candidates ──────────────────────────────────────────────────────
// Accept common French and English column headers from Excel exports.

const FIRST_NAME_KEYS = [
  "firstName",
  "first_name",
  "First Name",
  "prenom",
  "prénom",
  "Prénom",
  "PRENOM",
];
const LAST_NAME_KEYS = [
  "lastName",
  "last_name",
  "Last Name",
  "nom",
  "Nom",
  "NOM",
];
const EMAIL_KEYS = ["email", "Email", "EMAIL", "e-mail", "courriel"];
const ROLE_KEYS = ["role", "Role", "ROLE", "profil", "Profil"];
const PHONE_KEYS = [
  "phone",
  "Phone",
  "PHONE",
  "telephone",
  "téléphone",
  "tel",
  "Tel",
];

// ── Role mapping ───────────────────────────────────────────────────────────────

const ROLE_MAP: Record<string, NormalisedUserRow["role"]> = {
  student: "student",
  etudiant: "student",
  étudiant: "student",
  apprenant: "student",
  instructor: "instructor",
  formateur: "instructor",
  formatrice: "instructor",
  admin: "admin",
  administrateur: "admin",
  administratrice: "admin",
  migration_lead: "migration_lead",
};

// ── Validation regex ───────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[\d\s\-().]{7,20}$/;

// ── Helpers ────────────────────────────────────────────────────────────────────

function pickField(data: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(data, key)) return data[key];
  }
  return undefined;
}

function coerceString(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  return String(raw).trim();
}

function normaliseRole(raw: unknown): NormalisedUserRow["role"] {
  const s = coerceString(raw)
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return ROLE_MAP[s] ?? "student";
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Map a raw key-value row to a typed NormalisedUserRow.
 * Never throws — missing fields produce empty strings which validation will flag.
 */
export function normaliseRow(data: Record<string, unknown>): NormalisedUserRow {
  const email = coerceString(pickField(data, EMAIL_KEYS)).toLowerCase();
  const rawPhone = coerceString(pickField(data, PHONE_KEYS));

  // Build base without optional phone; add it only when non-empty to satisfy
  // exactOptionalPropertyTypes (phone?: string disallows phone: undefined).
  const row: NormalisedUserRow = {
    firstName: coerceString(pickField(data, FIRST_NAME_KEYS)),
    lastName: coerceString(pickField(data, LAST_NAME_KEYS)),
    email,
    role: normaliseRole(pickField(data, ROLE_KEYS)),
  };

  if (rawPhone) {
    row.phone = rawPhone;
  }

  return row;
}

/**
 * Run business-rule validation against a normalised row.
 * Returns an empty array when the row is fully valid.
 */
export function validateRow(normalised: NormalisedUserRow): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!normalised.firstName) {
    issues.push({
      ruleId: "required.firstName",
      field: "firstName",
      severity: "error",
      message: "First name is required",
    });
  } else if (normalised.firstName.length > 100) {
    issues.push({
      ruleId: "length.firstName",
      field: "firstName",
      severity: "error",
      message: "First name must not exceed 100 characters",
    });
  }

  if (!normalised.lastName) {
    issues.push({
      ruleId: "required.lastName",
      field: "lastName",
      severity: "error",
      message: "Last name is required",
    });
  } else if (normalised.lastName.length > 100) {
    issues.push({
      ruleId: "length.lastName",
      field: "lastName",
      severity: "error",
      message: "Last name must not exceed 100 characters",
    });
  }

  if (!normalised.email) {
    issues.push({
      ruleId: "required.email",
      field: "email",
      severity: "error",
      message: "Email is required",
    });
  } else if (!EMAIL_RE.test(normalised.email)) {
    issues.push({
      ruleId: "format.email",
      field: "email",
      severity: "error",
      message: "Email format is invalid",
    });
  } else if (normalised.email.length > 254) {
    issues.push({
      ruleId: "length.email",
      field: "email",
      severity: "error",
      message: "Email must not exceed 254 characters",
    });
  }

  if (normalised.phone !== undefined && !PHONE_RE.test(normalised.phone)) {
    issues.push({
      ruleId: "format.phone",
      field: "phone",
      severity: "warning",
      message: "Phone number format may be invalid",
    });
  }

  return issues;
}

/**
 * Process a batch of raw rows through normalisation and validation.
 * A row is accepted only when it has zero error-severity issues.
 */
export function processRows(rows: RawRow[]): RowResult[] {
  const seenEmails = new Map<string, number>(); // email → first occurrence index

  return rows.map((row, index) => {
    const normalised = normaliseRow(row.data);
    const issues = validateRow(normalised);

    // Intra-batch duplicate email detection
    if (normalised.email) {
      const firstSeen = seenEmails.get(normalised.email);
      if (firstSeen !== undefined) {
        issues.push({
          ruleId: "duplicate.email",
          field: "email",
          severity: "error",
          message: `Email already present in this batch (first seen at row index ${String(firstSeen)})`,
        });
      } else {
        seenEmails.set(normalised.email, index);
      }
    }

    const accepted = !issues.some((i) => i.severity === "error");

    return {
      rowRef: row.rowRef,
      rawData: row.data,
      normalised,
      issues,
      accepted,
    };
  });
}
