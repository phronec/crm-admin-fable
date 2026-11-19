import { describe, expect, it } from "vitest";
import { dayRange, daysBefore, parseDay } from "./dates";

describe("daysBefore", () => {
  it("subtracts whole days", () => {
    expect(daysBefore(new Date("2026-11-19T12:00:00Z"), 7).toISOString()).toBe(
      "2026-11-12T12:00:00.000Z",
    );
  });
});

describe("parseDay", () => {
  it("accepts real days only", () => {
    expect(parseDay("2026-02-28")?.toISOString()).toBe("2026-02-28T00:00:00.000Z");
    expect(parseDay("2026-02-30")).toBeNull();
    expect(parseDay("2026-2-3")).toBeNull();
    expect(parseDay("tomorrow")).toBeNull();
    expect(parseDay(undefined)).toBeNull();
  });
});

describe("dayRange", () => {
  it("includes both days", () => {
    expect(dayRange("2026-11-01", "2026-11-30")).toEqual({
      from: "2026-11-01T00:00:00.000Z",
      before: "2026-12-01T00:00:00.000Z",
      invalid: false,
    });
  });
  it("allows one side only", () => {
    expect(dayRange("2026-11-01", undefined).before).toBeUndefined();
    expect(dayRange(undefined, "2026-11-01").from).toBeUndefined();
    expect(dayRange(undefined, undefined).invalid).toBe(false);
  });
  it("flags bad input and backwards ranges", () => {
    expect(dayRange("nope", undefined).invalid).toBe(true);
    expect(dayRange("2026-11-10", "2026-11-01").invalid).toBe(true);
    expect(dayRange("2026-11-10", "2026-11-01").from).toBeUndefined();
  });
});
