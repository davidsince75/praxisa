import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { uploadedFiles } from "../../db/schema/index.js";
import { eq } from "drizzle-orm";
import {
  MAX_PDF_BYTES,
  decodeFilenameHeader,
  hasPdfMagicBytes,
  isUuid,
  sanitizeFilename,
} from "./validation.js";

export function filesPlugin(
  fastify: FastifyInstance,
  _opts: unknown,
  done: (err?: Error) => void,
): void {
  // POST /files — binary upload (instructor or admin only)
  // Content-Type : application/octet-stream
  // Headers      : X-Filename (URL-encoded filename), X-Mime-Type
  // Body limit   : 55 MB  (supports PDFs up to 50 MB)
  fastify.post(
    "/files",
    {
      preHandler: [fastify.authenticate],
      bodyLimit: 55 * 1024 * 1024,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { role, sub } = request.jwtPayload;
      if (role !== "instructor" && role !== "admin") {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      const rawFilename = request.headers["x-filename"];
      const rawMimeType = request.headers["x-mime-type"];

      if (typeof rawFilename !== "string" || typeof rawMimeType !== "string") {
        return reply
          .status(400)
          .send({ error: "En-têtes X-Filename et X-Mime-Type requis" });
      }

      const decoded = decodeFilenameHeader(rawFilename);
      if (decoded === null) {
        return reply
          .status(400)
          .send({ error: "En-tête X-Filename mal encodé" });
      }
      const filename = sanitizeFilename(decoded);

      if (rawMimeType !== "application/pdf") {
        return reply
          .status(400)
          .send({ error: "Seuls les fichiers PDF sont acceptés" });
      }

      const buffer = request.body as Buffer;
      if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        return reply.status(400).send({ error: "Corps de requête vide" });
      }
      if (buffer.length > MAX_PDF_BYTES) {
        return reply
          .status(400)
          .send({ error: "Fichier trop volumineux (max 50 Mo)" });
      }
      // The declared mime type is not trusted — check the actual content
      if (!hasPdfMagicBytes(buffer)) {
        return reply
          .status(400)
          .send({ error: "Le contenu du fichier n'est pas un PDF valide" });
      }

      try {
        const [file] = await fastify.db
          .insert(uploadedFiles)
          .values({
            filename,
            mimeType: "application/pdf",
            size: buffer.length,
            data: buffer,
            uploadedBy: sub,
          })
          .returning({
            id: uploadedFiles.id,
            filename: uploadedFiles.filename,
            mimeType: uploadedFiles.mimeType,
            size: uploadedFiles.size,
          });

        return reply.status(201).send({ file });
      } catch (err: unknown) {
        request.log.error(
          { err, filename, size: buffer.length },
          "File upload insert failed",
        );
        return reply
          .status(500)
          .send({ error: "Erreur lors de l'enregistrement du fichier" });
      }
    },
  );

  // GET /files/:id — serve binary
  // Deliberately unauthenticated: lesson PDFs are embedded as plain <a>/<iframe>
  // URLs that carry no Authorization header. The unguessable UUID acts as a
  // capability token.
  fastify.get(
    "/files/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      if (!isUuid(id)) {
        return reply.status(404).send({ error: "Fichier introuvable" });
      }

      const rows = await fastify.db
        .select()
        .from(uploadedFiles)
        .where(eq(uploadedFiles.id, id))
        .limit(1);

      const file = rows[0];
      if (file === undefined) {
        return reply.status(404).send({ error: "Fichier introuvable" });
      }

      // Re-sanitize at serve time — rows stored before sanitization existed
      // may still contain quotes or control characters.
      const safeName = sanitizeFilename(file.filename);

      return reply
        .header("Content-Type", file.mimeType)
        .header("Content-Disposition", `inline; filename="${safeName}"`)
        .header("Cache-Control", "public, max-age=86400")
        .send(file.data);
    },
  );

  done();
}
