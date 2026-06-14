import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { courses } from "./learning.js";
import { uploadedFiles } from "./files.js";

// ── Enums ──────────────────────────────────────────────────────────────────────

// How the learner pays. `comp` = admin-granted full access with no charge
// (employer/OPCO-funded, manual bank transfer) — recorded as a zero-amount order
// for a uniform audit trail.
export const ORDER_PLANS = ["full", "x3", "x10", "comp"] as const;
export type OrderPlan = (typeof ORDER_PLANS)[number];
export const orderPlanEnum = pgEnum("order_plan", ORDER_PLANS);

export const ORDER_STATUSES = [
  "pending", // order created, awaiting mandate authorisation
  "authorised", // mandate authorised, pay-in-full payment created
  "active", // instalment schedule running
  "paid", // fully settled
  "failed",
  "cancelled",
  "refunded",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export const orderStatusEnum = pgEnum("order_status", ORDER_STATUSES);

export const ORDER_PAYMENT_STATUSES = [
  "pending",
  "confirmed",
  "failed",
  "charged_back",
  "refunded",
] as const;
export type OrderPaymentStatus = (typeof ORDER_PAYMENT_STATUSES)[number];
export const orderPaymentStatusEnum = pgEnum(
  "order_payment_status",
  ORDER_PAYMENT_STATUSES,
);

// ── Orders ───────────────────────────────────────────────────────────────────

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => users.id),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id),
  // Total order value. Server-authoritative — derived from courses.price_cents,
  // never from the client.
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("EUR"),
  plan: orderPlanEnum("plan").notNull(),
  status: orderStatusEnum("status").notNull().default("pending"),
  provider: text("provider").notNull().default("gocardless"),
  gcBillingRequestId: text("gc_billing_request_id"),
  gcMandateId: text("gc_mandate_id"),
  gcInstalmentScheduleId: text("gc_instalment_schedule_id"),
  gcPaymentId: text("gc_payment_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
});

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;

// ── Order payments ─────────────────────────────────────────────────────────────
// One row per actual charge. Pay-in-full = a single row; instalments = N rows.
// Mirrors GoCardless payment events; drives instalment progress and dunning.

export const orderPayments = pgTable("order_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  gcPaymentId: text("gc_payment_id").unique(),
  sequence: integer("sequence").notNull().default(1),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("EUR"),
  status: orderPaymentStatusEnum("status").notNull().default("pending"),
  chargeDate: timestamp("charge_date", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type OrderPayment = typeof orderPayments.$inferSelect;
export type NewOrderPayment = typeof orderPayments.$inferInsert;

// ── Invoices ───────────────────────────────────────────────────────────────────
// Sequential, immutable numbering (legal requirement) — the number comes from
// the locked invoice_counter row at issue time.

export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id),
  number: text("number").notNull().unique(),
  issuedAt: timestamp("issued_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  totalCents: integer("total_cents").notNull(),
  vatCents: integer("vat_cents").notNull().default(0),
  vatNote: text("vat_note"),
  pdfFileId: uuid("pdf_file_id").references(() => uploadedFiles.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;

// ── Invoice counter ──────────────────────────────────────────────────────────
// Single-row counter. The issuing transaction does
// `UPDATE invoice_counter SET next_value = next_value + 1 RETURNING ...` which
// row-locks for gap-free, concurrency-safe numbering.

export const invoiceCounter = pgTable("invoice_counter", {
  id: integer("id").primaryKey().default(1),
  nextValue: integer("next_value").notNull().default(1),
});

// ── Webhook idempotency ledger ───────────────────────────────────────────────

export const processedWebhookEvents = pgTable("processed_webhook_events", {
  eventId: text("event_id").primaryKey(),
  receivedAt: timestamp("received_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
