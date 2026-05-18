import { sendBrevoEmail } from "./client.js";
import {
  verificationEmailHtml,
  verificationEmailText,
  passwordResetEmailHtml,
  passwordResetEmailText,
  enrolmentConfirmationHtml,
  enrolmentConfirmationText,
  courseCompletionHtml,
  courseCompletionText,
} from "./templates.js";

export interface CommsConfig {
  brevoApiKey: string;
  senderEmail: string;
  senderName: string;
  appBaseUrl: string;
}

// ── Email verification ─────────────────────────────────────────────────────────

export async function sendVerificationEmail(
  config: CommsConfig,
  to: { email: string; firstName: string },
  token: string,
): Promise<void> {
  const verifyUrl = `${config.appBaseUrl}/auth/verify-email?token=${token}`;
  await sendBrevoEmail(config.brevoApiKey, {
    sender: { email: config.senderEmail, name: config.senderName },
    to: [{ email: to.email, name: to.firstName }],
    subject: "Vérifiez votre adresse email — Praxisa",
    htmlContent: verificationEmailHtml(verifyUrl),
    textContent: verificationEmailText(verifyUrl),
    tags: ["email-verification"],
  });
}

// ── Password reset ─────────────────────────────────────────────────────────────

export async function sendPasswordResetEmail(
  config: CommsConfig,
  to: { email: string; firstName: string },
  token: string,
): Promise<void> {
  const resetUrl = `${config.appBaseUrl}/auth/reset-password?token=${token}`;
  await sendBrevoEmail(config.brevoApiKey, {
    sender: { email: config.senderEmail, name: config.senderName },
    to: [{ email: to.email, name: to.firstName }],
    subject: "Réinitialisation de votre mot de passe — Praxisa",
    htmlContent: passwordResetEmailHtml(resetUrl),
    textContent: passwordResetEmailText(resetUrl),
    tags: ["password-reset"],
  });
}

// ── Enrolment confirmation ─────────────────────────────────────────────────────

export async function sendEnrolmentConfirmation(
  config: CommsConfig,
  to: { email: string; firstName: string },
  course: { id: string; title: string },
): Promise<void> {
  const courseUrl = `${config.appBaseUrl}/courses/${course.id}`;
  await sendBrevoEmail(config.brevoApiKey, {
    sender: { email: config.senderEmail, name: config.senderName },
    to: [{ email: to.email, name: to.firstName }],
    subject: `Inscription confirmée : ${course.title} — Praxisa`,
    htmlContent: enrolmentConfirmationHtml(
      to.firstName,
      course.title,
      courseUrl,
    ),
    textContent: enrolmentConfirmationText(
      to.firstName,
      course.title,
      courseUrl,
    ),
    tags: ["enrolment-confirmation"],
  });
}

// ── Course completion ──────────────────────────────────────────────────────────

export async function sendCourseCompletionEmail(
  config: CommsConfig,
  to: { email: string; firstName: string },
  courseTitle: string,
): Promise<void> {
  await sendBrevoEmail(config.brevoApiKey, {
    sender: { email: config.senderEmail, name: config.senderName },
    to: [{ email: to.email, name: to.firstName }],
    subject: `Formation terminée : ${courseTitle} — Praxisa`,
    htmlContent: courseCompletionHtml(to.firstName, courseTitle),
    textContent: courseCompletionText(to.firstName, courseTitle),
    tags: ["course-completion"],
  });
}
