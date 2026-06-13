import { describe, expect, it } from "vitest";
import { computeCompletion } from "./service.js";
import {
  createCourseSchema,
  createEnrolmentSchema,
  createExerciseSchema,
  createLessonSchema,
  createModuleSchema,
  upsertProgressSchema,
} from "./types.js";

// ── computeCompletion ─────────────────────────────────────────────────────────

describe("computeCompletion", () => {
  it("returns 0 for empty progress list", () => {
    expect(computeCompletion([])).toBe(0);
  });

  it("returns 0 when nothing is completed", () => {
    const p = [{ status: "not_started" }, { status: "in_progress" }];
    expect(computeCompletion(p)).toBe(0);
  });

  it("returns 100 when all lessons are completed", () => {
    const p = [{ status: "completed" }, { status: "completed" }];
    expect(computeCompletion(p)).toBe(100);
  });

  it("returns 50 for half completed", () => {
    const p = [{ status: "completed" }, { status: "not_started" }];
    expect(computeCompletion(p)).toBe(50);
  });

  it("rounds to nearest integer", () => {
    const p = [
      { status: "completed" },
      { status: "not_started" },
      { status: "not_started" },
    ];
    expect(computeCompletion(p)).toBe(33);
  });
});

// ── Schema validation ─────────────────────────────────────────────────────────

describe("createCourseSchema", () => {
  it("accepts a valid course", () => {
    const r = createCourseSchema.safeParse({
      slug: "intro-psychology",
      title: "Introduction to Psychology",
      language: "fr",
    });
    expect(r.success).toBe(true);
  });

  it("rejects slug with uppercase or spaces", () => {
    expect(
      createCourseSchema.safeParse({ slug: "Bad Slug", title: "T" }).success,
    ).toBe(false);
    expect(
      createCourseSchema.safeParse({ slug: "Bad", title: "T" }).success,
    ).toBe(false);
  });

  it("defaults language to 'fr'", () => {
    const r = createCourseSchema.safeParse({
      slug: "test-course",
      title: "Test",
    });
    expect(r.success && r.data.language).toBe("fr");
  });
});

describe("createModuleSchema", () => {
  it("accepts a valid module", () => {
    const r = createModuleSchema.safeParse({ title: "Module 1", position: 0 });
    expect(r.success).toBe(true);
  });

  it("defaults position to 0", () => {
    const r = createModuleSchema.safeParse({ title: "Module 1" });
    expect(r.success && r.data.position).toBe(0);
  });
});

describe("createLessonSchema", () => {
  it("accepts a valid lesson", () => {
    const r = createLessonSchema.safeParse({
      title: "Lesson 1",
      contentType: "video",
    });
    expect(r.success).toBe(true);
  });

  it("defaults contentType to text", () => {
    const r = createLessonSchema.safeParse({ title: "Lesson 1" });
    expect(r.success && r.data.contentType).toBe("text");
  });

  it("rejects unknown content types", () => {
    const r = createLessonSchema.safeParse({
      title: "L",
      contentType: "slides",
    });
    expect(r.success).toBe(false);
  });

  it("accepts quiz as a content type", () => {
    const r = createLessonSchema.safeParse({
      title: "Lesson 1",
      contentType: "quiz",
    });
    expect(r.success && r.data.contentType).toBe("quiz");
  });
});

describe("createExerciseSchema", () => {
  it("accepts a valid exercise", () => {
    const r = createExerciseSchema.safeParse({ title: "Quiz 1", type: "quiz" });
    expect(r.success).toBe(true);
  });

  it("rejects unknown exercise types", () => {
    const r = createExerciseSchema.safeParse({ title: "E", type: "essay" });
    expect(r.success).toBe(false);
  });

  it("defaults isRequired to true", () => {
    const r = createExerciseSchema.safeParse({
      title: "E",
      type: "reflection",
    });
    expect(r.success && r.data.isRequired).toBe(true);
  });
});

describe("createEnrolmentSchema", () => {
  it("accepts self-enrolment (no studentId)", () => {
    const r = createEnrolmentSchema.safeParse({
      courseId: "00000000-0000-0000-0000-000000000001",
    });
    expect(r.success).toBe(true);
  });

  it("accepts admin enrolment with studentId", () => {
    const r = createEnrolmentSchema.safeParse({
      courseId: "00000000-0000-0000-0000-000000000001",
      studentId: "00000000-0000-0000-0000-000000000002",
    });
    expect(r.success).toBe(true);
  });

  it("rejects invalid courseId", () => {
    const r = createEnrolmentSchema.safeParse({ courseId: "not-a-uuid" });
    expect(r.success).toBe(false);
  });
});

describe("upsertProgressSchema", () => {
  it("accepts valid statuses", () => {
    for (const status of ["not_started", "in_progress", "completed"] as const) {
      expect(upsertProgressSchema.safeParse({ status }).success).toBe(true);
    }
  });

  it("accepts optional timeSpentSeconds", () => {
    const r = upsertProgressSchema.safeParse({
      status: "in_progress",
      timeSpentSeconds: 120,
    });
    expect(r.success && r.data.timeSpentSeconds).toBe(120);
  });
});
