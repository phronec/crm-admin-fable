import { pageRange } from "@/core/paging";
import type { Admin } from "./admin";
import { check, countOf, loaded, rowsOf, type Loaded } from "./result";

export interface Page<T> {
  rows: T[];
  total: number;
}

export interface TenantProfile {
  id: string;
  name: string;
  slug: string;
  industryTemplate: string;
  language: string;
  currency: string;
  visibility: string;
  createdAt: string;
}

/** The company itself (a table that always exists), or null if there is none. */
export async function loadTenantProfile(admin: Admin, id: string): Promise<TenantProfile | null> {
  const result = check(
    await admin.db
      .from("organizations")
      .select("id, name, slug, industry_template, language, currency, visibility, created_at")
      .eq("id", id)
      .maybeSingle(),
  );
  const row = result.data as {
    id: string;
    name: string;
    slug: string;
    industry_template: string;
    language: string;
    currency: string;
    visibility: string;
    created_at: string;
  } | null;
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    industryTemplate: row.industry_template,
    language: row.language,
    currency: row.currency,
    visibility: row.visibility,
    createdAt: row.created_at,
  };
}

export interface TenantFacts {
  deals: number;
  listings: number;
  activeMembers: number;
  site: { slug: string; publishedAt: string | null } | null;
}

export async function loadTenantFacts(admin: Admin, id: string): Promise<TenantFacts> {
  const { db } = admin;
  const [deals, listings, activeMembers, site] = await Promise.all([
    countOf(db.from("deals").select("id", { count: "exact", head: true }).eq("organization_id", id)),
    countOf(
      db.from("listings").select("id", { count: "exact", head: true }).eq("organization_id", id),
    ),
    countOf(
      db
        .from("memberships")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", id)
        .eq("status", "active"),
    ),
    db.from("sites").select("slug, published_at").eq("organization_id", id).maybeSingle(),
  ]);
  const row = check(site).data as { slug: string; published_at: string | null } | null;
  return {
    deals,
    listings,
    activeMembers,
    site: row ? { slug: row.slug, publishedAt: row.published_at } : null,
  };
}

export interface SubscriptionFacts {
  planId: string;
  planName: string | null;
  priceCzk: number | null;
  maxUsers: number | null;
  monthlyTokens: number | null;
  status: string;
  trialEndsAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
  balance: number | null;
}

export async function loadSubscription(
  admin: Admin,
  id: string,
): Promise<Loaded<SubscriptionFacts | null>> {
  return loaded(async () => {
    const { db } = admin;
    const sub = check(
      await db
        .from("subscriptions")
        .select(
          "plan_id, status, trial_ends_at, current_period_start, current_period_end, created_at",
        )
        .eq("organization_id", id)
        .maybeSingle(),
    ).data as {
      plan_id: string;
      status: string;
      trial_ends_at: string | null;
      current_period_start: string | null;
      current_period_end: string | null;
      created_at: string;
    } | null;
    const balance = check(
      await db.from("token_balances").select("balance").eq("organization_id", id).maybeSingle(),
    ).data as { balance: number } | null;
    if (!sub) return null;
    const plan = check(
      await db
        .from("plans")
        .select("name, price_czk, max_users, monthly_tokens")
        .eq("id", sub.plan_id)
        .maybeSingle(),
    ).data as { name: string; price_czk: number; max_users: number; monthly_tokens: number } | null;
    return {
      planId: sub.plan_id,
      planName: plan?.name ?? null,
      priceCzk: plan?.price_czk ?? null,
      maxUsers: plan?.max_users ?? null,
      monthlyTokens: plan?.monthly_tokens ?? null,
      status: sub.status,
      trialEndsAt: sub.trial_ends_at,
      periodStart: sub.current_period_start,
      periodEnd: sub.current_period_end,
      createdAt: sub.created_at,
      balance: balance?.balance ?? null,
    };
  });
}

export interface ModuleRow {
  module: string;
  enabled: boolean;
}

export async function loadModules(admin: Admin, id: string): Promise<Loaded<ModuleRow[]>> {
  return loaded(async () =>
    rowsOf<ModuleRow>(
      check(
        await admin.db
          .from("organization_modules")
          .select("module, enabled")
          .eq("organization_id", id)
          .order("module"),
      ),
    ),
  );
}

export interface DomainRow {
  hostname: string;
  kind: string;
  status: string;
  created_at: string;
  verified_at: string | null;
}

export async function loadDomains(admin: Admin, id: string): Promise<Loaded<DomainRow[]>> {
  return loaded(async () =>
    rowsOf<DomainRow>(
      check(
        await admin.db
          .from("domains")
          .select("hostname, kind, status, created_at, verified_at")
          .eq("organization_id", id)
          .order("created_at", { ascending: false }),
      ),
    ),
  );
}

