import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { parse as parseGoCardlessWebhook } from "gocardless-nodejs";
import type { Event, EventLinks, GoCardlessClient } from "gocardless-nodejs";
import { emitEvent } from "@praxisa/audit-sdk";
import type { Db } from "../../db/index.js";
import type { OrderPaymentStatus } from "../../db/schema/index.js";
import {
  courses,
  orderPayments,
  orders,
  processedWebhookEvents,
  users,
} from "../../db/schema/index.js";
import { grantPaidAccess, revokePaidAccess } from "./entitlement.js";
import {
  buildInstalmentPlan,
  instalmentScheduleRequest,
  isOrderFullyPaid,
  planInstalmentCount,
  shouldRevokeAccess,
} from "./service.js";
import { issueInvoice } from "./invoice.js";
import type { CommsService } from "../comms/index.js";

interface HandlerCtx {
  db: Db;
  client: GoCardlessClient;
  comms: CommsService;
  log: FastifyBaseLogger;
  requestId: string;
  sourceIp: string;
}

const PLAN_EMAIL_LABEL: Record<string, string> = {
  full: "paiement comptant",
  x3: "3 mensualités",
  x10: "10 mensualités",
  comp: "accès offert",
};

function formatAmount(cents: number, currency: string): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/** Load the buyer's email/name and the course title for transactional emails. */
async function loadOrderContact(
  db: Db,
  order: { studentId: string; courseId: string },
): Promise<{ email: string; firstName: string; courseTitle: string } | null> {
  const studentRows = await db
    .select({ email: users.email, firstName: users.firstName })
    .from(users)
    .where(eq(users.id, order.studentId))
    .limit(1);
  const courseRows = await db
    .select({ title: courses.title })
    .from(courses)
    .where(eq(courses.id, order.courseId))
    .limit(1);
  const student = studentRows[0];
  const course = courseRows[0];
  if (student === undefined || course === undefined) return null;
  return {
    email: student.email,
    firstName: student.firstName,
    courseTitle: course.title,
  };
}

/** Map a GoCardless payment action to our order-payment status (null = ignore). */
function mapPaymentAction(action: string): OrderPaymentStatus | null {
  switch (action) {
    case "confirmed":
    case "paid_out":
      return "confirmed";
    case "failed":
    case "cancelled":
      return "failed";
    case "charged_back":
      return "charged_back";
    default:
      return null; // created / submitted / surcharge_fee_debited / …
  }
}

/** Resolve which order a GoCardless payment belongs to (instalment schedule → mandate). */
async function findOrderForPayment(
  db: Db,
  links: { mandate?: string; instalment_schedule?: string },
) {
  if (links.instalment_schedule !== undefined) {
    const r = await db
      .select()
      .from(orders)
      .where(eq(orders.gcInstalmentScheduleId, links.instalment_schedule))
      .limit(1);
    if (r[0] !== undefined) return r[0];
  }
  if (links.mandate !== undefined) {
    const r = await db
      .select()
      .from(orders)
      .where(eq(orders.gcMandateId, links.mandate))
      .limit(1);
    if (r[0] !== undefined) return r[0];
  }
  return undefined;
}

/** Recompute order status from its payments: settle when all confirmed, revoke on dunning. */
async function reconcileOrder(ctx: HandlerCtx, orderId: string): Promise<void> {
  const orderRows = await ctx.db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  const order = orderRows[0];
  if (order === undefined) return;

  const payments = await ctx.db
    .select({ status: orderPayments.status })
    .from(orderPayments)
    .where(eq(orderPayments.orderId, orderId));

  const expected = planInstalmentCount(order.plan);

  if (isOrderFullyPaid(payments, expected)) {
    await ctx.db
      .update(orders)
      .set({ status: "paid", paidAt: new Date(), updatedAt: new Date() })
      .where(eq(orders.id, orderId));
    await emitEvent({
      actorUserId: order.studentId,
      eventType: "commerce.order.paid",
      entityType: "order",
      entityId: orderId,
      dataClassification: "pii:pseudonymous",
      requestId: ctx.requestId,
      sourceIp: ctx.sourceIp,
    });
  } else if (shouldRevokeAccess(payments)) {
    await revokePaidAccess(ctx.db, orderId);
    await ctx.db
      .update(orders)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(orders.id, orderId));
    await emitEvent({
      actorUserId: order.studentId,
      eventType: "commerce.order.access_revoked",
      entityType: "order",
      entityId: orderId,
      dataClassification: "pii:pseudonymous",
      requestId: ctx.requestId,
      sourceIp: ctx.sourceIp,
    });
  }
}

