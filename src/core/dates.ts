const DAY_MS = 24 * 60 * 60 * 1000;

/** The moment `days` days before `now`. */
export function daysBefore(now: Date, days: number): Date {
  return new Date(now.getTime() - days * DAY_MS);
}

/** A calendar day written as YYYY-MM-DD (UTC), or null if it is not one. */
export function parseDay(raw: string | undefined): Date | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) return null;
  return date;
}

export interface DayRange {
  /** Inclusive start, ISO timestamp. */
  from?: string;
  /** Exclusive end (the day after `to`), ISO timestamp. */
  before?: string;
  /** True when something was typed that is not a valid day, or the range is backwards. */
  invalid: boolean;
}

/**
 * Turns the two day fields of a filter into timestamps. Both days are
 * included in the range. An unusable value is ignored and flagged, so the page
 * can say so instead of silently showing everything.
 */
export function dayRange(from: string | undefined, to: string | undefined): DayRange {
  const start = from ? parseDay(from) : null;
  const end = to ? parseDay(to) : null;
  const invalid = (Boolean(from) && !start) || (Boolean(to) && !end) || Boolean(start && end && start > end);
  if (invalid) return { invalid };
  return {
    from: start?.toISOString(),
    before: end ? new Date(end.getTime() + DAY_MS).toISOString() : undefined,
    invalid,
  };
}
