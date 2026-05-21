import { describe, it, expect } from "vitest";
import { z } from "zod";

const ratingSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

describe("rating validation schema", () => {
  it("accepts rating 1 with no comment", () => {
    const result = ratingSchema.safeParse({ rating: 1 });
    expect(result.success).toBe(true);
  });

  it("accepts rating 5 with a comment", () => {
    const result = ratingSchema.safeParse({
      rating: 5,
      comment: "Excellent cours !",
    });
    expect(result.success).toBe(true);
  });

  it("accepts all valid ratings 1-5", () => {
    for (let r = 1; r <= 5; r++) {
      const result = ratingSchema.safeParse({ rating: r });
      expect(result.success).toBe(true);
    }
  });

  it("rejects rating 0 (below minimum)", () => {
    const result = ratingSchema.safeParse({ rating: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects rating 6 (above maximum)", () => {
    const result = ratingSchema.safeParse({ rating: 6 });
    expect(result.success).toBe(false);
  });

  it("rejects negative rating", () => {
    const result = ratingSchema.safeParse({ rating: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer rating", () => {
    const result = ratingSchema.safeParse({ rating: 3.5 });
    expect(result.success).toBe(false);
  });

  it("rejects missing rating field", () => {
    const result = ratingSchema.safeParse({ comment: "No rating" });
    expect(result.success).toBe(false);
  });

  it("rejects comment longer than 500 characters", () => {
    const result = ratingSchema.safeParse({
      rating: 4,
      comment: "a".repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it("accepts comment at exactly 500 characters", () => {
    const result = ratingSchema.safeParse({
      rating: 4,
      comment: "a".repeat(500),
    });
    expect(result.success).toBe(true);
  });
});

describe("courseRatings schema", () => {
  it("exports the courseRatings table definition", async () => {
    const { courseRatings } = await import("../../db/schema/ratings.js");
    expect(courseRatings).toBeDefined();
  });
});
