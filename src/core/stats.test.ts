import { describe, expect, it } from "vitest";
import {
  countActiveCompanies,
  distinctInOrder,
  summariseLedger,
  summarisePayments,
} from "./stats";

describe("summarisePayments", () => {
  it("keeps placeholder and real payments apart and counts only paid ones as money", () => {
    const summary = summarisePayments([
      { provider: "placeholder", status: "paid", amount_czk: 1290 },
      { provider: "placeholder", status: "paid", amount_czk: 190 },
      { provider: "stripe", status: "paid", amount_czk: 490 },
      { provider: "stripe", status: "failed", amount_czk: 2990 },
      { provider: "stripe", status: "refunded", amount_czk: 790 },
    ]);
    expect(summary.placeholder).toEqual({ count: 2, totalCzk: 1480 });
    expect(summary.real).toEqual({ count: 1, totalCzk: 490 });
    expect(summary.notPaid).toBe(2);
  });
  it("is zero for no payments", () => {
    expect(summarisePayments([]).real).toEqual({ count: 0, totalCzk: 0 });
  });
});

describe("summariseLedger", () => {
  it("splits granted, bought, spent and adjusted", () => {
    expect(
      summariseLedger([
        { reason: "trial_grant", delta: 300 },
        { reason: "plan_grant", delta: 5000 },
        { reason: "purchase", delta: 1000 },
        { reason: "spend", delta: -50 },
        { reason: "spend", delta: -100 },
        { reason: "adjustment", delta: 50 },
      ]),
    ).toEqual({ granted: 5300, bought: 1000, spent: 150, adjusted: 50 });
  });
});

describe("countActiveCompanies", () => {
  const now = new Date("2026-11-19T12:00:00Z");
  it("counts each company once per window and ignores events without one", () => {
    expect(
      countActiveCompanies(
        [
          { organization_id: "a", created_at: "2026-11-19T10:00:00Z" },
          { organization_id: "a", created_at: "2026-11-18T10:00:00Z" },
          { organization_id: "b", created_at: "2026-11-01T10:00:00Z" },
          { organization_id: "c", created_at: "2026-09-01T10:00:00Z" },
          { organization_id: null, created_at: "2026-11-19T10:00:00Z" },
        ],
        now,
      ),
    ).toEqual({ last7: 1, last30: 2 });
  });
});

describe("distinctInOrder", () => {
  it("keeps first appearances, skips nulls and stops at the limit", () => {
    expect(distinctInOrder(["a", null, "b", "a", "c", "d"], 3)).toEqual(["a", "b", "c"]);
    expect(distinctInOrder([], 3)).toEqual([]);
  });
});
