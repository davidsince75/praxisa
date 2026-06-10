import { useState, useEffect } from "react";
import type { UserRole } from "@/lib/api.js";

export type RoleFilter = UserRole | "all";

export const ROLES: UserRole[] = [
  "admin",
  "instructor",
  "student",
  "migration_lead",
];

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  instructor: "Formateur",
  student: "Apprenant",
  migration_lead: "Migration",
};

export function roleBadgeVariant(role: UserRole) {
  if (role === "admin") return "default" as const;
  if (role === "instructor") return "in_progress" as const;
  if (role === "student") return "completed" as const;
  return "pending" as const;
}

export function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(value);
    }, ms);
    return () => {
      clearTimeout(t);
    };
  }, [value, ms]);
  return debounced;
}
