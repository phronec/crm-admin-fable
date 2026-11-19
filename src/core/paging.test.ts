import { describe, expect, it } from "vitest";
import { pageRange, parsePage, splitAcrossLists, summarisePage, totalPages } from "./paging";

describe("parsePage", () => {
  it("accepts whole numbers from 1", () => {
    expect(parsePage("3")).toBe(3);
    expect(parsePage(["2", "9"])).toBe(2);
  });
  it("falls back to 1 for anything else", () => {
    for (const bad of [undefined, "", "0", "-2", "1.5", "abc", "2e3", "9999999", " 4"]) {
      expect(parsePage(bad)).toBe(1);
    }
  });
});

describe("pageRange", () => {
  it("gives inclusive ranges", () => {
    expect(pageRange(1)).toEqual({ from: 0, to: 49 });
    expect(pageRange(3, 10)).toEqual({ from: 20, to: 29 });
  });
});

describe("totalPages and summarisePage", () => {
  it("has at least one page", () => {
    expect(totalPages(0)).toBe(1);
    expect(totalPages(50)).toBe(1);
    expect(totalPages(51)).toBe(2);
  });
  it("describes the rows shown", () => {
    expect(summarisePage(2, 120)).toEqual({ page: 2, pages: 3, first: 51, last: 100, total: 120 });
    expect(summarisePage(3, 120).last).toBe(120);
  });
  it("is empty for no rows or a page past the end", () => {
    expect(summarisePage(1, 0).first).toBe(0);
    expect(summarisePage(9, 120).last).toBe(0);
  });
});

describe("splitAcrossLists", () => {
  it("stays inside the first list", () => {
    expect(splitAcrossLists(100, 0, 50)).toEqual({ start: 0, end: 50, restOffset: 0, restLimit: 0 });
  });
  it("spans both lists", () => {
    expect(splitAcrossLists(30, 0, 50)).toEqual({ start: 0, end: 30, restOffset: 0, restLimit: 20 });
  });
  it("continues in the second list", () => {
    expect(splitAcrossLists(30, 50, 50)).toEqual({ start: 30, end: 30, restOffset: 20, restLimit: 50 });
  });
  it("handles an empty first list", () => {
    expect(splitAcrossLists(0, 50, 50)).toEqual({ start: 0, end: 0, restOffset: 50, restLimit: 50 });
  });
});
