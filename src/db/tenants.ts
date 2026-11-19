import { pageRange, splitAcrossLists } from "@/core/paging";
import { distinctInOrder } from "@/core/stats";
import type { Admin } from "./admin";
import { check, countOf, loaded, rowsOf, type Loaded } from "./result";

export type TenantSort = "created" | "active";

export interface TenantRow {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  ownerEmail: string | null;
  /** Newest event of the company; null when it has none. */
  lastActive: string | null;
  planName: string | null;
  status: string | null;
  trialEndsAt: string | null;
  members: number;
  deals: number;
  listings: number;
  published: boolean;
  balance: number | null;
}

export interface TenantList {
  rows: TenantRow[];
  total: number;
  /** Columns that could not be filled because their table does not exist yet. */
  unavailable: string[];
}

interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  memberships: Array<{ count: number }> | null;
  deals: Array<{ count: number }> | null;
  listings: Array<{ count: number }> | null;
  // To-one through a unique key, but be lenient about the shape.
  sites: { published_at: string | null } | Array<{ published_at: string | null }> | null;
}

// Counts of related rows come as embedded `table(count)` selects, so one
// request fills the whole page. Only active members are counted.
const ORGANIZATION_COLUMNS =
  "id, name, slug, created_at, memberships(count), deals(count), listings(count), sites(published_at)";

// How many of the most recently active companies are put first when sorting
// by last activity. Sorting every company by its newest event needs a database
// function; this keeps it to a bounded read of the event log.
const RECENT_LIMIT = 100;
const RECENT_SCAN_CAP = 5000;

function organizationQuery(admin: Admin, search: string | undefined) {
  let query = admin.db
    .from("organizations")
    .select(ORGANIZATION_COLUMNS, { count: "exact" })
    .eq("memberships.status", "active");
  if (search) query = query.or(`name.ilike.*${search}*,slug.ilike.*${search}*`);
  return query;
}

async function recentCompanyIds(admin: Admin): Promise<string[]> {
  const seen: Array<string | null> = [];
  while (seen.length < RECENT_SCAN_CAP) {
    const result = check(
      await admin.db
        .from("events")
        .select("organization_id")
        .not("organization_id", "is", null)
        .order("created_at", { ascending: false })
        .range(seen.length, seen.length + 999),
    );
    const chunk = rowsOf<{ organization_id: string }>(result).map((row) => row.organization_id);
    seen.push(...chunk);
    if (distinctInOrder(seen, RECENT_LIMIT).length >= RECENT_LIMIT || chunk.length < 1000) break;
  }
  return distinctInOrder(seen, RECENT_LIMIT);
}

/** The companies of one page, in the order asked for. */
async function loadOrganizationPage(
  admin: Admin,
  search: string | undefined,
  sort: TenantSort,
  page: number,
  unavailable: string[],
): Promise<{ rows: OrganizationRow[]; total: number }> {
  const { from, to } = pageRange(page);

  if (sort === "created") {
    const result = check(
      await organizationQuery(admin, search)
        .order("created_at", { ascending: false })
        .range(from, to),
    );
    return { rows: rowsOf<OrganizationRow>(result), total: result.count ?? 0 };
  }

  // Last active: the recently active companies first, newest event first,
  // then everyone else by creation date.
  const recent = await loaded(() => recentCompanyIds(admin));
  const recentIds = recent.ok ? recent.data : [];
  if (!recent.ok) unavailable.push("last active sort");

  let count = admin.db.from("organizations").select("id", { count: "exact" });
  if (search) count = count.or(`name.ilike.*${search}*,slug.ilike.*${search}*`);
  const total = await countOf(count);

  let first: OrganizationRow[] = [];
  if (recentIds.length > 0) {
    const found = rowsOf<OrganizationRow>(
      check(await organizationQuery(admin, search).in("id", recentIds)),
    );
    const byId = new Map(found.map((row) => [row.id, row]));
    first = recentIds.flatMap((id) => byId.get(id) ?? []);
  }

  const split = splitAcrossLists(first.length, from);
  const rows = first.slice(split.start, split.end);
  if (split.restLimit > 0) {
    let rest = organizationQuery(admin, search);
    if (recentIds.length > 0) rest = rest.not("id", "in", `(${recentIds.join(",")})`);
    const result = check(
      await rest
        .order("created_at", { ascending: false })
        .range(split.restOffset, split.restOffset + split.restLimit - 1),
    );
    rows.push(...rowsOf<OrganizationRow>(result));
  }
  return { rows, total };
}

