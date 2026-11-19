import { describe, expect, it } from "vitest";
import {
  formatAmount,
  formatCzk,
  formatDate,
  formatDateTime,
  formatDelta,
  formatDetail,
  percentOf,
  truncate,
} from "./format";

describe("money and numbers", () => {
  it("formats crowns the Czech way", () => {
    expect(formatCzk(1290).replace(/\s/g, " ")).toBe("1 290 Kč");
  });
  it("keeps other currencies readable", () => {
    expect(formatAmount(1000, "EUR")).toBe("1,000 EUR");
    expect(formatAmount(490, "CZK").replace(/\s/g, " ")).toBe("490 Kč");
  });
  it("signs token changes", () => {
    expect(formatDelta(300)).toBe("+300");
    expect(formatDelta(-50)).toBe("−50");
    expect(formatDelta(0)).toBe("0");
  });
});

describe("dates", () => {
  it("shows UTC", () => {
    expect(formatDateTime("2026-11-19T14:03:55Z")).toBe("2026-11-19 14:03 UTC");
    expect(formatDate("2026-11-19T23:59:59Z")).toBe("2026-11-19");
  });
  it("shows a dash for nothing or nonsense", () => {
    expect(formatDateTime(null)).toBe("–");
    expect(formatDate("garbage")).toBe("–");
  });
});

describe("text", () => {
  it("truncates with an ellipsis", () => {
    expect(truncate("abcdef", 4)).toBe("abc…");
    expect(truncate("abc", 4)).toBe("abc");
  });
  it("prints event details on one line and hides empty ones", () => {
    expect(formatDetail({ method: "password" })).toBe('{"method":"password"}');
    expect(formatDetail({})).toBe("");
    expect(formatDetail(null)).toBe("");
  });
});

describe("percentOf", () => {
  it("is bounded and safe for zero", () => {
    expect(percentOf(5, 10)).toBe(50);
    expect(percentOf(5, 0)).toBe(0);
    expect(percentOf(-1, 10)).toBe(0);
    expect(percentOf(20, 10)).toBe(100);
  });
});
