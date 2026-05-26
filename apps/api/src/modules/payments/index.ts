import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { GoCardlessClient, Environments } from "gocardless-nodejs";

// ── Plugin ──────────────────────────────────────────────────────────────────────

export function paymentsPlugin(fastify: FastifyInstance) {
  const gcConfig = (
    fastify as unknown as {
      config?: {
        gocardless?: { accessToken: string; environment: "sandbox" | "live" };
      };
    }
  ).config?.gocardless;

  function getClient() {
    if (!gcConfig) return null;
    return new GoCardlessClient(
      gcConfig.accessToken,
      gcConfig.environment === "live"
        ? Environments.Live
        : Environments.Sandbox,
    );
  }

  // ── GET /payments/status ──────────────────────────────────────────────────
  fastify.get(
    "/payments/status",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { role } = request.jwtPayload;
      if (role !== "admin") {
        return reply.status(403).send({ error: "Forbidden" });
      }
      return reply.send({ connected: gcConfig !== undefined });
    },
  );

  // ── GET /payments ─────────────────────────────────────────────────────────
  fastify.get(
    "/payments",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { role } = request.jwtPayload;
      if (role !== "admin") {
        return reply.status(403).send({ error: "Forbidden" });
      }
      const client = getClient();
      if (!client) {
        return reply.status(501).send({ error: "GoCardless non configuré" });
      }
      const { cursor, status } = request.query as {
        cursor?: string;
        status?: string;
      };

      const params: Record<string, unknown> = { limit: "50" };
      if (cursor) {
        params["after"] = cursor;
      }
      if (status) {
        params["status"] = status;
      }

      const res = await client.payments.list(
        params as Parameters<typeof client.payments.list>[0],
      );

      /* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
      const raw = res.payments as unknown as Record<string, unknown>[];
      const payments = (raw ?? []).map((p) => ({
        id: p["id"] as string,
        amount: p["amount"] as number,
        currency: p["currency"] as string,
        status: p["status"] as string,
        description: p["description"] as string | null,
        reference: p["reference"] as string | null,
        createdAt: p["created_at"] as string,
        chargeDate: p["charge_date"] as string | null,
        metadata: (p["metadata"] ?? {}) as Record<string, string>,
      }));
      /* eslint-enable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */

      return reply.send({
        payments,
        nextCursor: res.meta.cursors.after ?? null,
      });
    },
  );

  // ── GET /payments/:id ─────────────────────────────────────────────────────
  fastify.get(
    "/payments/:id",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { role } = request.jwtPayload;
      if (role !== "admin") {
        return reply.status(403).send({ error: "Forbidden" });
      }
      const { id } = request.params as { id: string };
      const client = getClient();
      if (!client) {
        return reply.status(501).send({ error: "GoCardless non configuré" });
      }
      const p = await client.payments.find(id);
      return reply.send({
        id: p.id,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        description: p.description,
        reference: p.reference,
        createdAt: p.created_at,
        chargeDate: p.charge_date,
        metadata: p.metadata,
      });
    },
  );

  // ── POST /payments/links ──────────────────────────────────────────────────
  const linkSchema = z.object({
    description: z.string().min(1).max(500),
    amount: z.number().int().min(100),
    currency: z.string().length(3).default("EUR"),
    studentName: z.string().optional(),
    studentEmail: z.string().email().optional(),
  });

  fastify.post(
    "/payments/links",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { role } = request.jwtPayload;
      if (role !== "admin") {
        return reply.status(403).send({ error: "Forbidden" });
      }
      const parse = linkSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }
      const client = getClient();
      if (!client) {
        return reply.status(501).send({ error: "GoCardless non configuré" });
      }

      const { description, amount, currency, studentName, studentEmail } =
        parse.data;

      // Create a billing request flow (hosted payment page)
      const billingRequest = await client.billingRequests.create({
        payment_request: {
          description,
          amount: String(amount),
          currency,
          metadata: {
            student_name: studentName ?? "",
            student_email: studentEmail ?? "",
          },
        },
      });

      const baseUrl =
        (
          fastify as unknown as {
            config?: { appBaseUrl?: string };
          }
        ).config?.appBaseUrl ?? "";

      const flow = await client.billingRequestFlows.create({
        redirect_uri: `${baseUrl}/payments?success=true`,
        exit_uri: `${baseUrl}/payments`,
        links: { billing_request: billingRequest.id },
      });

      return reply.status(201).send({
        id: billingRequest.id,
        paymentUrl: flow.authorisation_url,
      });
    },
  );
}
