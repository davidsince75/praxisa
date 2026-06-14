import { describe, expect, it } from "vitest";
import {
  buildInstalmentPlan,
  planInstalmentCount,
  pricingOptions,
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
