import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { uploadedFiles } from "../../db/schema/index.js";
import { eq } from "drizzle-orm";
import { z } from "zod";

const uploadBodySchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  data: z.string().min(1),
});

export function filesPlugin(
  fastify: FastifyInstance,
  _opts: unknown,
  done: (err?: Error) => void,
): void {
  // POST /files — upload (instructor or admin only)
  fastify.post(
    "/files",
    {
      preHandler: [fastify.authenticate],
      bodyLimit: 35 * 1024 * 1024,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { role, sub } = request.jwtPayload;
      if (role !== "instructor" && role !== "admin") {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      const parse = uploadBodySchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }

      const { filename, mimeType, data } = parse.data;
      const buffer = Buffer.from(data, "base64");
      if (buffer.length > 30 * 1024 * 1024) {
        return reply
          .status(400)
          .send({ error: "Fichier trop volumineux (max 30 Mo)" });
      }

      const [file] = await fastify.db
        .insert(uploadedFiles)
        .values({
          filename,
          mimeType,
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
    },
  );

  // GET /files/:id — serve binary (public)
  fastify.get(
    "/files/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const rows = await fastify.db
        .select()
        .from(uploadedFiles)
        .where(eq(uploadedFiles.id, id))
        .limit(1);

      const file = rows[0];
      if (file === undefined) {
        return reply.status(404).send({ error: "Fichier introuvable" });
      }

      return reply
        .header("Content-Type", file.mimeType)
        .header("Content-Disposition", `inline; filename="${file.filename}"`)
        .header("Cache-Control", "public, max-age=86400")
        .send(file.data);
    },
  );

  done();
}
