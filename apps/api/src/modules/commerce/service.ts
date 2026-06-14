import type { OrderPaymentStatus, OrderPlan } from "../../db/schema/index.js";

// Plans a learner can buy themselves. `comp` (admin-granted, no charge) is
// intentionally excluded from self-serve checkout.
export const PURCHASABLE_PLANS = ["full", "x3", "x10"] as const;
export type PurchasablePlan = (typeof PURCHASABLE_PLANS)[number];

/** Number of instalments a plan collects. */
export function planInstalmentCount(plan: OrderPlan): number {
  switch (plan) {
    case "x3":
      return 3;
    case "x10":
      return 10;
    case "full":
    case "comp":
      return 1;
  }
}

/**
 * Split a total into `n` instalments (in cents) that sum **exactly** to the
 * total. The rounding remainder is spread one cent at a time across the
 * earliest instalments, so e.g. 1799¢ over 3 → [600, 600, 599]. Pure — unit
 * tested.
 */
export function buildInstalmentPlan(totalCents: number, n: number): number[] {
  if (n <= 1) return [totalCents];
  const base = Math.floor(totalCents / n);
  const remainder = totalCents - base * n; // first `remainder` instalments get +1¢
  return Array.from({ length: n }, (_unused, i) =>
    i < remainder ? base + 1 : base,
  );
}

export interface PlanOption {
  plan: PurchasablePlan;
  instalments: number;
  /** Representative (first) instalment amount, for display. */
  perInstalmentCents: number;
  /** Full per-instalment breakdown summing to the total. */
  scheduleCents: number[];
  totalCents: number;
}

/** Build the purchasable plan options (full / x3 / x10) for a course price. */
export function pricingOptions(totalCents: number): PlanOption[] {
  return PURCHASABLE_PLANS.map((plan) => {
    const instalments = planInstalmentCount(plan);
    const scheduleCents = buildInstalmentPlan(totalCents, instalments);
    return {
      plan,
      instalments,
      perInstalmentCents: scheduleCents[0] ?? totalCents,
      scheduleCents,
      totalCents,
    };
  });
}

// ── Webhook / settlement decision logic (pure) ──────────────────────────────────

/**
 * Build the GoCardless `createWithSchedule` request body for an instalment plan.
 * Monthly instalments whose amounts sum exactly to the total. Pure — the route
 * passes the result straight to the SDK.
 */
export function instalmentScheduleRequest(args: {
  orderId: string;
  totalCents: number;
  instalmentCount: number;
  currency: string;
  mandateId: string;
  name: string;
}) {
  const scheduleCents = buildInstalmentPlan(
    args.totalCents,
    args.instalmentCount,
  );
  return {
    currency: args.currency,
    total_amount: String(args.totalCents),
    name: args.name,
    instalments: {
      amounts: scheduleCents.map((c) => String(c)),
      interval: 1,
      interval_unit: "monthly" as const,
    },
    links: { mandate: args.mandateId },
    metadata: { order_id: args.orderId },
  };
}

interface PaymentLike {
  status: OrderPaymentStatus;
}

export function summarisePayments(payments: PaymentLike[]): {
  confirmed: number;
  failed: number;
  chargedBack: number;
  total: number;
} {
  let confirmed = 0;
  let failed = 0;
  let chargedBack = 0;
  for (const p of payments) {
    if (p.status === "confirmed") confirmed += 1;
    else if (p.status === "failed") failed += 1;
    else if (p.status === "charged_back") chargedBack += 1;
  }
  return { confirmed, failed, chargedBack, total: payments.length };
}

/** An order is settled once every expected instalment has confirmed. */
export function isOrderFullyPaid(
  payments: PaymentLike[],
  expectedCount: number,
): boolean {
  return (
    expectedCount > 0 && summarisePayments(payments).confirmed >= expectedCount
  );
}

/**
 * Whether to pull access. A clawed-back payment, or two failures with nothing
 * yet collected, means we revoke and chase payment (dunning).
 */
export function shouldRevokeAccess(payments: PaymentLike[]): boolean {
  const s = summarisePayments(payments);
  return s.chargedBack > 0 || (s.failed >= 2 && s.confirmed === 0);
}
