import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import {
  courseDocuments,
  documentIngests,
  uploadedFiles,
} from "../../db/schema/index.js";
import { canManageCourse, findActiveCourse } from "./service.js";

const linkDocumentSchema = z.object({
  fileId: z.string().uuid(),
  title: z.string().min(1).max(200).trim().optional(),
});

const courseParamsSchema = z.object({ courseId: z.string().uuid() });
const documentParamsSchema = z.object({
  courseId: z.string().uuid(),
  documentId: z.string().uuid(),
});

/**
 * Course reference documents — multiple PDFs per course feeding the AI
 * features. Linking/unlinking only touches course_documents; the underlying
 * uploaded_files row (and its ingest data) is left untouched on unlink.
 */
export function documentsRoutes(fastify: FastifyInstance): void {
  // GET /courses/:courseId/documents — list with ingest status per document
  fastify.get(
    "/courses/:courseId/documents",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { role, sub } = request.jwtPayload;
      const params = courseParamsSchema.safeParse(request.params);
      if (!params.success) {
        return reply.status(400).send({ error: "Identifiant invalide" });
      }
      const { courseId } = params.data;

      const course = await findActiveCourse(fastify.db, courseId);
      if (course === undefined) {
        return reply.status(404).send({ error: "Cours introuvable" });
      }
      if (!canManageCourse(course, sub, role)) {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      const rows = await fastify.db
        .select({
          id: courseDocuments.id,
          fileId: courseDocuments.fileId,
          title: courseDocuments.title,
          createdAt: courseDocuments.createdAt,
          filename: uploadedFiles.filename,
          size: uploadedFiles.size,
          ingestStatus: documentIngests.status,
          ingestStage: documentIngests.stage,
          ingestError: documentIngests.error,
          pageCount: documentIngests.pageCount,
          chunkCount: documentIngests.chunkCount,
        })
        .from(courseDocuments)
        .innerJoin(uploadedFiles, eq(uploadedFiles.id, courseDocuments.fileId))
        .leftJoin(
          documentIngests,
          eq(documentIngests.fileId, courseDocuments.fileId),
        )
        .where(eq(courseDocuments.courseId, courseId))
        .orderBy(desc(courseDocuments.createdAt));

      return reply.send({
        documents: rows.map((r) => ({
          id: r.id,
          fileId: r.fileId,
          title: r.title,
          filename: r.filename,
          size: r.size,
          createdAt: r.createdAt,
          ingest: {
            status: r.ingestStatus ?? "none",
            stage: r.ingestStage,
            error: r.ingestError,
            pageCount: r.pageCount,
            chunkCount: r.chunkCount,
          },
        })),
      });
    },
  );

  // POST /courses/:courseId/documents — link an uploaded file to the course
  fastify.post(
    "/courses/:courseId/documents",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { role, sub } = request.jwtPayload;
      const params = courseParamsSchema.safeParse(request.params);
      if (!params.success) {
        return reply.status(400).send({ error: "Identifiant invalide" });
      }
      const parse = linkDocumentSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }
      const { courseId } = params.data;
      const { fileId, title } = parse.data;

      const course = await findActiveCourse(fastify.db, courseId);
      if (course === undefined) {
        return reply.status(404).send({ error: "Cours introuvable" });
      }
      if (!canManageCourse(course, sub, role)) {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      const fileRows = await fastify.db
        .select({ id: uploadedFiles.id, filename: uploadedFiles.filename })
        .from(uploadedFiles)
        .where(eq(uploadedFiles.id, fileId))
        .limit(1);
      const file = fileRows[0];
      if (file === undefined) {
        return reply.status(404).send({ error: "Fichier introuvable" });
      }

      const existing = await fastify.db
        .select({ id: courseDocuments.id })
        .from(courseDocuments)
        .where(
          and(
            eq(courseDocuments.courseId, courseId),
            eq(courseDocuments.fileId, fileId),
          ),
        )
        .limit(1);
      if (existing.length > 0) {
        return reply
          .status(409)
          .send({ error: "Ce document est déjà associé au cours" });
      }

      const [document] = await fastify.db
        .insert(courseDocuments)
        .values({ courseId, fileId, title: title ?? file.filename })
        .returning();

      return reply.status(201).send({ document });
    },
  );

  // DELETE /courses/:courseId/documents/:documentId — unlink (keeps the file)
  fastify.delete(
    "/courses/:courseId/documents/:documentId",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { role, sub } = request.jwtPayload;
      const params = documentParamsSchema.safeParse(request.params);
      if (!params.success) {
        return reply.status(400).send({ error: "Identifiant invalide" });
      }
      const { courseId, documentId } = params.data;

      const course = await findActiveCourse(fastify.db, courseId);
      if (course === undefined) {
        return reply.status(404).send({ error: "Cours introuvable" });
      }
      if (!canManageCourse(course, sub, role)) {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      const deleted = await fastify.db
        .delete(courseDocuments)
        .where(
          and(
            eq(courseDocuments.id, documentId),
            eq(courseDocuments.courseId, courseId),
          ),
        )
        .returning({ id: courseDocuments.id });

      if (deleted.length === 0) {
        return reply.status(404).send({ error: "Document introuvable" });
      }
      return reply.status(204).send();
    },
  );
}
