// What the pages accept in the address bar. Anything else is ignored, so
// a page never echoes or passes on raw input.

export const SUBSCRIPTION_STATUSES = ["trialing", "active", "past_due", "canceled"] as const;
export const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"] as const;
export const PAYMENT_KINDS = ["subscription", "tokens"] as const;
export const LEDGER_REASONS = [
  "trial_grant",
  "plan_grant",
  "purchase",
  "spend",
  "adjustment",
] as const;

/** The events the overview counts. Other events still appear in the activity log. */
export const MAIN_EVENTS = [
  "organization.created",
  "user.signed_in",
  "site.created",
  "site.saved",
  "site.published",
  "site.ai_generated",
  "site.screenshot_taken",
  "site.enquiry_received",
  "deal.created",
  "listing.created",
  "tokens.spent",
  "tokens.purchased",
  "payment.completed",
  "subscription.changed",
] as const;

export const PLACEHOLDER_PROVIDER = "placeholder";

export function firstValue(raw: string | string[] | undefined): string | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === "" ? undefined : value;
}

/** The value if it is one of the allowed ones, otherwise undefined. */
export function pickOne<T extends string>(
  raw: string | string[] | undefined,
  allowed: readonly T[],
): T | undefined {
  const value = firstValue(raw);
  return allowed.find((item) => item === value);
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/** An event name such as "deal.created", the same shape the database enforces. */
export function eventNameOrUndefined(raw: string | string[] | undefined): string | undefined {
  const value = firstValue(raw);
  return value && /^[a-z_]+\.[a-z_]+$/.test(value) && value.length <= 60 ? value : undefined;
}

/** A payment provider name such as "placeholder" or "stripe". */
export function providerOrUndefined(raw: string | string[] | undefined): string | undefined {
  const value = firstValue(raw)?.toLowerCase();
  return value && /^[a-z0-9_-]{1,40}$/.test(value) ? value : undefined;
}

/**
 * Search text made safe to put inside a PostgREST filter such as
 * `or=(name.ilike.*text*,...)`: the characters that have a meaning there, and
 * the like wildcards, are removed.
 */
export function cleanSearch(raw: string | string[] | undefined): string | undefined {
  const value = firstValue(raw);
  if (!value) return undefined;
  const cleaned = value
    .replace(/[,()*%_\\"'`]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
  return cleaned === "" ? undefined : cleaned;
}

/** A link with the given query parameters; empty ones are left out. */
export function href(path: string, params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `${path}?${text}` : path;
}