/** Mandate authorised: create the instalment schedule (or record the one-off payment) and grant access. */
async function onBillingRequestFulfilled(
  ctx: HandlerCtx,
  links: EventLinks,
): Promise<void> {
  const brId = links.billing_request;
  if (brId === undefined) return;

  const orderRows = await ctx.db
    .select()
    .from(orders)
    .where(eq(orders.gcBillingRequestId, brId))
    .limit(1);
  const order = orderRows[0];
  if (order === undefined || order.status !== "pending") return; // unknown / already handled

  const br = await ctx.client.billingRequests.find(brId);
  const brLinks = (br.links ?? {}) as {
    mandate_request_mandate?: string;
    payment_request_payment?: string;
  };
  const mandateId = brLinks.mandate_request_mandate;
  if (mandateId === undefined) return;

  if (order.plan === "full") {
    const paymentId = brLinks.payment_request_payment;
    if (paymentId !== undefined) {
      await ctx.db
        .insert(orderPayments)
        .values({
          orderId: order.id,
          gcPaymentId: paymentId,
          sequence: 1,
          amountCents: order.amountCents,
          currency: order.currency,
          status: "pending",
        })
        .onConflictDoNothing();
    }
    await ctx.db
      .update(orders)
      .set({
        status: "authorised",
        gcMandateId: mandateId,
        gcPaymentId: paymentId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id));
  } else {
    const count = planInstalmentCount(order.plan);
    const reqBody = instalmentScheduleRequest({
      orderId: order.id,
      totalCents: order.amountCents,
      instalmentCount: count,
      currency: order.currency,
      mandateId,
      name: `Formation — ${order.plan}`,
    });
    const schedule = await ctx.client.instalmentSchedules.createWithSchedule(
      reqBody as Parameters<
        typeof ctx.client.instalmentSchedules.createWithSchedule
      >[0],
    );
    const paymentIds = schedule.links?.payments ?? [];
    const amounts = buildInstalmentPlan(order.amountCents, count);
    for (let i = 0; i < paymentIds.length; i += 1) {
      await ctx.db
        .insert(orderPayments)
        .values({
          orderId: order.id,
          gcPaymentId: paymentIds[i],
          sequence: i + 1,
          amountCents: amounts[i] ?? 0,
          currency: order.currency,
          status: "pending",
        })
        .onConflictDoNothing();
    }
    await ctx.db
      .update(orders)
      .set({
        status: "active",
        gcMandateId: mandateId,
        gcInstalmentScheduleId: schedule.id ?? null,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id));
  }

  // Optimistic grant — Direct Debit settles in days; dunning revokes on failure.
  await grantPaidAccess(ctx.db, {
    studentId: order.studentId,
    courseId: order.courseId,
    orderId: order.id,
  });
  await emitEvent({
    actorUserId: order.studentId,
    eventType: "commerce.order.authorised",
    entityType: "order",
    entityId: order.id,
    dataClassification: "pii:pseudonymous",
    requestId: ctx.requestId,
    sourceIp: ctx.sourceIp,
  });

  // Issue the numbered invoice and email the buyer their confirmation +
  // invoice link (fire-and-forget — never block webhook processing on email).
  const invoice = await issueInvoice(ctx.db, {
    orderId: order.id,
    totalCents: order.amountCents,
  });
  const contact = await loadOrderContact(ctx.db, order);
  if (contact !== null) {
    ctx.comms
      .sendOrderConfirmation(
        { email: contact.email, firstName: contact.firstName },
        {
          courseTitle: contact.courseTitle,
          planLabel: PLAN_EMAIL_LABEL[order.plan] ?? order.plan,
          amount: formatAmount(order.amountCents, order.currency),
          invoiceNumber: invoice.number,
          invoiceId: invoice.id,
        },
      )
      .catch((err: unknown) => {
        ctx.log.error(
          { err, orderId: order.id },
          "Order confirmation email failed",
        );
      });
  }
}

