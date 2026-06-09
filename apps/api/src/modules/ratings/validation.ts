import { z } from "zod";

export const ratingSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

export type RatingInput = z.infer<typeof ratingSchema>;
