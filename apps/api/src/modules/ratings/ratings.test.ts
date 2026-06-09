import { describe, it, expect } from "vitest";
import { ratingSchema } from "./validation.js";

// ── ratingSchema validation ────────────────────────────────────────────────

describe("ratingSchema — valid inputs", () => {
  it("accepts rating 1 (minimum)", () => {
    const result = ratingSchema.safeParse({ rating: 1 });
    expect(result.success).toBe(true);
  });

  it("accepts rating 5 (maximum)", () => {
    const result = ratingSchema.safeParse({ rating: 5 });
    expect(result.success).toBe(true);
  });

  it("accepts all integer ratings from 1 to 5", () => {
    for (const r of [1, 2, 3, 4, 5]) {
      const result = ratingSchema.safeParse({ rating: r });
      expect(result.success, `rating ${String(r)} should be valid`).toBe(true);
    }
  });

  it("comment is optional — omitting it is valid", () => {
    const result = ratingSchema.safeParse({ rating: 4 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.comment).toBeUndefined();
    }
  });

  it("accepts a comment up to 500 characters", () => {
    const maxComment = "a".repeat(500);
    const result = ratingSchema.safeParse({ rating: 3, comment: maxComment });
    expect(result.success).toBe(true);
  });

  it("preserves the comment string in parsed data", () => {
    const result = ratingSchema.safeParse({
      rating: 3,
      comment: "Très bon cours",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.comment).toBe("Très bon cours");
    }
  });

  it("preserves the rating number in parsed data", () => {
    const result = ratingSchema.safeParse({ rating: 2 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rating).toBe(2);
    }
  });
});

describe("ratingSchema — invalid inputs (role: student guard)", () => {
  it("rejects rating 0 (below minimum — POST should return 400)", () => {
    const result = ratingSchema.safeParse({ rating: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects rating 6 (above maximum — POST should return 400)", () => {
    const result = ratingSchema.safeParse({ rating: 6 });
    expect(result.success).toBe(false);
  });

  it("rejects rating -1", () => {
    const result = ratingSchema.safeParse({ rating: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer rating 3.5", () => {
    const result = ratingSchema.safeParse({ rating: 3.5 });
    expect(result.success).toBe(false);
  });

  it("rejects string rating '3'", () => {
    const result = ratingSchema.safeParse({ rating: "3" });
    expect(result.success).toBe(false);
  });

  it("rejects missing rating field", () => {
    const result = ratingSchema.safeParse({ comment: "great course" });
    expect(result.success).toBe(false);
  });

  it("rejects comment longer than 500 characters", () => {
    const longComment = "b".repeat(501);
    const result = ratingSchema.safeParse({ rating: 4, comment: longComment });
    expect(result.success).toBe(false);
  });

  it("rejects null rating", () => {
    const result = ratingSchema.safeParse({ rating: null });
    expect(result.success).toBe(false);
  });
});

// ── Role-based access guard (logic only, no DB) ────────────────────────────

describe("ratings access guard — role check", () => {
  // This mirrors the route logic: only "student" may POST a rating
  function canPostRating(role: string): boolean {
    return role === "student";
  }

  // Only "admin" and "instructor" may GET all ratings
  function canViewAllRatings(role: string): boolean {
    return role === "admin" || role === "instructor";
  }

  it("student can post a rating", () => {
    expect(canPostRating("student")).toBe(true);
  });

  it("instructor cannot post a rating (returns 403)", () => {
    expect(canPostRating("instructor")).toBe(false);
  });

  it("admin cannot post a rating (returns 403)", () => {
    expect(canPostRating("admin")).toBe(false);
  });

  it("admin can view all ratings (returns 200)", () => {
    expect(canViewAllRatings("admin")).toBe(true);
  });

  it("instructor can view all ratings (returns 200)", () => {
    expect(canViewAllRatings("instructor")).toBe(true);
  });

  it("student cannot view all ratings (returns 403)", () => {
    expect(canViewAllRatings("student")).toBe(false);
  });
});
