import { daysBefore } from "@/core/dates";
import { pageRange } from "@/core/paging";
import { summariseLedger, type LedgerRow, type TokenSummary } from "@/core/stats";
import type { Admin } from "./admin";
import { emailsOf, organizationNames } from "./organizations";
import { check, countOf, loaded, rowsOf, scan, type Loaded } from "./result";

export interface TokenTotals {
  /** Rows in the whole ledger, counted by the server. */
  entries: number;
  last30: TokenSummary;
  partial: boolean;
}

/** The figures at the top of the tokens page. */
export async function loadTokenTotals(admin: Admin, now: Date): Promise<Loaded<TokenTotals>> {
  return loaded(async () => {
    const since30 = daysBefore(now, 30).toISOString();
    const [entries, window] = await Promise.all([
      countOf(admin.db.from("token_ledger").select("id", { count: "exact" })),
      scan<LedgerRow>((from, to) =>
        admin.db
          .from("token_ledger")
          .select("reason, delta")
          .gte("created_at", since30)
          .order("created_at", { ascending: false })
          .range(from, to),
      ),
    ]);
    return { entries, last30: summariseLedger(window.rows), partial: window.truncated };
  });
}

export interface LedgerFilter {
  reason?: string;
  page: number;
}

export interface LedgerItem {
  id: number;
  createdAt: string;
  organizationId: string;
  organizationName: string | null;
  userEmail: string | null;
  reason: string;
  actionId: string | null;
  delta: number;
  balanceAfter: number;
}

export async function listLedger(
  admin: Admin,
  filter: LedgerFilter,
): Promise<Loaded<{ rows: LedgerItem[]; total: number }>> {
  return loaded(async () => {
    const { from, to } = pageRange(filter.page);
    let query = admin.db
      .from("token_ledger")
      .select("id, organization_id, user_id, delta, reason, action_id, balance_after, created_at", {
        count: "exact",
      });
    if (filter.reason) query = query.eq("reason", filter.reason);
    const result = check(
      await query
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to),
    );
    const rows = rowsOf<{
      id: number;
      organization_id: string;
      user_id: string | null;
      delta: number;
      reason: string;
      action_id: string | null;
      balance_after: number;
      created_at: string;
    }>(result);
    const [names, emails] = await Promise.all([
      organizationNames(
        admin,
        rows.map((row) => row.organization_id),
      ),
      emailsOf(
        admin,
        rows.map((row) => row.user_id),
      ),
    ]);
    return {
      total: result.count ?? 0,
      rows: rows.map((row) => ({
        id: row.id,
        createdAt: row.created_at,
        organizationId: row.organization_id,
        organizationName: names.get(row.organization_id)?.name ?? null,
        userEmail: row.user_id ? (emails.get(row.user_id) ?? null) : null,
        reason: row.reason,
        actionId: row.action_id,
        delta: row.delta,
        balanceAfter: row.balance_after,
      })),
    };
  });
}
