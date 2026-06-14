import type { FastifyInstance } from "fastify";
import { and, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { emitEvent } from "@praxisa/audit-sdk";
import {
  courses,
  enrolments,
  orderPayments,
  orders,
  users,
} from "../../db/schema/index.js";
import { compOrderSchema, createOrderSchema } from "./types.js";
import { pricingOptions } from "./service.js";
import { grantPaidAccess, revokePaidAccess } from "./entitlement.js";
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

  // ── GET /orders (admin) — enriched with student, course, instalment progress ─
  fastify.get(
    "/orders",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { role } = request.jwtPayload;
      if (role !== "admin") {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      const rows = await fastify.db
        .select({
          id: orders.id,
          studentId: orders.studentId,
          courseId: orders.courseId,
          amountCents: orders.amountCents,
          currency: orders.currency,
          plan: orders.plan,
          status: orders.status,
          createdAt: orders.createdAt,
          paidAt: orders.paidAt,
          studentFirstName: users.firstName,
          studentLastName: users.lastName,
          studentEmail: users.email,
          courseTitle: courses.title,
        })
        .from(orders)
        .leftJoin(users, eq(users.id, orders.studentId))
        .leftJoin(courses, eq(courses.id, orders.courseId))
        .orderBy(desc(orders.createdAt));

      const ids = rows.map((r) => r.id);
      const progress = new Map<string, { confirmed: number; total: number }>();
      if (ids.length > 0) {
        const payRows = await fastify.db
          .select({
            orderId: orderPayments.orderId,
            confirmed: sql<number>`count(*) filter (where ${orderPayments.status} = 'confirmed')::int`,
            total: sql<number>`count(*)::int`,
          })
          .from(orderPayments)
          .where(inArray(orderPayments.orderId, ids))
          .groupBy(orderPayments.orderId);
        for (const p of payRows) {
          progress.set(p.orderId, { confirmed: p.confirmed, total: p.total });
        }
      }

      const enriched = rows.map((r) => ({
        ...r,
        paymentsConfirmed: progress.get(r.id)?.confirmed ?? 0,
        paymentsTotal: progress.get(r.id)?.total ?? 0,
      }));

      return reply.send({ orders: enriched });
    },
  );

  // ── POST /orders/comp (admin) — grant full access with no charge ─────────────
  fastify.post(
    "/orders/comp",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { role, sub } = request.jwtPayload;
      if (role !== "admin") {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      const parse = compOrderSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }
      const { studentId, courseId } = parse.data;

      const courseRows = await fastify.db
        .select({ id: courses.id, currency: courses.currency })
        .from(courses)
        .where(and(eq(courses.id, courseId), isNull(courses.deletedAt)))
        .limit(1);
      const course = courseRows[0];
      if (course === undefined) {
        return reply.status(404).send({ error: "Formation introuvable" });
      }

      const studentRows = await fastify.db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, studentId), eq(users.role, "student")))
        .limit(1);
      if (studentRows[0] === undefined) {
        return reply.status(404).send({ error: "Apprenant introuvable" });
      }

      const inserted = await fastify.db
        .insert(orders)
        .values({
          studentId,
          courseId,
          amountCents: 0,
          currency: course.currency,
          plan: "comp",
          status: "paid",
          paidAt: new Date(),
        })
        .returning({ id: orders.id });
      const order = inserted[0];
      if (order === undefined) {
        throw new Error("Comp order insert returned no rows");
      }

      await grantPaidAccess(fastify.db, {
        studentId,
        courseId,
        orderId: order.id,
      });

      await emitEvent({
        actorUserId: sub,
        eventType: "commerce.order.comp_granted",
        entityType: "order",
        entityId: order.id,
        dataClassification: "pii:pseudonymous",
        requestId: request.id,
        sourceIp: request.ip,
      });

      return reply.status(201).send({ orderId: order.id });
    },
  );

  // ── POST /orders/:orderId/refund (admin) ─────────────────────────────────────
  // Cancels any remaining instalments and revokes access. Money already
  // collected is returned out-of-band (bank), not via the API.
  fastify.post(
    "/orders/:orderId/refund",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { role, sub } = request.jwtPayload;
      if (role !== "admin") {
        return reply.status(403).send({ error: "Accès interdit" });
      }
      const { orderId } = request.params as { orderId: string };

      const orderRows = await fastify.db
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);
      const order = orderRows[0];
      if (order === undefined) {
        return reply.status(404).send({ error: "Commande introuvable" });
      }
      if (order.status === "refunded" || order.status === "cancelled") {
        return reply
          .status(409)
          .send({ error: "Cette commande est déjà clôturée." });
      }

      if (client !== null && order.gcInstalmentScheduleId !== null) {
        try {
          await client.instalmentSchedules.cancel(order.gcInstalmentScheduleId);
        } catch (err: unknown) {
          request.log.error(
            { err, orderId },
            "Failed to cancel GoCardless instalment schedule on refund",
          );
        }
      }

      await fastify.db
        .update(orders)
        .set({ status: "refunded", updatedAt: new Date() })
        .where(eq(orders.id, orderId));
      await revokePaidAccess(fastify.db, orderId);

      await emitEvent({
        actorUserId: sub,
        eventType: "commerce.order.refunded",
        entityType: "order",
        entityId: orderId,
        dataClassification: "pii:pseudonymous",
        requestId: request.id,
        sourceIp: request.ip,
      });

      return reply.send({ ok: true });
    },
  );

  done();
}