/** A payment confirmed / failed / charged back — update its row and reconcile the order. */
async function onPaymentEvent(
  ctx: HandlerCtx,
  action: string,
  links: EventLinks,
): Promise<void> {
  const paymentId = links.payment;
  if (paymentId === undefined) return;
  const status = mapPaymentAction(action);
  if (status === null) return;

  const existing = await ctx.db
    .select({ id: orderPayments.id, orderId: orderPayments.orderId })
    .from(orderPayments)
    .where(eq(orderPayments.gcPaymentId, paymentId))
    .limit(1);

  let orderId: string;
  if (existing[0] !== undefined) {
    await ctx.db
      .update(orderPayments)
      .set({ status, updatedAt: new Date() })
      .where(eq(orderPayments.id, existing[0].id));
    orderId = existing[0].orderId;
  } else {
    const payment = await ctx.client.payments.find(paymentId);
    const pl = (payment.links ?? {}) as {
      mandate?: string;
      instalment_schedule?: string;
    };
    const order = await findOrderForPayment(ctx.db, pl);
    if (order === undefined) return;
    await ctx.db
      .insert(orderPayments)
      .values({
        orderId: order.id,
        gcPaymentId: paymentId,
        amountCents: Number(payment.amount ?? 0),
        currency: order.currency,
        status,
      })
      .onConflictDoNothing();
    orderId = order.id;
  }

  await reconcileOrder(ctx, orderId);

  // Notify the buyer of a failed Direct Debit (fire-and-forget).
  if (status === "failed") {
    const ord = await ctx.db
      .select({ studentId: orders.studentId, courseId: orders.courseId })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);
    const o = ord[0];
    if (o !== undefined) {
      const contact = await loadOrderContact(ctx.db, o);
      if (contact !== null) {
        ctx.comms
          .sendDunningNotice(
            { email: contact.email, firstName: contact.firstName },
            { courseTitle: contact.courseTitle },
          )
          .catch((err: unknown) => {
            ctx.log.error({ err, orderId }, "Dunning email failed");
          });
      }
    }
  }
}

async function handleEvent(ctx: HandlerCtx, event: Event): Promise<void> {
  const eventId = event.id;
  if (eventId === undefined) return;

  // Idempotency: skip events already processed; mark only on success so a
  // mid-way failure is safely retried by GoCardless.
  const seen = await ctx.db
    .select({ eventId: processedWebhookEvents.eventId })
    .from(processedWebhookEvents)
    .where(eq(processedWebhookEvents.eventId, eventId))
    .limit(1);
  if (seen[0] !== undefined) return;

  const links = event.links ?? {};
  const action = event.action ?? "";
  if (event.resource_type === "billing_requests" && action === "fulfilled") {
    await onBillingRequestFulfilled(ctx, links);
  } else if (event.resource_type === "payments") {
    await onPaymentEvent(ctx, action, links);
  }

  await ctx.db
    .insert(processedWebhookEvents)
    .values({ eventId })
    .onConflictDoNothing();
}

/**
 * Register `POST /payments/webhooks/gocardless`. Unauthenticated (GoCardless
 * calls it) but signature-verified via the SDK; each event is processed
 * idempotently. This is the step that flips a purchase into access.
 */
export function registerGoCardlessWebhook(
  fastify: FastifyInstance,
  deps: { client: GoCardlessClient | null; webhookSecret: string | undefined },
): void {
  fastify.post(
    "/payments/webhooks/gocardless",
    { config: { rateLimit: { max: 600, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const { client, webhookSecret } = deps;
      if (
        client === null ||
        webhookSecret === undefined ||
        webhookSecret.length === 0
      ) {
        request.log.warn(
          "GoCardless webhook received but the integration is not configured",
        );
        return reply.status(503).send({ error: "Webhook non configuré" });
      }

      const sig = request.headers["webhook-signature"];
      const signatureHeader = Array.isArray(sig) ? sig[0] : sig;
      const rawBody = request.rawBody ?? "";
      if (signatureHeader === undefined || rawBody.length === 0) {
        return reply.status(400).send({ error: "Signature ou corps manquant" });
      }

      let events: Event[];
      try {
        // The SDK types Event with an `any`-typed `metadata` (JsonMap), so this
        // correctly-typed result still trips no-unsafe-assignment.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        events = parseGoCardlessWebhook(
          rawBody,
          webhookSecret,
          signatureHeader,
        );
      } catch {
        request.log.warn("GoCardless webhook signature rejected");
        return reply.status(498).send({ error: "Signature invalide" });
      }

      const ctx: HandlerCtx = {
        db: fastify.db,
        client,
        comms: fastify.comms,
        log: request.log,
        requestId: request.id,
        sourceIp: request.ip,
      };

      let hadError = false;
      for (const event of events) {
        try {
          await handleEvent(ctx, event);
        } catch (err: unknown) {
          hadError = true;
          request.log.error(
            { err, eventId: event.id },
            "Failed to process GoCardless event",
          );
        }
      }

      // On any failure return 5xx so GoCardless retries the batch; per-event
      // idempotency makes reprocessing the successful ones safe.
      return reply.status(hadError ? 500 : 204).send();
    },
  );
}
