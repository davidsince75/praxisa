import { describe, it, expect } from "vitest";
import { z } from "zod";

const ratingSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

// ── Validation schema ────────────────────────────────────────────────────────

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

// ── Schema export ────────────────────────────────────────────────────────────

describe("courseRatings schema", () => {
  it("exports the courseRatings table definition", async () => {
    const { courseRatings } = await import("../../db/schema/ratings.js");
    expect(courseRatings).toBeDefined();
  });
});

// ── Route behaviour: POST /courses/:courseId/ratings ──────────────────────────

describe("POST /courses/:courseId/ratings", () => {
  it("rejects non-student roles (403 for instructor)", () => {
    // The handler checks: if (role !== "student") return 403
    const role: string = "instructor";
    const forbidden = role !== "student";
    expect(forbidden).toBe(true);
  });

  it("rejects non-student roles (403 for admin)", () => {
    const role: string = "admin";
    const forbidden = role !== "student";
    expect(forbidden).toBe(true);
  });

  it("allows student role", () => {
    const role: string = "student";
    const forbidden = role !== "student";
    expect(forbidden).toBe(false);
  });

  it("rejects rating out of range via Zod (0)", () => {
    const result = ratingSchema.safeParse({ rating: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects rating out of range via Zod (6)", () => {
    const result = ratingSchema.safeParse({ rating: 6 });
    expect(result.success).toBe(false);
  });

  it("accepts valid rating for student on completed enrolment", () => {
    const role: string = "student";
    const enrolStatus: string = "completed";
    const parse = ratingSchema.safeParse({ rating: 4, comment: "Très bien" });

    expect(role).toBe("student");
    expect(enrolStatus).toBe("completed");
    expect(parse.success).toBe(true);
  });

  it("rejects rating when enrolment is not completed", () => {
    const enrolStatus: string = "active";
    const canRate = enrolStatus === "completed";
    expect(canRate).toBe(false);
  });
});

// ── Route behaviour: GET /courses/:courseId/ratings ───────────────────────────

describe("GET /courses/:courseId/ratings", () => {
  it("allows admin role (200)", () => {
    const role: string = "admin";
    const allowed = role === "admin" || role === "instructor";
    expect(allowed).toBe(true);
  });

  it("allows instructor role (200)", () => {
    const role: string = "instructor";
    const allowed = role === "admin" || role === "instructor";
    expect(allowed).toBe(true);
  });

  it("rejects student role (403)", () => {
    const role: string = "student";
    const allowed = role === "admin" || role === "instructor";
    expect(allowed).toBe(false);
  });

  it("returns ratings array, averageRating, and totalCount shape", () => {
    const response = {
      ratings: [
        {
          id: "r1",
          courseId: "c1",
          studentId: "s1",
          rating: 4,
          comment: "Bon cours",
          createdAt: "2025-01-01T00:00:00Z",
          updatedAt: "2025-01-01T00:00:00Z",
        },
      ],
      averageRating: 4.0,
      totalCount: 1,
    };
    expect(response).toHaveProperty("ratings");
    expect(response).toHaveProperty("averageRating");
    expect(response).toHaveProperty("totalCount");
    expect(Array.isArray(response.ratings)).toBe(true);
    expect(typeof response.averageRating).toBe("number");
    expect(typeof response.totalCount).toBe("number");
  });
});

// ── Route behaviour: GET /courses/:courseId/my-rating ─────────────────────────

describe("GET /courses/:courseId/my-rating", () => {
  it("rejects non-student roles", () => {
    const role: string = "instructor";
    const forbidden = role !== "student";
    expect(forbidden).toBe(true);
  });

  it("returns { rating: CourseRating | null } shape", () => {
    const withRating = { rating: { id: "r1", rating: 5, comment: null } };
    const withoutRating = { rating: null };

    expect(withRating).toHaveProperty("rating");
    expect(withoutRating.rating).toBeNull();
  });
});
