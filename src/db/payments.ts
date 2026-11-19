import { pageRange } from "@/core/paging";
import type { Admin } from "./admin";
import { emailsOf, organizationNames } from "./organizations";
import { check, loaded, rowsOf, type Loaded } from "./result";

export interface PaymentFilter {
  status?: string;
  kind?: string;
  provider?: string;
  page: number;
}

export interface PaymentEntry {
  id: string;
  createdAt: string;
  paidAt: string | null;
  organizationId: string;
  organizationName: string | null;
  userEmail: string | null;
  kind: string;
  what: string;
  amountCzk: number;
  currency: string;
  status: string;
  provider: string;
  providerReference: string | null;
}

/** One page of payments of all companies, newest first. */
export async function listPayments(
  admin: Admin,
  filter: PaymentFilter,
): Promise<Loaded<{ rows: PaymentEntry[]; total: number }>> {
  return loaded(async () => {
    const { from, to } = pageRange(filter.page);
    let query = admin.db
      .from("payments")
      .select(
        "id, organization_id, user_id, kind, plan_id, pack_id, amount_czk, currency, status, provider, provider_reference, created_at, paid_at",
        { count: "exact" },
      );
    if (filter.status) query = query.eq("status", filter.status);
    if (filter.kind) query = query.eq("kind", filter.kind);
    if (filter.provider) query = query.eq("provider", filter.provider);
    const result = check(await query.order("created_at", { ascending: false }).range(from, to));

    const rows = rowsOf<{
      id: string;
      organization_id: string;
      user_id: string | null;
      kind: string;
      plan_id: string | null;
      pack_id: string | null;
      amount_czk: number;
      currency: string;
      status: string;
      provider: string;
      provider_reference: string | null;
      created_at: string;
      paid_at: string | null;
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
        paidAt: row.paid_at,
        organizationId: row.organization_id,
        organizationName: names.get(row.organization_id)?.name ?? null,
        userEmail: row.user_id ? (emails.get(row.user_id) ?? null) : null,
        kind: row.kind,
        what: row.kind === "subscription" ? (row.plan_id ?? "plan") : (row.pack_id ?? "tokens"),
        amountCzk: row.amount_czk,
        currency: row.currency,
        status: row.status,
        provider: row.provider,
        providerReference: row.provider_reference,
      })),
    };
  });
}
