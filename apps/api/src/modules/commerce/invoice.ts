import { eq, sql } from "drizzle-orm";
import type { Db } from "../../db/index.js";
import { invoiceCounter, invoices } from "../../db/schema/index.js";

// Issuer legal details shown on the invoice. TODO: replace the placeholders with
// the real legal entity, and ideally move these to the admin-editable settings.
export const INVOICE_ISSUER = {
  name: "Psychostudy",
  legalName: "Psychostudy",
  address: "—",
  siret: "—",
  vatNote: "TVA non applicable, art. 261-4-4° a du CGI",
} as const;

/** Format a sequential invoice number, e.g. (2026, 12) → "PSY-2026-000012". */
export function formatInvoiceNumber(year: number, seq: number): string {
  return `PSY-${String(year)}-${String(seq).padStart(6, "0")}`;
}

/**
 * Issue an invoice for an order — idempotent (returns the existing one if any).
 * The number is allocated from the single-row, row-locked invoice_counter so
 * numbering stays sequential and gap-free (a legal requirement).
 */
export async function issueInvoice(
  db: Db,
  args: { orderId: string; totalCents: number },
): Promise<{ id: string; number: string }> {
  const existing = await db
    .select({ id: invoices.id, number: invoices.number })
    .from(invoices)
    .where(eq(invoices.orderId, args.orderId))
    .limit(1);
  if (existing[0] !== undefined) return existing[0];

  // Atomically claim the next number. RETURNING gives the post-increment value,
  // so the allocated sequence is (returned - 1).
  const counter = await db
    .update(invoiceCounter)
    .set({ nextValue: sql`${invoiceCounter.nextValue} + 1` })
    .where(eq(invoiceCounter.id, 1))
    .returning({ value: invoiceCounter.nextValue });
  const seq = (counter[0]?.value ?? 1) - 1;
  const number = formatInvoiceNumber(new Date().getFullYear(), seq);

  const inserted = await db
    .insert(invoices)
    .values({
      orderId: args.orderId,
      number,
      totalCents: args.totalCents,
      vatCents: 0,
      vatNote: INVOICE_ISSUER.vatNote,
    })
    .returning({ id: invoices.id, number: invoices.number });
  const inv = inserted[0];
  if (inv === undefined) throw new Error("Invoice insert returned no rows");
  return inv;
}