export interface MemberRow {
  userId: string;
  email: string | null;
  role: string;
  status: string;
  createdAt: string;
}

export async function loadMembers(
  admin: Admin,
  id: string,
  page: number,
): Promise<Loaded<Page<MemberRow>>> {
  return loaded(async () => {
    const { from, to } = pageRange(page);
    const result = check(
      await admin.db
        .from("memberships")
        .select("user_id, role, status, created_at", { count: "exact" })
        .eq("organization_id", id)
        .order("created_at", { ascending: false })
        .range(from, to),
    );
    const rows = rowsOf<{ user_id: string; role: string; status: string; created_at: string }>(result);
    const emails = await Promise.all(rows.map((row) => admin.emailOf(row.user_id)));
    return {
      total: result.count ?? 0,
      rows: rows.map((row, index) => ({
        userId: row.user_id,
        email: emails[index] ?? null,
        role: row.role,
        status: row.status,
        createdAt: row.created_at,
      })),
    };
  });
}

export interface TenantPayment {
  id: string;
  kind: string;
  planId: string | null;
  packId: string | null;
  amountCzk: number;
  currency: string;
  status: string;
  provider: string;
  providerReference: string | null;
  createdAt: string;
  paidAt: string | null;
}

export async function loadTenantPayments(
  admin: Admin,
  id: string,
  page: number,
): Promise<Loaded<Page<TenantPayment>>> {
  return loaded(async () => {
    const { from, to } = pageRange(page);
    const result = check(
      await admin.db
        .from("payments")
        .select(
          "id, kind, plan_id, pack_id, amount_czk, currency, status, provider, provider_reference, created_at, paid_at",
          { count: "exact" },
        )
        .eq("organization_id", id)
        .order("created_at", { ascending: false })
        .range(from, to),
    );
    return {
      total: result.count ?? 0,
      rows: rowsOf<{
        id: string;
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
      }>(result).map((row) => ({
        id: row.id,
        kind: row.kind,
        planId: row.plan_id,
        packId: row.pack_id,
        amountCzk: row.amount_czk,
        currency: row.currency,
        status: row.status,
        provider: row.provider,
        providerReference: row.provider_reference,
        createdAt: row.created_at,
        paidAt: row.paid_at,
      })),
    };
  });
}

export interface LedgerEntry {
  id: number;
  userEmail: string | null;
  delta: number;
  reason: string;
  actionId: string | null;
  balanceAfter: number;
  createdAt: string;
}

export async function loadTenantLedger(
  admin: Admin,
  id: string,
  page: number,
): Promise<Loaded<Page<LedgerEntry>>> {
  return loaded(async () => {
    const { from, to } = pageRange(page);
    const result = check(
      await admin.db
        .from("token_ledger")
        .select("id, user_id, delta, reason, action_id, balance_after, created_at", {
          count: "exact",
        })
        .eq("organization_id", id)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to),
    );
    const rows = rowsOf<{
      id: number;
      user_id: string | null;
      delta: number;
      reason: string;
      action_id: string | null;
      balance_after: number;
      created_at: string;
    }>(result);
    const emails = await Promise.all(
      rows.map((row) => (row.user_id ? admin.emailOf(row.user_id) : Promise.resolve(null))),
    );
    return {
      total: result.count ?? 0,
      rows: rows.map((row, index) => ({
        id: row.id,
        userEmail: emails[index] ?? null,
        delta: row.delta,
        reason: row.reason,
        actionId: row.action_id,
        balanceAfter: row.balance_after,
        createdAt: row.created_at,
      })),
    };
  });
}

export interface EventEntry {
  id: number;
  createdAt: string;
  name: string;
  userEmail: string | null;
  detail: unknown;
}

export async function loadTenantEvents(
  admin: Admin,
  id: string,
  page: number,
): Promise<Loaded<Page<EventEntry>>> {
  return loaded(async () => {
    const { from, to } = pageRange(page);
    const result = check(
      await admin.db
        .from("events")
        .select("id, created_at, user_id, name, detail", { count: "exact" })
        .eq("organization_id", id)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to),
    );
    const rows = rowsOf<{
      id: number;
      created_at: string;
      user_id: string | null;
      name: string;
      detail: unknown;
    }>(result);
    const emails = await Promise.all(
      rows.map((row) => (row.user_id ? admin.emailOf(row.user_id) : Promise.resolve(null))),
    );
    return {
      total: result.count ?? 0,
      rows: rows.map((row, index) => ({
        id: row.id,
        createdAt: row.created_at,
        name: row.name,
        userEmail: emails[index] ?? null,
        detail: row.detail,
      })),
    };
  });
}
