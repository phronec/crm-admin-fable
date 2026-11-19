import { describe, expect, it } from "vitest";
import { isMissingTable, redactSecrets } from "./errors";

describe("isMissingTable", () => {
  it("recognises the PostgREST and Postgres codes", () => {
    expect(isMissingTable({ code: "PGRST205" })).toBe(true);
    expect(isMissingTable({ code: "42P01" })).toBe(true);
  });
  it("does not mistake other errors for a missing table", () => {
    expect(isMissingTable({ code: "42501" })).toBe(false);
    expect(isMissingTable({ code: "PGRST116" })).toBe(false);
    expect(isMissingTable({ code: null })).toBe(false);
    expect(isMissingTable(null)).toBe(false);
    expect(isMissingTable(undefined)).toBe(false);
  });
});

describe("redactSecrets", () => {
  it("removes every occurrence of each secret", () => {
    expect(redactSecrets("key sb_secret_x and sb_secret_x again", ["sb_secret_x"])).toBe(
      "key [redacted] and [redacted] again",
    );
  });
  it("ignores empty secrets", () => {
    expect(redactSecrets("plain", [undefined, ""])).toBe("plain");
  });
});
