import { describe, it, expect } from "vitest";
import { normaliseRow, validateRow, processRows } from "./service.js";

// ── normaliseRow ───────────────────────────────────────────────────────────────

describe("normaliseRow", () => {
  it("maps English camelCase headers", () => {
    const result = normaliseRow({
      firstName: "Alice",
      lastName: "Dupont",
      email: "Alice.Dupont@example.com",
      role: "student",
    });
    expect(result.firstName).toBe("Alice");
    expect(result.lastName).toBe("Dupont");
    expect(result.email).toBe("alice.dupont@example.com");
    expect(result.role).toBe("student");
  });

  it("maps French headers", () => {
    const result = normaliseRow({
      prénom: "Bob",
      nom: "Martin",
      email: "bob.martin@example.com",
      role: "formateur",
    });
    expect(result.firstName).toBe("Bob");
    expect(result.lastName).toBe("Martin");
    expect(result.role).toBe("instructor");
  });

  it("maps snake_case headers", () => {
    const result = normaliseRow({
      first_name: "  Claire  ",
      last_name: "Leroy",
      email: "claire@example.com",
      role: "admin",
    });
    expect(result.firstName).toBe("Claire");
    expect(result.role).toBe("admin");
  });

  it("maps unknown role to student", () => {
    const result = normaliseRow({
      firstName: "X",
      lastName: "Y",
      email: "x@y.com",
      role: "wizard",
    });
    expect(result.role).toBe("student");
  });

  it("lowercases email", () => {
    const result = normaliseRow({
      Email: "USER@DOMAIN.COM",
      firstName: "A",
      lastName: "B",
    });
    expect(result.email).toBe("user@domain.com");
  });

  it("returns undefined phone when absent", () => {
    const result = normaliseRow({
      firstName: "A",
      lastName: "B",
      email: "a@b.com",
    });
    expect(result.phone).toBeUndefined();
  });

  it("returns phone when present", () => {
    const result = normaliseRow({
      firstName: "A",
      lastName: "B",
      email: "a@b.com",
      phone: "+33 6 12 34 56 78",
    });
    expect(result.phone).toBe("+33 6 12 34 56 78");
  });
});

// ── validateRow ────────────────────────────────────────────────────────────────

describe("validateRow", () => {
  const valid = {
    firstName: "Alice",
    lastName: "Dupont",
    email: "alice@example.com",
    role: "student" as const,
  };

  it("returns no issues for a valid row", () => {
    expect(validateRow(valid)).toHaveLength(0);
  });

  it("flags missing firstName as error", () => {
    const issues = validateRow({ ...valid, firstName: "" });
    expect(issues).toContainEqual(
      expect.objectContaining({
        ruleId: "required.firstName",
        severity: "error",
      }),
    );
  });

  it("flags missing lastName as error", () => {
    const issues = validateRow({ ...valid, lastName: "" });
    expect(issues).toContainEqual(
      expect.objectContaining({
        ruleId: "required.lastName",
        severity: "error",
      }),
    );
  });

  it("flags missing email as error", () => {
    const issues = validateRow({ ...valid, email: "" });
    expect(issues).toContainEqual(
      expect.objectContaining({ ruleId: "required.email", severity: "error" }),
    );
  });

  it("flags malformed email as error", () => {
    const issues = validateRow({ ...valid, email: "not-an-email" });
    expect(issues).toContainEqual(
      expect.objectContaining({ ruleId: "format.email", severity: "error" }),
    );
  });

  it("flags malformed phone as warning", () => {
    const issues = validateRow({ ...valid, phone: "abc" });
    expect(issues).toContainEqual(
      expect.objectContaining({ ruleId: "format.phone", severity: "warning" }),
    );
  });

  it("allows valid international phone", () => {
    const issues = validateRow({ ...valid, phone: "+33 6 12 34 56 78" });
    expect(issues.some((i) => i.field === "phone")).toBe(false);
  });
});

// ── processRows ────────────────────────────────────────────────────────────────

describe("processRows", () => {
  it("accepts a fully valid row", () => {
    const results = processRows([
      {
        rowRef: "R1",
        data: {
          firstName: "Alice",
          lastName: "Dupont",
          email: "alice@example.com",
          role: "student",
        },
      },
    ]);
    expect(results[0]?.accepted).toBe(true);
    expect(results[0]?.issues).toHaveLength(0);
  });

  it("rejects a row with missing required fields", () => {
    const results = processRows([
      { rowRef: "R2", data: { firstName: "", lastName: "", email: "" } },
    ]);
    expect(results[0]?.accepted).toBe(false);
    expect(results[0]?.issues.some((i) => i.severity === "error")).toBe(true);
  });

  it("detects intra-batch duplicate emails", () => {
    const results = processRows([
      {
        rowRef: "R1",
        data: { firstName: "A", lastName: "B", email: "dup@example.com" },
      },
      {
        rowRef: "R2",
        data: { firstName: "C", lastName: "D", email: "dup@example.com" },
      },
    ]);
    // First occurrence: accepted
    expect(results[0]?.accepted).toBe(true);
    // Second occurrence: rejected due to duplicate
    expect(results[1]?.accepted).toBe(false);
    expect(results[1]?.issues).toContainEqual(
      expect.objectContaining({ ruleId: "duplicate.email" }),
    );
  });

  it("preserves rowRef", () => {
    const results = processRows([
      {
        rowRef: "Sheet1:R42",
        data: { firstName: "A", lastName: "B", email: "a@b.com" },
      },
    ]);
    expect(results[0]?.rowRef).toBe("Sheet1:R42");
  });

  it("sets normalised data on accepted rows", () => {
    const results = processRows([
      {
        rowRef: "R1",
        data: {
          first_name: "Alice",
          last_name: "Dupont",
          email: "alice@example.com",
        },
      },
    ]);
    expect(results[0]?.normalised?.firstName).toBe("Alice");
  });

  it("sets normalised data on rejected rows (for diagnosis)", () => {
    const results = processRows([
      {
        rowRef: "R1",
        data: { first_name: "Alice", last_name: "Dupont", email: "bad-email" },
      },
    ]);
    expect(results[0]?.accepted).toBe(false);
    expect(results[0]?.normalised?.firstName).toBe("Alice");
  });
});
