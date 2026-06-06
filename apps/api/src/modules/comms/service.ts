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
  campaignEmailHtml,
  campaignEmailText,
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
    subject: "Vérifiez votre adresse email — Psychostudy",
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
    subject: "Réinitialisation de votre mot de passe — Psychostudy",
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
    subject: `Inscription confirmée : ${course.title} — Psychostudy`,
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
    subject: `Formation terminée : ${courseTitle} — Psychostudy`,
    htmlContent: courseCompletionHtml(to.firstName, courseTitle),
    textContent: courseCompletionText(to.firstName, courseTitle),
    tags: ["course-completion"],
  });
}

// ── Campaign broadcast ─────────────────────────────────────────────────────────

export async function sendCampaignEmail(
  config: CommsConfig,
  to: { email: string; name: string },
  subject: string,
  body: string,
): Promise<void> {
  await sendBrevoEmail(config.brevoApiKey, {
    sender: { email: config.senderEmail, name: config.senderName },
    to: [{ email: to.email, name: to.name }],
    subject,
    htmlContent: campaignEmailHtml(subject, body),
    textContent: campaignEmailText(body),
    tags: ["campaign"],
  });
}
