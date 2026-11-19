const NUMBER = new Intl.NumberFormat("en-GB");
const CZK = new Intl.NumberFormat("cs-CZ", {
  style: "currency",
  currency: "CZK",
  maximumFractionDigits: 0,
});

export function formatNumber(value: number): string {
  return NUMBER.format(value);
}

/** Whole crowns, for example "1 290 Kč". */
export function formatCzk(amount: number): string {
  return CZK.format(amount);
}

/** An amount in any currency; CZK is formatted the Czech way. */
export function formatAmount(amount: number, currency: string): string {
  if (currency === "CZK") return formatCzk(amount);
  return `${NUMBER.format(amount)} ${currency}`;
}

/** A change in AI tokens with an explicit sign, for example "+300" or "−50". */
export function formatDelta(delta: number): string {
  if (delta > 0) return `+${NUMBER.format(delta)}`;
  if (delta < 0) return `−${NUMBER.format(-delta)}`;
  return "0";
}

// Dates are shown in UTC so the same row reads the same wherever the owner is.
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "–";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "–";
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "–";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "–";
  return date.toISOString().slice(0, 10);
}

/** Shortens long text for a table cell. */
export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/** A JSON value on one line, shortened, for the activity tables. */
export function formatDetail(detail: unknown, max = 160): string {
  if (detail === null || detail === undefined) return "";
  const text = typeof detail === "string" ? detail : JSON.stringify(detail);
  return text === "{}" ? "" : truncate(text, max);
}

/** Share of `max` as a whole percentage from 0 to 100, for the CSS bars. */
export function percentOf(value: number, max: number): number {
  if (max <= 0 || value <= 0) return 0;
  return Math.min(100, Math.round((value / max) * 100));
}
