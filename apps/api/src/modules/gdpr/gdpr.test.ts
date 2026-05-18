import { describe, it, expect } from "vitest";
import { rectifyBodySchema, completeRequestBodySchema } from "./types.js";

describe("rectifyBodySchema", () => {
  it("accepts firstName only", () => {
    expect(rectifyBodySchema.safeParse({ firstName: "Alice" }).success).toBe(
      true,
    );
  });

  it("accepts lastName only", () => {
    expect(rectifyBodySchema.safeParse({ lastName: "Smith" }).success).toBe(
      true,
    );
  });

  it("accepts both fields", () => {
    expect(
      rectifyBodySchema.safeParse({
        firstName: "Alice",
        lastName: "Smith",
      }).success,
    ).toBe(true);
  });

  it("rejects empty object (requires at least one field)", () => {
    expect(rectifyBodySchema.safeParse({}).success).toBe(false);
  });

  it("rejects firstName exceeding max length", () => {
    expect(
      rectifyBodySchema.safeParse({ firstName: "A".repeat(101) }).success,
    ).toBe(false);
  });
});

describe("completeRequestBodySchema", () => {
  it("accepts empty body", () => {
    expect(completeRequestBodySchema.safeParse({}).success).toBe(true);
  });

  it("accepts optional notes", () => {
    expect(
      completeRequestBodySchema.safeParse({ notes: "Hard delete confirmed" })
        .success,
    ).toBe(true);
  });

  it("rejects notes exceeding 1000 chars", () => {
    expect(
      completeRequestBodySchema.safeParse({ notes: "x".repeat(1001) }).success,
    ).toBe(false);
  });
});
