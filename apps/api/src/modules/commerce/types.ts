import { z } from "zod";

// Self-serve checkout body. `plan` excludes `comp` (admin-only grant).
export const createOrderSchema = z.object({
  courseId: z.string().uuid(),
  plan: z.enum(["full", "x3", "x10"]),
});

export type CreateOrderBody = z.infer<typeof createOrderSchema>;