function countFrom(embedded: Array<{ count: number }> | null): number {
  return embedded?.[0]?.count ?? 0;
}

function publishedFrom(sites: OrganizationRow["sites"]): boolean {
  const site = Array.isArray(sites) ? sites[0] : sites;
  return Boolean(site?.published_at);
}

/** One page of the companies list with everything the table shows. */
export async function listTenants(
  admin: Admin,
  options: { search?: string; sort: TenantSort; page: number },
): Promise<TenantList> {
  const unavailable: string[] = [];
  const { rows: organizations, total } = await loadOrganizationPage(
    admin,
    options.search,
    options.sort,
    options.page,
    unavailable,
  );
  const ids = organizations.map((row) => row.id);
  if (ids.length === 0) return { rows: [], total, unavailable };
  const { db } = admin;

  const [owners, subscriptions, balances, plans, lastActive] = await Promise.all([
    loaded(async () =>
      rowsOf<{ organization_id: string; user_id: string }>(
        check(
          await db
            .from("memberships")
            .select("organization_id, user_id")
            .eq("role", "owner")
            .in("organization_id", ids),
        ),
      ),
    ),
    loaded(async () =>
      rowsOf<{
        organization_id: string;
        plan_id: string;
        status: string;
        trial_ends_at: string | null;
      }>(
        check(
          await db
            .from("subscriptions")
            .select("organization_id, plan_id, status, trial_ends_at")
            .in("organization_id", ids),
        ),
      ),
    ),
    loaded(async () =>
      rowsOf<{ organization_id: string; balance: number }>(
        check(
          await db.from("token_balances").select("organization_id, balance").in("organization_id", ids),
        ),
      ),
    ),
    loaded(async () =>
      rowsOf<{ id: string; name: string }>(check(await db.from("plans").select("id, name"))),
    ),
    // The newest event of each company: one small indexed read per row.
    loaded(async () =>
      Promise.all(
        ids.map(async (id) => {
          const result = check(
            await db
              .from("events")
              .select("created_at")
              .eq("organization_id", id)
              .order("created_at", { ascending: false })
              .limit(1),
          );
          return [id, rowsOf<{ created_at: string }>(result)[0]?.created_at ?? null] as const;
        }),
      ),
    ),
  ]);

  const missing = (name: string, value: Loaded<unknown>) => {
    if (!value.ok) unavailable.push(name);
  };
  missing("plan and status", subscriptions);
  missing("plan and status", plans);
  missing("token balance", balances);
  missing("last active", lastActive);

  const ownerByOrg = new Map(owners.ok ? owners.data.map((o) => [o.organization_id, o.user_id]) : []);
  const emails = new Map(
    await Promise.all(
      [...new Set(ownerByOrg.values())].map(async (id) => [id, await admin.emailOf(id)] as const),
    ),
  );
  const subscriptionByOrg = new Map(
    subscriptions.ok ? subscriptions.data.map((s) => [s.organization_id, s]) : [],
  );
  const planNames = new Map(plans.ok ? plans.data.map((p) => [p.id, p.name]) : []);
  const balanceByOrg = new Map(balances.ok ? balances.data.map((b) => [b.organization_id, b.balance]) : []);
  const activeByOrg = new Map(lastActive.ok ? lastActive.data : []);

  const rows = organizations.map((org): TenantRow => {
    const subscription = subscriptionByOrg.get(org.id);
    const ownerId = ownerByOrg.get(org.id);
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      createdAt: org.created_at,
      ownerEmail: ownerId ? (emails.get(ownerId) ?? null) : null,
      lastActive: activeByOrg.get(org.id) ?? null,
      planName: subscription ? (planNames.get(subscription.plan_id) ?? subscription.plan_id) : null,
      status: subscription?.status ?? null,
      trialEndsAt: subscription?.trial_ends_at ?? null,
      members: countFrom(org.memberships),
      deals: countFrom(org.deals),
      listings: countFrom(org.listings),
      published: publishedFrom(org.sites),
      balance: balanceByOrg.get(org.id) ?? null,
    };
  });
  return { rows, total, unavailable: [...new Set(unavailable)] };
}
