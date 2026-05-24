import type { FastifyInstance } from "fastify";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { courseRatings, enrolments } from "../../db/schema/index.js";

const ratingSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

export function ratingsPlugin(fastify: FastifyInstance) {
  // POST /courses/:courseId/ratings — student upserts a rating
  fastify.post(
    "/courses/:courseId/ratings",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub: studentId, role } = request.jwtPayload;
      const { courseId } = request.params as { courseId: string };

      if (role !== "student") {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      const parse = ratingSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }

      const enrolRows = await fastify.db
        .select({ status: enrolments.status })
        .from(enrolments)
        .where(
          and(
            eq(enrolments.studentId, studentId),
            eq(enrolments.courseId, courseId),
          ),
        )
        .limit(1);

      const enrol = enrolRows[0];
      if (enrol === undefined) {
        return reply.status(404).send({ error: "Inscription introuvable" });
      }
      if (enrol.status !== "completed") {
        return reply
          .status(400)
          .send({
            error: "Le cours doit être terminé avant de pouvoir l'évaluer",
          });
      }

      const inserted = await fastify.db
        .insert(courseRatings)
        .values({
          courseId,
          studentId,
          rating: parse.data.rating,
          comment: parse.data.comment ?? null,
        })
        .onConflictDoUpdate({
          target: [courseRatings.courseId, courseRatings.studentId],
          set: {
            rating: parse.data.rating,
            comment: parse.data.comment ?? null,
            updatedAt: new Date(),
          },
        })
        .returning();

      return reply.status(201).send({ rating: inserted[0] });
    },
  );

  // GET /courses/:courseId/ratings — admin/instructor view all
  fastify.get(
    "/courses/:courseId/ratings",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { role } = request.jwtPayload;

      if (role !== "admin" && role !== "instructor") {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      const { courseId } = request.params as { courseId: string };

      const rows = await fastify.db
        .select()
        .from(courseRatings)
        .where(eq(courseRatings.courseId, courseId))
        .orderBy(sql`${courseRatings.createdAt} DESC`);

      const avgRows = await fastify.db
        .select({
          avg: sql<string>`coalesce(round(avg(${courseRatings.rating})::numeric, 1), 0)`,
        })
        .from(courseRatings)
        .where(eq(courseRatings.courseId, courseId));

      const averageRating = parseFloat(avgRows[0]?.avg ?? "0");

      return reply.send({
        ratings: rows,
        averageRating,
        totalCount: rows.length,
      });
    },
  );

  // GET /courses/:courseId/my-rating — student's own rating
  fastify.get(
    "/courses/:courseId/my-rating",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub: studentId, role } = request.jwtPayload;

      if (role !== "student") {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      const { courseId } = request.params as { courseId: string };

      const rows = await fastify.db
        .select()
        .from(courseRatings)
        .where(
          and(
            eq(courseRatings.courseId, courseId),
            eq(courseRatings.studentId, studentId),
          ),
        )
        .limit(1);

      return reply.send({ rating: rows[0] ?? null });
    },
  );
}
