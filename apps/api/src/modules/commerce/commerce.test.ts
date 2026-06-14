import { describe, expect, it } from "vitest";
import type { OrderPaymentStatus } from "../../db/schema/index.js";
import {
  buildInstalmentPlan,
  instalmentScheduleRequest,
  isOrderFullyPaid,
  planInstalmentCount,
  pricingOptions,
  shouldRevokeAccess,
} from "./service.js";

describe("buildInstalmentPlan", () => {
  it("pay-in-full is a single charge of the total", () => {
    expect(buildInstalmentPlan(180000, 1)).toEqual([180000]);
  });

  it("splits €1800 into 3 equal instalments of €600", () => {
    expect(buildInstalmentPlan(180000, 3)).toEqual([60000, 60000, 60000]);
  });

  it("splits €1800 into 10 equal instalments of €180", () => {
    expect(buildInstalmentPlan(180000, 10)).toEqual(
      Array<number>(10).fill(18000),
    );
  });

  it("spreads the rounding remainder onto the earliest instalments", () => {
    // 1799¢ / 3 = 599.67 → 600, 600, 599
    expect(buildInstalmentPlan(1799, 3)).toEqual([600, 600, 599]);
  });

  it("always sums exactly to the total", () => {
    for (const n of [1, 2, 3, 7, 10]) {
      for (const total of [180000, 1799, 100, 99999, 1]) {
        const sum = buildInstalmentPlan(total, n).reduce((a, b) => a + b, 0);
        expect(sum).toBe(total);
      }
    }
  });
});

describe("planInstalmentCount", () => {
  it("maps each plan to its instalment count", () => {
    expect(planInstalmentCount("full")).toBe(1);
    expect(planInstalmentCount("x3")).toBe(3);
    expect(planInstalmentCount("x10")).toBe(10);
    expect(planInstalmentCount("comp")).toBe(1);
  });
});

describe("pricingOptions", () => {
  it("offers full / x3 / x10, each summing to the total", () => {
    const opts = pricingOptions(180000);
    expect(opts.map((o) => o.plan)).toEqual(["full", "x3", "x10"]);
    for (const o of opts) {
      expect(o.scheduleCents).toHaveLength(o.instalments);
      expect(o.scheduleCents.reduce((a, b) => a + b, 0)).toBe(180000);
      expect(o.perInstalmentCents).toBe(o.scheduleCents[0]);
    }
  });
});

describe("instalmentScheduleRequest", () => {
  it("builds a monthly GoCardless schedule whose amounts sum to the total", () => {
    const req = instalmentScheduleRequest({
      orderId: "o1",
      totalCents: 180000,
      instalmentCount: 3,
      currency: "EUR",
      mandateId: "MD1",
      name: "Formation",
    });
    expect(req.total_amount).toBe("180000");
    expect(req.instalments.interval_unit).toBe("monthly");
    expect(req.instalments.amounts).toEqual(["60000", "60000", "60000"]);
    expect(req.links.mandate).toBe("MD1");
    expect(req.metadata.order_id).toBe("o1");
    const sum = req.instalments.amounts.reduce((a, b) => a + Number(b), 0);
    expect(sum).toBe(180000);
  });
});

describe("isOrderFullyPaid / shouldRevokeAccess", () => {
  const p = (status: OrderPaymentStatus): { status: OrderPaymentStatus } => ({
    status,
  });

  it("is fully paid only when every expected instalment confirmed", () => {
    expect(
      isOrderFullyPaid([p("confirmed"), p("confirmed"), p("confirmed")], 3),
    ).toBe(true);
    expect(
      isOrderFullyPaid([p("confirmed"), p("pending"), p("pending")], 3),
    ).toBe(false);
  });

  it("is never fully paid with a zero expected count", () => {
    expect(isOrderFullyPaid([], 0)).toBe(false);
  });

  it("revokes on a chargeback", () => {
    expect(shouldRevokeAccess([p("confirmed"), p("charged_back")])).toBe(true);
  });

  it("revokes after two failures with nothing collected", () => {
    expect(shouldRevokeAccess([p("failed"), p("failed")])).toBe(true);
  });

  it("does not revoke on a single failure after a prior success", () => {
    expect(shouldRevokeAccess([p("confirmed"), p("failed")])).toBe(false);
  });
});
