import { z } from "zod";
import type { UserRole } from "../../db/schema/index.js";

// ── Request schemas ────────────────────────────────────────────────────────────

export const registerBodySchema = z.object({
  email: z
    .string()
    .email()
    .max(254)
    .transform((s) => s.toLowerCase().trim()),
  password: z.string().min(12).max(128),
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim(),
  // Role defaults to student; admin/instructor assignment is done via admin API
  role: z
    .enum(["admin", "instructor", "student", "migration_lead"])
    .default("student"),
});

export const loginBodySchema = z.object({
  email: z
    .string()
    .email()
    .transform((s) => s.toLowerCase().trim()),
  password: z.string().min(1).max(128),
});

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;

// ── JWT payload ────────────────────────────────────────────────────────────────

export interface JwtPayload {
  sub: string;
  role: UserRole;
  email: string;
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
