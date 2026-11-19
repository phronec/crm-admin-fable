import { pageRange } from "@/core/paging";
import type { Admin } from "./admin";
import { emailsOf, organizationNames } from "./organizations";
import { check, loaded, rowsOf, type Loaded } from "./result";

export interface ActivityFilter {
  name?: string;
  /** Inclusive start and exclusive end, as ISO timestamps. */
  from?: string;
  before?: string;
  page: number;
}

export interface ActivityItem {
  id: number;
  createdAt: string;
  name: string;
  organizationId: string | null;
  organizationName: string | null;
  userEmail: string | null;
  detail: unknown;
}

export async function listActivity(
  admin: Admin,
  filter: ActivityFilter,
): Promise<Loaded<{ rows: ActivityItem[]; total: number }>> {
  return loaded(async () => {
    const { from, to } = pageRange(filter.page);
    let query = admin.db
      .from("events")
      .select("id, created_at, organization_id, user_id, name, detail", { count: "exact" });
    if (filter.name) query = query.eq("name", filter.name);
    if (filter.from) query = query.gte("created_at", filter.from);
    if (filter.before) query = query.lt("created_at", filter.before);
    const result = check(
      await query
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to),
    );
    const rows = rowsOf<{
      id: number;
      created_at: string;
      organization_id: string | null;
      user_id: string | null;
      name: string;
      detail: unknown;
    }>(result);
    const [names, emails] = await Promise.all([
      organizationNames(
        admin,
        rows.flatMap((row) => (row.organization_id ? [row.organization_id] : [])),
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
        name: row.name,
        organizationId: row.organization_id,
        organizationName: row.organization_id ? (names.get(row.organization_id)?.name ?? null) : null,
        userEmail: row.user_id ? (emails.get(row.user_id) ?? null) : null,
        detail: row.detail,
      })),
    };
  });
}
