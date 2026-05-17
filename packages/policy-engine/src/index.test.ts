import { describe, it, expect } from "vitest";
import { evaluate, type Actor } from "./index.js";

const adminActor: Actor = { id: "user-1", type: "user", roles: ["admin"] };
const studentActor: Actor = { id: "user-2", type: "user", roles: ["student"] };
const instructorActor: Actor = {
  id: "user-3",
  type: "user",
  roles: ["instructor"],
};
const aiActor: Actor = { id: "ai-system", type: "ai", roles: [] };
const migrationLeadActor: Actor = {
  id: "user-4",
  type: "user",
  roles: ["migration_lead"],
};

describe("policy-engine", () => {
  describe("grade:publish hard block", () => {
    it("denies AI actor attempting to publish a grade", () => {
      const result = evaluate({
        actor: aiActor,
        action: "grade:publish",
        resourceType: "grade",
      });
      expect(result.allowed).toBe(false);
      expect(result.reasonCode).toContain("HARD_BLOCK");
    });

    it("allows admin actor to publish a grade", () => {
      const result = evaluate({
        actor: adminActor,
        action: "grade:publish",
        resourceType: "grade",
      });
      expect(result.allowed).toBe(true);
    });
  });

  describe("dsr:transition", () => {
    it("allows admin to transition a DSR", () => {
      const result = evaluate({
        actor: adminActor,
        action: "dsr:transition",
        resourceType: "data_subject_request",
      });
      expect(result.allowed).toBe(true);
    });

    it("denies student from transitioning a DSR", () => {
      const result = evaluate({
        actor: studentActor,
        action: "dsr:transition",
        resourceType: "data_subject_request",
      });
      expect(result.allowed).toBe(false);
      expect(result.reasonCode).toBe("INSUFFICIENT_ROLE_FOR_DSR");
    });
  });

  describe("pii:bulk_export", () => {
    it("denies admin without export reason", () => {
      const result = evaluate({
        actor: adminActor,
        action: "pii:bulk_export",
        resourceType: "users",
      });
      expect(result.allowed).toBe(false);
    });

    it("allows admin with export reason", () => {
      const result = evaluate({
        actor: adminActor,
        action: "pii:bulk_export",
        resourceType: "users",
        context: { exportReason: "GDPR SAR request #42" },
      });
      expect(result.allowed).toBe(true);
    });

    it("denies non-admin even with export reason", () => {
      const result = evaluate({
        actor: studentActor,
        action: "pii:bulk_export",
        resourceType: "users",
        context: { exportReason: "test" },
      });
      expect(result.allowed).toBe(false);
    });
  });

  describe("ai:execute_tier3", () => {
    it("allows instructor to execute tier 3 AI", () => {
      const result = evaluate({
        actor: instructorActor,
        action: "ai:execute_tier3",
        resourceType: "assessment",
      });
      expect(result.allowed).toBe(true);
    });

    it("denies student from executing tier 3 AI", () => {
      const result = evaluate({
        actor: studentActor,
        action: "ai:execute_tier3",
        resourceType: "assessment",
      });
      expect(result.allowed).toBe(false);
    });
  });

  describe("migration:execute", () => {
    it("allows migration lead to execute", () => {
      const result = evaluate({
        actor: migrationLeadActor,
        action: "migration:execute",
        resourceType: "import_batch",
      });
      expect(result.allowed).toBe(true);
    });

    it("denies admin without migration_lead role", () => {
      const result = evaluate({
        actor: adminActor,
        action: "migration:execute",
        resourceType: "import_batch",
      });
      expect(result.allowed).toBe(false);
    });
  });

  describe("decisionId uniqueness", () => {
    it("produces a unique decisionId on each evaluation", () => {
      const r1 = evaluate({
        actor: adminActor,
        action: "dsr:transition",
        resourceType: "dsr",
      });
      const r2 = evaluate({
        actor: adminActor,
        action: "dsr:transition",
        resourceType: "dsr",
      });
      expect(r1.decisionId).not.toBe(r2.decisionId);
    });
  });
});
