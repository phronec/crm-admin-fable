import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { dayRange } from "@/core/dates";
import { formatDateTime, formatDetail } from "@/core/format";
import { parsePage } from "@/core/paging";
import { eventNameOrUndefined, firstValue, href, MAIN_EVENTS } from "@/core/query";
import { requireAdmin } from "@/db/admin";
import { listActivity } from "@/db/activity";
import {
  EmptyRow,
  FilterLinks,
  Loading,
  PageTitle,
  Pager,
  Table,
  td,
  Unavailable,
  Warning,
} from "../../_components/ui";

export const metadata: Metadata = { title: "Activity" };

export default function ActivityPage(props: PageProps<"/activity">) {
  return (
    <Suspense fallback={<Loading />}>
      <Activity searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Activity({ searchParams }: Pick<PageProps<"/activity">, "searchParams">) {
  const admin = await requireAdmin();
  const query = await searchParams;
  const name = eventNameOrUndefined(query.name);
  const fromText = firstValue(query.from);
  const toText = firstValue(query.to);
  const range = dayRange(fromText, toText);
  const page = parsePage(query.page);
  // A bad date is ignored and said so; it is not kept in the links.
  const from = range.invalid ? undefined : fromText;
  const to = range.invalid ? undefined : toText;
  const params = { name, from, to };
  const result = await listActivity(admin, { name, from: range.from, before: range.before, page });

  return (
    <>
      <PageTitle>Activity</PageTitle>
      <div className="mb-4 flex flex-col gap-2">
        <FilterLinks label="Event" path="/activity" params={params} param="name" options={MAIN_EVENTS} />
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-slate-600">Event name</span>
            <input
              name="name"
              defaultValue={name ?? ""}
              maxLength={60}
              placeholder="deal.created"
              className="min-h-9 w-48 rounded-lg border border-slate-300 bg-white px-3"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-slate-600">From (UTC day)</span>
            <input name="from" type="date" defaultValue={from ?? ""} className="min-h-9 rounded-lg border border-slate-300 bg-white px-3" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-slate-600">To (UTC day, included)</span>
            <input name="to" type="date" defaultValue={to ?? ""} className="min-h-9 rounded-lg border border-slate-300 bg-white px-3" />
          </label>
          <button type="submit" className="min-h-9 rounded-lg bg-blue-700 px-4 font-semibold text-white hover:bg-blue-800">
            Filter
          </button>
          {(name || from || to) && (
            <Link href={href("/activity", {})} className="py-2 text-blue-700 underline">
              Clear
            </Link>
          )}
        </form>
      </div>
      {range.invalid && (
        <Warning>The dates were not understood or the range is backwards, so no date filter is applied.</Warning>
      )}
      {!result.ok ? (
        <Unavailable />
      ) : (
        <>
          <Table head={["Time", "Event", "Company", "Who", "Detail"]}>
            {result.data.rows.length === 0 && <EmptyRow columns={5} />}
            {result.data.rows.map((row) => (
              <tr key={row.id}>
                <td className={`${td} whitespace-nowrap`}>{formatDateTime(row.createdAt)}</td>
                <td className={td}>{row.name}</td>
                <td className={td}>
                  {row.organizationId ? (
                    <Link href={`/tenants/${row.organizationId}`} className="text-blue-700 underline">
                      {row.organizationName ?? row.organizationId}
                    </Link>
                  ) : (
                    "–"
                  )}
                </td>
                <td className={td}>{row.userEmail ?? "–"}</td>
                <td className={`${td} font-mono text-xs break-all`}>{formatDetail(row.detail)}</td>
              </tr>
            ))}
          </Table>
          <Pager path="/activity" params={params} page={page} total={result.data.total} />
        </>
      )}
    </>
  );
}
