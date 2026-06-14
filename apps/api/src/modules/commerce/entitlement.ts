import { eq } from "drizzle-orm";
import type { Db } from "../../db/index.js";
import { enrolments } from "../../db/schema/index.js";
import { setProvisionalUntil } from "../learning/service.js";

/**
 * Grant full paid access for a course: upsert the learner's enrolment, stamp it
 * with the paying order, and clear the 14-day trial window so the first-3-modules
 * cap no longer applies. Idempotent — keyed on the (student, course) unique index.
 */
export async function grantPaidAccess(
  db: Db,
  args: { studentId: string; courseId: string; orderId: string },
): Promise<void> {
  const rows = await db
    .insert(enrolments)
    .values({
      studentId: args.studentId,
      courseId: args.courseId,
      status: "active",
      paidOrderId: args.orderId,
    })
    .onConflictDoUpdate({
      target: [enrolments.studentId, enrolments.courseId],
      set: {
        paidOrderId: args.orderId,
        status: "active",
        deletedAt: null,
        updatedAt: new Date(),
      },
    })
    .returning({ id: enrolments.id });

  const enrolmentId = rows[0]?.id;
  if (enrolmentId !== undefined) {
    await setProvisionalUntil(db, enrolmentId, null);
  }
}

/**
 * Pull paid access for an order (failed dunning / chargeback). The enrolment row
 * stays — the learner falls back to trial/restricted access (first 3 modules).
 */
export async function revokePaidAccess(db: Db, orderId: string): Promise<void> {
  await db
    .update(enrolments)
    .set({ paidOrderId: null, updatedAt: new Date() })
    .where(eq(enrolments.paidOrderId, orderId));
}
