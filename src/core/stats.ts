import { daysBefore } from "./dates";
import { PLACEHOLDER_PROVIDER } from "./query";

export interface PaymentRow {
  provider: string;
  status: string;
  amount_czk: number;
}

export interface MoneySummary {
  count: number;
  totalCzk: number;
}

export interface PaymentSummary {
  /** Paid payments that went through a real provider. */
  real: MoneySummary;
  /** Paid payments of the test mode, where no money was taken. */
  placeholder: MoneySummary;
  /** Payments that are not paid (pending, failed, refunded). */
  notPaid: number;
}

/** Keeps test-mode payments apart from real ones: they must never be added together. */
export function summarisePayments(rows: PaymentRow[]): PaymentSummary {
  const summary: PaymentSummary = {
    real: { count: 0, totalCzk: 0 },
    placeholder: { count: 0, totalCzk: 0 },
    notPaid: 0,
  };
  for (const row of rows) {
    if (row.status !== "paid") {
      summary.notPaid += 1;
      continue;
    }
    const target = row.provider === PLACEHOLDER_PROVIDER ? summary.placeholder : summary.real;
    target.count += 1;
    target.totalCzk += row.amount_czk;
  }
  return summary;
}

export interface LedgerRow {
  reason: string;
  delta: number;
}

export interface TokenSummary {
  /** Trial and monthly plan grants. */
  granted: number;
  bought: number;
  /** Tokens used, as a positive number. */
  spent: number;
  /** Net of manual adjustments and refunds of failed AI calls. */
  adjusted: number;
}

export function summariseLedger(rows: LedgerRow[]): TokenSummary {
  const summary: TokenSummary = { granted: 0, bought: 0, spent: 0, adjusted: 0 };
  for (const row of rows) {
    if (row.reason === "trial_grant" || row.reason === "plan_grant") summary.granted += row.delta;
    else if (row.reason === "purchase") summary.bought += row.delta;
    else if (row.reason === "spend") summary.spent -= row.delta;
    else if (row.reason === "adjustment") summary.adjusted += row.delta;
  }
  return summary;
}

export interface EventOrgRow {
  organization_id: string | null;
  created_at: string;
}

/** How many different companies have an event in the last 7 and 30 days. */
export function countActiveCompanies(
  rows: EventOrgRow[],
  now: Date,
): { last7: number; last30: number } {
  const since7 = daysBefore(now, 7).getTime();
  const since30 = daysBefore(now, 30).getTime();
  const seven = new Set<string>();
  const thirty = new Set<string>();
  for (const row of rows) {
    if (!row.organization_id) continue;
    const time = new Date(row.created_at).getTime();
    if (time >= since30) thirty.add(row.organization_id);
    if (time >= since7) seven.add(row.organization_id);
  }
  return { last7: seven.size, last30: thirty.size };
}

/** The first `limit` different values, in the order they first appear. */
export function distinctInOrder(values: Array<string | null>, limit: number): string[] {
  const seen = new Set<string>();
  for (const value of values) {
    if (value === null || seen.has(value)) continue;
    seen.add(value);
    if (seen.size >= limit) break;
  }
  return [...seen];
}
