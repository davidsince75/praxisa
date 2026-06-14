-- Migration 0030: commerce — course pricing, orders, instalment payments,
-- invoices, and paid-access entitlement. This is the purchase -> entitlement
-- backbone so a course can actually be sold (GoCardless; pay-in-full or
-- instalments). All statements are idempotent (journal drift repair — migrate.ts).

-- Enums (idempotent via duplicate_object guard) --------------------------------
DO $$ BEGIN
  CREATE TYPE "order_plan" AS ENUM ('full', 'x3', 'x10', 'comp');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "order_status" AS ENUM ('pending', 'authorised', 'active', 'paid', 'failed', 'cancelled', 'refunded');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "order_payment_status" AS ENUM ('pending', 'confirmed', 'failed', 'charged_back', 'refunded');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Course pricing ---------------------------------------------------------------
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "price_cents" INTEGER;
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'EUR';

-- Orders -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "orders" (
  "id"                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "student_id"                UUID NOT NULL REFERENCES "users"("id"),
  "course_id"                 UUID NOT NULL REFERENCES "courses"("id"),
  "amount_cents"              INTEGER NOT NULL,
  "currency"                  TEXT NOT NULL DEFAULT 'EUR',
  "plan"                      "order_plan" NOT NULL,
  "status"                    "order_status" NOT NULL DEFAULT 'pending',
  "provider"                  TEXT NOT NULL DEFAULT 'gocardless',
  "gc_billing_request_id"     TEXT,
  "gc_mandate_id"             TEXT,
  "gc_instalment_schedule_id" TEXT,
  "gc_payment_id"             TEXT,
  "created_at"                TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"                TIMESTAMPTZ NOT NULL DEFAULT now(),
  "paid_at"                   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_orders_student_id" ON "orders"("student_id");
CREATE INDEX IF NOT EXISTS "idx_orders_course_id" ON "orders"("course_id");
CREATE INDEX IF NOT EXISTS "idx_orders_status" ON "orders"("status");

-- Order payments (one row per charge / instalment) -----------------------------
CREATE TABLE IF NOT EXISTS "order_payments" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "order_id"      UUID NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "gc_payment_id" TEXT UNIQUE,
  "sequence"      INTEGER NOT NULL DEFAULT 1,
  "amount_cents"  INTEGER NOT NULL,
  "currency"      TEXT NOT NULL DEFAULT 'EUR',
  "status"        "order_payment_status" NOT NULL DEFAULT 'pending',
  "charge_date"   TIMESTAMPTZ,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_order_payments_order_id" ON "order_payments"("order_id");

-- Invoices (sequential, immutable numbering) -----------------------------------
CREATE TABLE IF NOT EXISTS "invoices" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "order_id"    UUID NOT NULL REFERENCES "orders"("id"),
  "number"      TEXT NOT NULL UNIQUE,
  "issued_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "total_cents" INTEGER NOT NULL,
  "vat_cents"   INTEGER NOT NULL DEFAULT 0,
  "vat_note"    TEXT,
  "pdf_file_id" UUID REFERENCES "uploaded_files"("id") ON DELETE SET NULL,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_invoices_order_id" ON "invoices"("order_id");

-- Single-row counter for gap-free invoice numbering (row-locked on UPDATE) ------
CREATE TABLE IF NOT EXISTS "invoice_counter" (
  "id"         INTEGER PRIMARY KEY DEFAULT 1,
  "next_value" INTEGER NOT NULL DEFAULT 1
);
INSERT INTO "invoice_counter" ("id", "next_value") VALUES (1, 1)
  ON CONFLICT ("id") DO NOTHING;

-- Webhook idempotency ledger ---------------------------------------------------
CREATE TABLE IF NOT EXISTS "processed_webhook_events" (
  "event_id"    TEXT PRIMARY KEY,
  "received_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Paid-access entitlement on enrolments ----------------------------------------
ALTER TABLE "enrolments" ADD COLUMN IF NOT EXISTS "paid_order_id" UUID;
DO $$ BEGIN
  ALTER TABLE "enrolments"
    ADD CONSTRAINT "enrolments_paid_order_id_fkey"
    FOREIGN KEY ("paid_order_id") REFERENCES "orders"("id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
