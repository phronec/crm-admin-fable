import { describe, expect, it } from "vitest";
import {
  cleanSearch,
  eventNameOrUndefined,
  firstValue,
  href,
  isUuid,
  pickOne,
  providerOrUndefined,
  PAYMENT_STATUSES,
} from "./query";

describe("pickOne", () => {
  it("accepts only listed values", () => {
    expect(pickOne("paid", PAYMENT_STATUSES)).toBe("paid");
    expect(pickOne(["failed"], PAYMENT_STATUSES)).toBe("failed");
    expect(pickOne("paid; drop table", PAYMENT_STATUSES)).toBeUndefined();
    expect(pickOne(undefined, PAYMENT_STATUSES)).toBeUndefined();
  });
});

describe("firstValue", () => {
  it("treats empty as missing", () => {
    expect(firstValue("")).toBeUndefined();
    expect(firstValue(["a", "b"])).toBe("a");
  });
});

describe("isUuid", () => {
  it("checks the shape", () => {
    expect(isUuid("6f1c2a52-8b3e-4c55-9f0e-0d1f0f6d2a11")).toBe(true);
    expect(isUuid("6f1c2a52")).toBe(false);
    expect(isUuid("6f1c2a52-8b3e-4c55-9f0e-0d1f0f6d2a11,x")).toBe(false);
  });
});

describe("eventNameOrUndefined and providerOrUndefined", () => {
  it("matches the database rule for event names", () => {
    expect(eventNameOrUndefined("deal.created")).toBe("deal.created");
    expect(eventNameOrUndefined("deal")).toBeUndefined();
    expect(eventNameOrUndefined("Deal.Created")).toBeUndefined();
    expect(eventNameOrUndefined("a.b,c.d")).toBeUndefined();
  });
  it("accepts simple provider names", () => {
    expect(providerOrUndefined("Placeholder")).toBe("placeholder");
    expect(providerOrUndefined("a b")).toBeUndefined();
  });
});

describe("cleanSearch", () => {
  it("removes filter syntax and wildcards", () => {
    expect(cleanSearch("signo),id.eq.1")).toBe("signo id.eq.1");
    expect(cleanSearch("100%_sure*")).toBe("100 sure");
    expect(cleanSearch('a"b\\c')).toBe("a b c");
  });
  it("is undefined when nothing is left", () => {
    expect(cleanSearch("  ,() ")).toBeUndefined();
    expect(cleanSearch(undefined)).toBeUndefined();
  });
  it("is limited in length", () => {
    expect(cleanSearch("x".repeat(200))).toHaveLength(60);
  });
});

describe("href", () => {
  it("leaves out empty parameters", () => {
    expect(href("/payments", { status: "paid", kind: undefined, page: "" })).toBe(
      "/payments?status=paid",
    );
    expect(href("/payments", {})).toBe("/payments");
  });
  it("encodes values", () => {
    expect(href("/tenants", { q: "a b&c" })).toBe("/tenants?q=a+b%26c");
  });
});
