import { z } from "zod";
import type { UserRole } from "../../db/schema/index.js";

// ── Request schemas ────────────────────────────────────────────────────────────

// SECURITY: no `role` field here. Public self-registration always creates a
// student account; admin/instructor accounts are created via the admin users
// API. Accepting a client-supplied role was a privilege-escalation hole.
export const registerBodySchema = z.object({
  email: z
    .string()
    .email()
    .max(254)
    .transform((s) => s.toLowerCase().trim()),
  password: z.string().min(12).max(128),
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim(),
});

export const loginBodySchema = z.object({
  email: z
    .string()
    .email()
    .transform((s) => s.toLowerCase().trim()),
  password: z.string().min(1).max(128),
});

export const verifyEmailBodySchema = z.object({
  token: z.string().min(1),
});

export const resendVerificationBodySchema = z.object({
  email: z
    .string()
    .email()
    .transform((s) => s.toLowerCase().trim()),
});

export const forgotPasswordBodySchema = z.object({
  email: z
    .string()
    .email()
    .transform((s) => s.toLowerCase().trim()),
});

export const resetPasswordBodySchema = z.object({
  token: z.string().min(1),
  password: z.string().min(12).max(128),
});

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
export type VerifyEmailBody = z.infer<typeof verifyEmailBodySchema>;
export type ForgotPasswordBody = z.infer<typeof forgotPasswordBodySchema>;
export type ResetPasswordBody = z.infer<typeof resetPasswordBodySchema>;

// ── JWT payload ────────────────────────────────────────────────────────────────

export interface JwtPayload {
  sub: string;
  role: UserRole;
  email: string;
  /**
   * Issued-at (epoch seconds). Present on verified tokens; the authenticate
   * decorator compares it against the password-reset invalidation watermark.
   */
  iat?: number;
}

// ── Response shapes ────────────────────────────────────────────────────────────

export interface UserDto {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
}

export interface AuthResponse {
  token: string;
  user: UserDto;
}
