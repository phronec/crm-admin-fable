import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { formatDate, formatDateTime, formatNumber } from "@/core/format";
import { parsePage } from "@/core/paging";
import { cleanSearch, href, pickOne } from "@/core/query";
import { requireAdmin } from "@/db/admin";
import { listTenants } from "@/db/tenants";
import {
  EmptyRow,
  Loading,
  Notice,
  PageTitle,
  Pager,
  StatusBadge,
  Table,
  td,
  tdNumber,
} from "../../_components/ui";

export const metadata: Metadata = { title: "Companies" };

const SORTS = ["created", "active"] as const;

export default function TenantsPage(props: PageProps<"/tenants">) {
  return (
    <Suspense fallback={<Loading />}>
      <Tenants searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Tenants({ searchParams }: Pick<PageProps<"/tenants">, "searchParams">) {
  const admin = await requireAdmin();
  const query = await searchParams;
  const search = cleanSearch(query.q);
  const sort = pickOne(query.sort, SORTS) ?? "created";
  const page = parsePage(query.page);
  const list = await listTenants(admin, { search, sort, page });
  const params = { q: search, sort: sort === "created" ? undefined : sort };

  return (
    <>
      <PageTitle>Companies</PageTitle>
      <div className="mb-4 flex flex-wrap items-end gap-x-6 gap-y-3">
        <form method="get" className="flex items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-slate-600">Search by name or address name</span>
            <input
              name="q"
              defaultValue={search ?? ""}
              maxLength={60}
              className="min-h-9 w-64 rounded-lg border border-slate-300 bg-white px-3"
            />
          </label>
          {params.sort && <input type="hidden" name="sort" value={params.sort} />}
          <button
            type="submit"
            className="min-h-9 rounded-lg bg-blue-700 px-4 font-semibold text-white hover:bg-blue-800"
          >
            Search
          </button>
          {search && (
            <Link href={href("/tenants", { sort: params.sort })} className="py-2 text-blue-700 underline">
              Clear
            </Link>
          )}
        </form>
        <div className="flex items-center gap-3">
          <span className="text-slate-600">Sort by:</span>
          <Link
            href={href("/tenants", { q: search })}
            className={sort === "created" ? "font-semibold" : "text-blue-700 underline"}
          >
            created
          </Link>
          <Link
            href={href("/tenants", { q: search, sort: "active" })}
            className={sort === "active" ? "font-semibold" : "text-blue-700 underline"}
          >
            last active
          </Link>
        </div>
      </div>

      {sort === "active" && (
        <Notice>
          The 100 most recently active companies come first, newest event first; all others follow by
          creation date.
        </Notice>
      )}
      {list.unavailable.length > 0 && (
        <Notice>Not available yet, shown as a dash: {list.unavailable.join(", ")}.</Notice>
      )}

      <Table
        head={[
          "Company",
          "Address",
          "Owner",
          "Created",
          "Last active",
          "Plan",
          "Status",
          "Trial ends",
          "Members",
          "Deals",
          "Listings",
          "Website",
          "AI tokens",
        ]}
      >
        {list.rows.length === 0 && <EmptyRow columns={13} />}
        {list.rows.map((row) => (
          <tr key={row.id}>
            <td className={td}>
              <Link href={`/tenants/${row.id}`} className="font-medium text-blue-700 underline">
                {row.name}
              </Link>
            </td>
            <td className={td}>{row.slug}</td>
            <td className={td}>{row.ownerEmail ?? "–"}</td>
            <td className={`${td} whitespace-nowrap`}>{formatDate(row.createdAt)}</td>
            <td className={`${td} whitespace-nowrap`}>{formatDateTime(row.lastActive)}</td>
            <td className={td}>{row.planName ?? "–"}</td>
            <td className={td}>
              <StatusBadge value={row.status} />
            </td>
            <td className={`${td} whitespace-nowrap`}>{formatDate(row.trialEndsAt)}</td>
            <td className={tdNumber}>{formatNumber(row.members)}</td>
            <td className={tdNumber}>{formatNumber(row.deals)}</td>
            <td className={tdNumber}>{formatNumber(row.listings)}</td>
            <td className={td}>{row.published ? "published" : "not published"}</td>
            <td className={tdNumber}>{row.balance === null ? "–" : formatNumber(row.balance)}</td>
          </tr>
        ))}
      </Table>
      <Pager path="/tenants" params={params} page={page} total={list.total} />
    </>
  );
}

