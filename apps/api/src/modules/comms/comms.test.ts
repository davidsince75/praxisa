import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CommsConfig } from "./service.js";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendEnrolmentConfirmation,
  sendCourseCompletionEmail,
} from "./service.js";

// ── Mock fetch ─────────────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    text: () => Promise.resolve(""),
  });
});

// ── Helpers ────────────────────────────────────────────────────────────────────

const cfg: CommsConfig = {
  brevoApiKey: "test-api-key",
  senderEmail: "noreply@praxisa.test",
  senderName: "Praxisa",
  appBaseUrl: "https://app.praxisa.test",
};

interface BrevoPayload {
  sender: { email: string; name?: string };
  to: { email: string; name?: string }[];
  subject: string;
  htmlContent: string;
  textContent: string;
  tags?: string[];
}

function capturedPayload(): BrevoPayload {
  const call = mockFetch.mock.calls[0] as [string, RequestInit] | undefined;
  if (!call) throw new Error("fetch was not called");
  return JSON.parse(call[1].body as string) as BrevoPayload;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("sendVerificationEmail", () => {
  it("calls Brevo with correct sender, recipient, and verification URL", async () => {
    await sendVerificationEmail(
      cfg,
      { email: "student@example.com", firstName: "Alice" },
      "tok123",
    );

    expect(mockFetch).toHaveBeenCalledOnce();
    const body = capturedPayload();
    expect(body.sender.email).toBe("noreply@praxisa.test");
    expect(body.to[0]?.email).toBe("student@example.com");
    expect(body.tags).toContain("email-verification");
    expect(body.htmlContent).toContain(
      "https://app.praxisa.test/auth/verify-email?token=tok123",
    );
  });

  it("throws on non-OK Brevo response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: () => Promise.resolve("Unauthorized"),
    });

    await expect(
      sendVerificationEmail(cfg, { email: "x@x.com", firstName: "X" }, "t"),
    ).rejects.toThrow("Brevo API error 401");
  });
});

describe("sendPasswordResetEmail", () => {
  it("includes reset URL and correct tag", async () => {
    await sendPasswordResetEmail(
      cfg,
      { email: "user@example.com", firstName: "Bob" },
      "resetTok",
    );

    const body = capturedPayload();
    expect(body.tags).toContain("password-reset");
    expect(body.htmlContent).toContain(
      "https://app.praxisa.test/auth/reset-password?token=resetTok",
    );
  });
});

describe("sendEnrolmentConfirmation", () => {
  it("includes course title and course URL", async () => {
    await sendEnrolmentConfirmation(
      cfg,
      { email: "student@example.com", firstName: "Carol" },
      { id: "course-uuid", title: "Introduction au droit" },
    );

    const body = capturedPayload();
    expect(body.tags).toContain("enrolment-confirmation");
    expect(body.htmlContent).toContain("Introduction au droit");
    expect(body.htmlContent).toContain(
      "https://app.praxisa.test/courses/course-uuid",
    );
  });
});

describe("sendCourseCompletionEmail", () => {
  it("includes student first name and course title", async () => {
    await sendCourseCompletionEmail(
      cfg,
      { email: "student@example.com", firstName: "Dave" },
      "Gestion de projet avancee",
    );

    const body = capturedPayload();
    expect(body.tags).toContain("course-completion");
    expect(body.htmlContent).toContain("Dave");
    expect(body.htmlContent).toContain("Gestion de projet avancee");
  });
});
