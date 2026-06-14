import type { FastifyInstance } from "fastify";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { emitEvent } from "@praxisa/audit-sdk";
import { courses, enrolments, orders } from "../../db/schema/index.js";
import { createOrderSchema } from "./types.js";
import { pricingOptions } from "./service.js";
import { makeGoCardlessClient, type GoCardlessConfig } from "./gocardless.js";
import { registerGoCardlessWebhook } from "./webhook.routes.js";

interface CommercePluginOptions {
  config?: {
    gocardless?: GoCardlessConfig;
    appBaseUrl?: string;
  };
}

export function commercePlugin(
  fastify: FastifyInstance,
  opts: CommercePluginOptions,
  done: (err?: Error) => void,
): void {
  const gcConfig = opts.config?.gocardless;
  const appBaseUrl = opts.config?.appBaseUrl ?? "";
  const client = makeGoCardlessClient(gcConfig);

  // Webhook: signature-verified, idempotent — flips a purchase into access.
  registerGoCardlessWebhook(fastify, {
    client,
    webhookSecret: gcConfig?.webhookSecret,
  });

  // ── GET /courses/:courseId/pricing ──────────────────────────────────────────
  // Public: price + the purchasable plan breakdown (full / x3 / x10).
  fastify.get("/courses/:courseId/pricing", async (request, reply) => {
    const { courseId } = request.params as { courseId: string };

    const rows = await fastify.db
      .select({
        priceCents: courses.priceCents,
        currency: courses.currency,
        status: courses.status,
        deletedAt: courses.deletedAt,
      })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    const course = rows[0];
    if (
      course === undefined ||
      course.deletedAt !== null ||
      course.priceCents === null
    ) {
      return reply.send({
        forSale: false,
        priceCents: null,
        currency: "EUR",
        plans: [],
      });
    }

    return reply.send({
      forSale: course.status === "published",
      priceCents: course.priceCents,
      currency: course.currency,
      plans: pricingOptions(course.priceCents),
    });
  });

  // ── POST /orders ────────────────────────────────────────────────────────────
  // Student buys a course. Server-authoritative price; creates a pending order
  // and a GoCardless mandate (+ immediate payment for pay-in-full), returning
  // the hosted authorisation URL. The webhook (Phase 3) grants entitlement.
  fastify.post(
    "/orders",
    {
      preHandler: [fastify.authenticate],
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const { role, sub } = request.jwtPayload;
      if (role !== "student") {
        return reply.status(403).send({
          error: "Seuls les apprenants peuvent acheter une formation.",
        });
      }

      const parse = createOrderSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }
      const { courseId, plan } = parse.data;

      if (client === null) {
        return reply.status(501).send({ error: "Paiement non configuré" });
      }

      // Load the course and take the price from the DB — never from the client.
      const courseRows = await fastify.db
        .select({
          id: courses.id,
          title: courses.title,
          priceCents: courses.priceCents,
          currency: courses.currency,
          status: courses.status,
          deletedAt: courses.deletedAt,
        })
        .from(courses)
        .where(eq(courses.id, courseId))
        .limit(1);

      const course = courseRows[0];
      if (
        course === undefined ||
        course.deletedAt !== null ||
        course.status !== "published" ||
        course.priceCents === null
      ) {
        return reply.status(404).send({
          error: "Formation introuvable ou non disponible à la vente",
        });
      }

      // Already paid for this course?
      const owned = await fastify.db
        .select({ id: enrolments.id })
        .from(enrolments)
        .where(
          and(
            eq(enrolments.studentId, sub),
            eq(enrolments.courseId, courseId),
            isNotNull(enrolments.paidOrderId),
          ),
        )
        .limit(1);
      if (owned[0] !== undefined) {
        return reply
          .status(409)
          .send({ error: "Vous avez déjà accès complet à cette formation." });
      }

      const total = course.priceCents;

      const inserted = await fastify.db
        .insert(orders)
        .values({
          studentId: sub,
          courseId,
          amountCents: total,
          currency: course.currency,
          plan,
          status: "pending",
        })
        .returning({ id: orders.id });
      const order = inserted[0];
      if (order === undefined) throw new Error("Order insert returned no rows");

      let authorisationUrl: string;
      try {
        const billingRequest = await client.billingRequests.create({
          mandate_request: { currency: course.currency },
          ...(plan === "full"
            ? {
                payment_request: {
                  description: `Formation : ${course.title}`,
                  amount: String(total),
                  currency: course.currency,
                },
              }
            : {}),
          metadata: {
            order_id: order.id,
            course_id: courseId,
            plan,
          },
        });

        await fastify.db
          .update(orders)
          .set({ gcBillingRequestId: billingRequest.id, updatedAt: new Date() })
          .where(eq(orders.id, order.id));

        const flow = await client.billingRequestFlows.create({
          redirect_uri: `${appBaseUrl}/learn/catalog?purchase=success&order=${order.id}`,
          exit_uri: `${appBaseUrl}/learn/catalog?purchase=cancelled`,
          links: { billing_request: billingRequest.id },
        });
        if (flow.authorisation_url === undefined) {
          throw new Error("GoCardless returned no authorisation URL");
        }
        authorisationUrl = flow.authorisation_url;
      } catch (err: unknown) {
        request.log.error({ err }, "GoCardless billing request failed");
        await fastify.db
          .update(orders)
          .set({ status: "failed", updatedAt: new Date() })
          .where(eq(orders.id, order.id));
        return reply.status(502).send({
          error: "Le service de paiement est momentanément indisponible.",
        });
      }

      await emitEvent({
        actorUserId: sub,
        eventType: "commerce.order.created",
        entityType: "order",
        entityId: order.id,
        dataClassification: "pii:pseudonymous",
        requestId: request.id,
        sourceIp: request.ip,
      });

      return reply.status(201).send({
        orderId: order.id,
        plan,
        amountCents: total,
        currency: course.currency,
        authorisationUrl,
      });
    },
  );

  // ── GET /orders/my ──────────────────────────────────────────────────────────
  fastify.get(
    "/orders/my",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub } = request.jwtPayload;
      const rows = await fastify.db
        .select()
        .from(orders)
        .where(eq(orders.studentId, sub))
        .orderBy(desc(orders.createdAt));
      return reply.send({ orders: rows });
    },
  );

  // ── GET /orders (admin) ─────────────────────────────────────────────────────
  fastify.get(
    "/orders",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { role } = request.jwtPayload;
      if (role !== "admin") {
        return reply.status(403).send({ error: "Accès interdit" });
      }
      const rows = await fastify.db
        .select()
        .from(orders)
        .orderBy(desc(orders.createdAt));
      return reply.send({ orders: rows });
    },
  );

  done();
}
