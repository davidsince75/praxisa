import { z } from "zod";

export const rectifyBodySchema = z
  .object({
    firstName: z.string().min(1).max(100).trim().optional(),
    lastName: z.string().min(1).max(100).trim().optional(),
  })
  .refine((d) => d.firstName !== undefined || d.lastName !== undefined, {
    message: "At least one field (firstName or lastName) must be provided",
  });

export const completeRequestParamsSchema = z.object({
  userId: z.string().uuid(),
});

export const completeRequestBodySchema = z.object({
  notes: z.string().max(1000).optional(),
});

export type RectifyBody = z.infer<typeof rectifyBodySchema>;
export type CompleteRequestBody = z.infer<typeof completeRequestBodySchema>;
