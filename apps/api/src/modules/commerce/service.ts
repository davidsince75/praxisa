import type { OrderPlan } from "../../db/schema/index.js";

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
