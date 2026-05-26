import type { FastifyInstance } from "fastify";
import { and, eq, desc } from "drizzle-orm";
import { z } from "zod";
import { studentDocuments, courses, users } from "../../db/schema/index.js";
import { createNotification } from "../notifications/service.js";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().max(50000).default(""),
  courseId: z.string().uuid().optional(),
  moduleId: z.string().uuid().optional(),
  lessonId: z.string().uuid().optional(),
  exerciseId: z.string().uuid().optional(),
});

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().max(50000).optional(),
});

const evaluateSchema = z.object({
  feedback: z.string().min(1).max(5000),
  score: z.number().int().min(0).optional(),
});

export function documentsPlugin(fastify: FastifyInstance) {
  // ── GET /documents ────────────────────────────────────────────────────────
  // Student lists their own documents, teacher/admin lists published docs.
  fastify.get(
    "/documents",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub: userId, role } = request.jwtPayload;
      const { courseId, lessonId, status } = request.query as {
        courseId?: string;
        lessonId?: string;
        status?: string;
      };

      const conditions = [];

      if (role === "student") {
        conditions.push(eq(studentDocuments.studentId, userId));
      } else if (role === "instructor" || role === "admin") {
        // Teachers see only published + evaluated docs
        if (status === undefined || status === "") {
          conditions.push(eq(studentDocuments.status, "published"));
        }
      } else {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      if (courseId !== undefined && courseId !== "") {
        conditions.push(eq(studentDocuments.courseId, courseId));
      }
      if (lessonId !== undefined && lessonId !== "") {
        conditions.push(eq(studentDocuments.lessonId, lessonId));
      }
      if (status !== undefined && status !== "" && role === "student") {
        conditions.push(
          eq(
            studentDocuments.status,
            status as "draft" | "published" | "evaluated",
          ),
        );
      }

      const rows = await fastify.db
        .select({
          id: studentDocuments.id,
          title: studentDocuments.title,
          status: studentDocuments.status,
          courseId: studentDocuments.courseId,
          moduleId: studentDocuments.moduleId,
          lessonId: studentDocuments.lessonId,
          exerciseId: studentDocuments.exerciseId,
          score: studentDocuments.score,
          publishedAt: studentDocuments.publishedAt,
          evaluatedAt: studentDocuments.evaluatedAt,
          createdAt: studentDocuments.createdAt,
          updatedAt: studentDocuments.updatedAt,
          studentId: studentDocuments.studentId,
          studentFirstName: users.firstName,
          studentLastName: users.lastName,
        })
        .from(studentDocuments)
        .innerJoin(users, eq(users.id, studentDocuments.studentId))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(studentDocuments.updatedAt))
        .limit(100);

      return reply.send({ documents: rows });
    },
  );

  // ── GET /documents/:id ────────────────────────────────────────────────────
  fastify.get(
    "/documents/:id",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub: userId, role } = request.jwtPayload;
      const { id } = request.params as { id: string };

      const rows = await fastify.db
        .select()
        .from(studentDocuments)
        .where(eq(studentDocuments.id, id))
        .limit(1);

      const doc = rows[0];
      if (doc === undefined) {
        return reply.status(404).send({ error: "Document introuvable" });
      }

      // Access: owner, or teacher/admin for published/evaluated
      if (role === "student" && doc.studentId !== userId) {
        return reply.status(403).send({ error: "Accès interdit" });
      }
      if (
        (role === "instructor" || role === "admin") &&
        doc.status === "draft"
      ) {
        return reply
          .status(403)
          .send({ error: "Ce document est encore en brouillon" });
      }

      return reply.send({ document: doc });
    },
  );

  // ── POST /documents ───────────────────────────────────────────────────────
  fastify.post(
    "/documents",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub: userId, role } = request.jwtPayload;

      if (role !== "student" && role !== "admin") {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      const parse = createSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }

      const inserted = await fastify.db
        .insert(studentDocuments)
        .values({
          studentId: userId,
          title: parse.data.title,
          body: parse.data.body,
          courseId: parse.data.courseId ?? null,
          moduleId: parse.data.moduleId ?? null,
          lessonId: parse.data.lessonId ?? null,
          exerciseId: parse.data.exerciseId ?? null,
        })
        .returning();

      const doc = inserted[0];
      if (doc === undefined) throw new Error("Insert returned no rows");

      return reply.status(201).send({ document: doc });
    },
  );

  // ── PATCH /documents/:id ──────────────────────────────────────────────────
  fastify.patch(
    "/documents/:id",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub: userId } = request.jwtPayload;
      const { id } = request.params as { id: string };

      const parse = updateSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }

      const rows = await fastify.db
        .select({
          studentId: studentDocuments.studentId,
          status: studentDocuments.status,
        })
        .from(studentDocuments)
        .where(eq(studentDocuments.id, id))
        .limit(1);

      const doc = rows[0];
      if (doc === undefined) {
        return reply.status(404).send({ error: "Document introuvable" });
      }
      if (doc.studentId !== userId) {
        return reply.status(403).send({ error: "Accès interdit" });
      }
      if (doc.status !== "draft") {
        return reply.status(400).send({
          error: "Seuls les documents en brouillon peuvent être modifiés",
        });
      }

      await fastify.db
        .update(studentDocuments)
        .set({
          ...parse.data,
          updatedAt: new Date(),
        })
        .where(eq(studentDocuments.id, id));

      const updated = await fastify.db
        .select()
        .from(studentDocuments)
        .where(eq(studentDocuments.id, id))
        .limit(1);

      return reply.send({ document: updated[0] });
    },
  );

  // ── POST /documents/:id/publish ───────────────────────────────────────────
  fastify.post(
    "/documents/:id/publish",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub: userId } = request.jwtPayload;
      const { id } = request.params as { id: string };

      const rows = await fastify.db
        .select({
          studentId: studentDocuments.studentId,
          status: studentDocuments.status,
          courseId: studentDocuments.courseId,
          title: studentDocuments.title,
        })
        .from(studentDocuments)
        .where(eq(studentDocuments.id, id))
        .limit(1);

      const doc = rows[0];
      if (doc === undefined) {
        return reply.status(404).send({ error: "Document introuvable" });
      }
      if (doc.studentId !== userId) {
        return reply.status(403).send({ error: "Accès interdit" });
      }
      if (doc.status !== "draft") {
        return reply.status(400).send({ error: "Ce document est déjà publié" });
      }

      await fastify.db
        .update(studentDocuments)
        .set({
          status: "published",
          publishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(studentDocuments.id, id));

      // Notify the course instructor if the document is linked to a course
      if (doc.courseId !== null) {
        const courseRows = await fastify.db
          .select({ instructorId: courses.instructorId })
          .from(courses)
          .where(eq(courses.id, doc.courseId))
          .limit(1);

        const course = courseRows[0];
        if (
          course?.instructorId !== undefined &&
          course.instructorId !== null
        ) {
          await createNotification(
            fastify.db,
            course.instructorId,
            "new_message",
            "Document soumis",
            `Un document "${doc.title}" a été soumis pour évaluation.`,
            "document",
            id,
          );
        }
      }

      const updated = await fastify.db
        .select()
        .from(studentDocuments)
        .where(eq(studentDocuments.id, id))
        .limit(1);

      return reply.send({ document: updated[0] });
    },
  );

  // ── POST /documents/:id/evaluate ──────────────────────────────────────────
  // Teacher evaluates a published document.
  fastify.post(
    "/documents/:id/evaluate",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub: graderId, role } = request.jwtPayload;
      const { id } = request.params as { id: string };

      if (role !== "instructor" && role !== "admin") {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      const parse = evaluateSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }

      const rows = await fastify.db
        .select({
          status: studentDocuments.status,
          studentId: studentDocuments.studentId,
        })
        .from(studentDocuments)
        .where(eq(studentDocuments.id, id))
        .limit(1);

      const doc = rows[0];
      if (doc === undefined) {
        return reply.status(404).send({ error: "Document introuvable" });
      }
      if (doc.status !== "published") {
        return reply
          .status(400)
          .send({ error: "Seuls les documents publiés peuvent être évalués" });
      }

      await fastify.db
        .update(studentDocuments)
        .set({
          status: "evaluated",
          feedback: parse.data.feedback,
          score: parse.data.score ?? null,
          evaluatedBy: graderId,
          evaluatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(studentDocuments.id, id));

      await createNotification(
        fastify.db,
        doc.studentId,
        "grading_returned",
        "Document évalué",
        "Votre document a été évalué par votre formateur.",
        "document",
        id,
      );

      const updated = await fastify.db
        .select()
        .from(studentDocuments)
        .where(eq(studentDocuments.id, id))
        .limit(1);

      return reply.send({ document: updated[0] });
    },
  );

  // ── DELETE /documents/:id ─────────────────────────────────────────────────
  fastify.delete(
    "/documents/:id",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub: userId } = request.jwtPayload;
      const { id } = request.params as { id: string };

      const rows = await fastify.db
        .select({
          studentId: studentDocuments.studentId,
          status: studentDocuments.status,
        })
        .from(studentDocuments)
        .where(eq(studentDocuments.id, id))
        .limit(1);

      const doc = rows[0];
      if (doc === undefined) {
        return reply.status(404).send({ error: "Document introuvable" });
      }
      if (doc.studentId !== userId) {
        return reply.status(403).send({ error: "Accès interdit" });
      }
      if (doc.status !== "draft") {
        return reply.status(400).send({
          error: "Seuls les documents en brouillon peuvent être supprimés",
        });
      }

      await fastify.db
        .delete(studentDocuments)
        .where(eq(studentDocuments.id, id));

      return reply.status(204).send();
    },
  );
}
