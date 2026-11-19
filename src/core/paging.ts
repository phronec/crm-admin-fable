export const PAGE_SIZE = 50;

// A page number far beyond any real table keeps a typed-in number from
// producing a nonsense range.
const MAX_PAGE = 100_000;

/** The page number from a query parameter: a whole number from 1, default 1. */
export function parsePage(raw: string | string[] | undefined): number {
  const text = Array.isArray(raw) ? raw[0] : raw;
  if (!text || !/^\d{1,6}$/.test(text)) return 1;
  const page = Number(text);
  return page >= 1 && page <= MAX_PAGE ? page : 1;
}

/** Inclusive row range for a page, the form PostgREST's `range()` takes. */
export function pageRange(page: number, size = PAGE_SIZE): { from: number; to: number } {
  const from = (page - 1) * size;
  return { from, to: from + size - 1 };
}

export function totalPages(count: number, size = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(count / size));
}

export interface PageSummary {
  page: number;
  pages: number;
  /** 1-based number of the first and last row shown; both 0 for an empty list. */
  first: number;
  last: number;
  total: number;
}

export function summarisePage(page: number, count: number, size = PAGE_SIZE): PageSummary {
  const pages = totalPages(count, size);
  if (count === 0 || page > pages) return { page, pages, first: 0, last: 0, total: count };
  const first = (page - 1) * size + 1;
  return { page, pages, first, last: Math.min(count, page * size), total: count };
}

export interface ListSplit {
  /** Slice of the first list to show: items [start, end). */
  start: number;
  end: number;
  /** Rows to read from the second list: skip `restOffset`, take `restLimit`. */
  restOffset: number;
  restLimit: number;
}

/**
 * A page that spans two lists shown one after the other, where the first is
 * already in memory and the second is read from the database in pages.
 */
export function splitAcrossLists(firstLength: number, offset: number, size = PAGE_SIZE): ListSplit {
  const start = Math.min(offset, firstLength);
  const end = Math.min(offset + size, firstLength);
  return {
    start,
    end,
    restOffset: Math.max(0, offset - firstLength),
    restLimit: size - (end - start),
  };
}
