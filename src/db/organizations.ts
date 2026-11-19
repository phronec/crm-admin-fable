import type { Admin } from "./admin";
import { check, rowsOf } from "./result";

export interface OrganizationName {
  id: string;
  name: string;
  slug: string;
}

/** Names of the organizations with the given ids, for the cross-company lists. */
export async function organizationNames(
  admin: Admin,
  ids: string[],
): Promise<Map<string, OrganizationName>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const result = check(
    await admin.db.from("organizations").select("id, name, slug").in("id", unique),
  );
  return new Map(rowsOf<OrganizationName>(result).map((row) => [row.id, row]));
}

/** Emails for the given auth users, looked up once each per request. */
export async function emailsOf(
  admin: Admin,
  ids: Array<string | null>,
): Promise<Map<string, string | null>> {
  const unique = [...new Set(ids.filter((id): id is string => id !== null))];
  const pairs = await Promise.all(
    unique.map(async (id) => [id, await admin.emailOf(id)] as const),
  );
  return new Map(pairs);
}
