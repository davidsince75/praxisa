import type { FastifyInstance } from "fastify";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { emitEvent } from "@praxisa/audit-sdk";
import {
  exercises,
  quizAttempts,
  quizQuestions,
} from "../../db/schema/index.js";
import { findActiveEnrolment, upsertLessonProgress } from "./service.js";

export function quizRoutes(fastify: FastifyInstance): void {
  // ═════════════════════════════════════════════════════════════════════════
  // QUIZ SUBMISSION
  // ═════════════════════════════════════════════════════════════════════════

  // POST /exercises/:exerciseId/attempt
  // Submit a quiz attempt; calculates score, stores result, marks lesson progress
  fastify.post(
    "/exercises/:exerciseId/attempt",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { exerciseId } = request.params as { exerciseId: string };
      const { sub, role } = request.jwtPayload;

      const attemptSchema = z.object({
        enrolmentId: z.string().uuid(),
        // { [questionId]: selectedOptionId }
        answers: z.record(z.string(), z.string()),
      });

      const parse = attemptSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }
      const { enrolmentId, answers } = parse.data;

      // Verify enrolment ownership
      const enrolment = await findActiveEnrolment(fastify.db, enrolmentId);
      if (enrolment === undefined) {
        return reply.status(404).send({ error: "Inscription introuvable" });
      }
      if (role !== "admin" && enrolment.studentId !== sub) {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      // Fetch exercise
      const exerciseRows = await fastify.db
        .select()
        .from(exercises)
        .where(eq(exercises.id, exerciseId))
        .limit(1);
      const exercise = exerciseRows[0];
      if (exercise === undefined) {
        return reply.status(404).send({ error: "Exercice introuvable" });
      }
      if (exercise.type !== "quiz") {
        return reply.status(400).send({ error: "Exercise is not a quiz" });
      }

      // Fetch questions and grade
      const questions = await fastify.db
        .select()
        .from(quizQuestions)
        .where(eq(quizQuestions.exerciseId, exerciseId))
        .orderBy(asc(quizQuestions.position));

      let score = 0;
      const maxScore = questions.length;
      const feedback: {
        questionId: string;
        correct: boolean;
        correctOptionId: string;
        explanation: string | null;
      }[] = [];

      for (const q of questions) {
        const selected = answers[q.id];
        const correct = selected === q.correctOptionId;
        if (correct) score += 1;
        feedback.push({
          questionId: q.id,
          correct,
          correctOptionId: q.correctOptionId,
          explanation: q.explanation ?? null,
        });
      }

      // Persist attempt
      const attemptReturned = await fastify.db
        .insert(quizAttempts)
        .values({
          exerciseId,
          studentId: sub,
          enrolmentId,
          answers: JSON.stringify(answers),
          score,
          maxScore,
          completedAt: new Date(),
        })
        .returning();
      const attempt = attemptReturned[0];
      if (attempt === undefined) throw new Error("Insert returned no rows");

      // Mark the parent lesson as completed if passed (≥ 70%)
      const passed = maxScore === 0 || score / maxScore >= 0.7;
      if (passed) {
        await upsertLessonProgress(
          fastify.db,
          enrolmentId,
          exercise.lessonId,
          "completed",
          0,
        );
      }

      await emitEvent({
        actorUserId: sub,
        eventType: "learning.quiz.attempted",
        entityType: "quiz_attempt",
        entityId: attempt.id,
        dataClassification: "pii:pseudonymous",
        requestId: request.id,
        sourceIp: request.ip,
      });

      return reply.status(201).send({
        attempt: {
          id: attempt.id,
          score,
          maxScore,
          passed,
          completedAt: attempt.completedAt,
        },
        feedback,
      });
    },
  );

  // ═════════════════════════════════════════════════════════════════════════
  // EXERCISES
  // ═════════════════════════════════════════════════════════════════════════

  // GET /exercises/:exerciseId
  // Returns exercise details with quiz questions.
  // correctOptionId is stripped for non-admin roles.
  fastify.get(
    "/exercises/:exerciseId",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { exerciseId } = request.params as { exerciseId: string };
      const { role } = request.jwtPayload;

      const exerciseRows = await fastify.db
        .select()
        .from(exercises)
        .where(eq(exercises.id, exerciseId))
        .limit(1);
      const exercise = exerciseRows[0];
      if (exercise === undefined) {
        return reply.status(404).send({ error: "Exercice introuvable" });
      }

      const questions = await fastify.db
        .select()
        .from(quizQuestions)
        .where(eq(quizQuestions.exerciseId, exerciseId))
        .orderBy(asc(quizQuestions.position));

      const sanitised = questions.map((q) => ({
        id: q.id,
        position: q.position,
        questionText: q.questionText,
        options: JSON.parse(q.options) as { id: string; text: string }[],
        explanation: q.explanation,
        // Admins and instructors see the answer key
        ...(role === "admin" || role === "instructor"
          ? { correctOptionId: q.correctOptionId }
          : {}),
      }));

      return reply.send({ exercise, questions: sanitised });
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // QUIZ QUESTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  // POST /exercises/:exerciseId/questions — bulk create questions
  fastify.post(
    "/exercises/:exerciseId/questions",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { exerciseId } = request.params as { exerciseId: string };
      const { role } = request.jwtPayload;
      if (role !== "instructor" && role !== "admin") {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      const bodySchema = z.object({
        questions: z
          .array(
            z.object({
              questionText: z.string().min(1).max(1000),
              options: z
                .array(z.object({ id: z.string(), text: z.string().min(1) }))
                .min(2)
                .max(6),
              correctOptionId: z.string().min(1),
              explanation: z.string().max(2000).optional(),
            }),
          )
          .min(1)
          .max(20),
      });

      const parse = bodySchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }

      // Get current max position
      const existing = await fastify.db
        .select({ position: quizQuestions.position })
        .from(quizQuestions)
        .where(eq(quizQuestions.exerciseId, exerciseId))
        .orderBy(desc(quizQuestions.position))
        .limit(1);

      let nextPosition = (existing[0]?.position ?? -1) + 1;

      const rows = parse.data.questions.map((q) => ({
        exerciseId,
        position: nextPosition++,
        questionText: q.questionText,
        options: JSON.stringify(q.options),
        correctOptionId: q.correctOptionId,
        explanation: q.explanation ?? null,
      }));

      const created = await fastify.db
        .insert(quizQuestions)
        .values(rows)
        .returning();

      return reply.status(201).send({
        questions: created.map((q) => ({
          id: q.id,
          position: q.position,
          questionText: q.questionText,
          options: JSON.parse(q.options) as { id: string; text: string }[],
          correctOptionId: q.correctOptionId,
          explanation: q.explanation,
        })),
      });
    },
  );

  // DELETE /exercises/:exerciseId/questions/:questionId
  fastify.delete(
    "/exercises/:exerciseId/questions/:questionId",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { exerciseId, questionId } = request.params as {
        exerciseId: string;
        questionId: string;
      };
      const { role } = request.jwtPayload;
      if (role !== "instructor" && role !== "admin") {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      const deleted = await fastify.db
        .delete(quizQuestions)
        .where(
          and(
            eq(quizQuestions.id, questionId),
            eq(quizQuestions.exerciseId, exerciseId),
          ),
        )
        .returning({ id: quizQuestions.id });

      if (deleted.length === 0) {
        return reply.status(404).send({ error: "Question introuvable" });
      }

      return reply.status(204).send();
    },
  );

  // PATCH /exercises/:exerciseId/questions/:questionId — update question
  fastify.patch(
    "/exercises/:exerciseId/questions/:questionId",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { exerciseId, questionId } = request.params as {
        exerciseId: string;
        questionId: string;
      };
      const { role } = request.jwtPayload;
      if (role !== "instructor" && role !== "admin") {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      const bodySchema = z.object({
        questionText: z.string().min(1).max(1000).optional(),
        options: z
          .array(z.object({ id: z.string(), text: z.string().min(1) }))
          .min(2)
          .max(6)
          .optional(),
        correctOptionId: z.string().min(1).optional(),
        explanation: z.string().max(2000).nullable().optional(),
      });

      const parse = bodySchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }

      const updated = await fastify.db
        .update(quizQuestions)
        .set({
          ...(parse.data.questionText !== undefined
            ? { questionText: parse.data.questionText }
            : {}),
          ...(parse.data.options !== undefined
            ? { options: JSON.stringify(parse.data.options) }
            : {}),
          ...(parse.data.correctOptionId !== undefined
            ? { correctOptionId: parse.data.correctOptionId }
            : {}),
          ...(parse.data.explanation !== undefined
            ? { explanation: parse.data.explanation }
            : {}),
        })
        .where(
          and(
            eq(quizQuestions.id, questionId),
            eq(quizQuestions.exerciseId, exerciseId),
          ),
        )
        .returning();

      const [q] = updated;
      if (q === undefined) {
        return reply.status(404).send({ error: "Question introuvable" });
      }

      return reply.send({
        question: {
          id: q.id,
          position: q.position,
          questionText: q.questionText,
          options: JSON.parse(q.options) as { id: string; text: string }[],
          correctOptionId: q.correctOptionId,
          explanation: q.explanation,
        },
      });
    },
  );
}
