import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { formatAmount, formatDateTime } from "@/core/format";
import { parsePage } from "@/core/paging";
import {
  href,
  PAYMENT_KINDS,
  PAYMENT_STATUSES,
  pickOne,
  PLACEHOLDER_PROVIDER,
  providerOrUndefined,
} from "@/core/query";
import { requireAdmin } from "@/db/admin";
import { listPayments } from "@/db/payments";
import {
  EmptyRow,
  FilterLinks,
  Loading,
  Notice,
  PageTitle,
  Pager,
  StatusBadge,
  Table,
  td,
  tdNumber,
  Unavailable,
} from "../../_components/ui";

export const metadata: Metadata = { title: "Payments" };

export default function PaymentsPage(props: PageProps<"/payments">) {
  return (
    <Suspense fallback={<Loading />}>
      <Payments searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Payments({ searchParams }: Pick<PageProps<"/payments">, "searchParams">) {
  const admin = await requireAdmin();
  const query = await searchParams;
  const status = pickOne(query.status, PAYMENT_STATUSES);
  const kind = pickOne(query.kind, PAYMENT_KINDS);
  const provider = providerOrUndefined(query.provider);
  const page = parsePage(query.page);
  const params = { status, kind, provider };
  const result = await listPayments(admin, { status, kind, provider, page });

  return (
    <>
      <PageTitle>Payments</PageTitle>
      <div className="mb-4 flex flex-col gap-2">
        <FilterLinks label="Status" path="/payments" params={params} param="status" options={PAYMENT_STATUSES} />
        <FilterLinks label="Kind" path="/payments" params={params} param="kind" options={PAYMENT_KINDS} />
        <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
          <form method="get" className="flex items-center gap-2">
            {status && <input type="hidden" name="status" value={status} />}
            {kind && <input type="hidden" name="kind" value={kind} />}
            <label className="flex items-center gap-2">
              <span className="text-slate-600">Provider:</span>
              <input
                name="provider"
                defaultValue={provider ?? ""}
                maxLength={40}
                className="min-h-8 w-36 rounded-lg border border-slate-300 bg-white px-2"
              />
            </label>
            <button type="submit" className="min-h-8 rounded-lg border border-slate-300 bg-white px-3 hover:bg-slate-50">
              Filter
            </button>
          </form>
          <Link
            href={href("/payments", { status, kind, provider: PLACEHOLDER_PROVIDER })}
            className="text-blue-700 underline"
          >
            test mode only
          </Link>
          {provider && (
            <Link href={href("/payments", { status, kind })} className="text-blue-700 underline">
              any provider
            </Link>
          )}
        </div>
      </div>
      <Notice>Provider placeholder is test mode: the payment was recorded but no money was taken.</Notice>
      {!result.ok ? (
        <Unavailable />
      ) : (
        <>
          <Table head={["Created", "Company", "Who", "Kind", "What", "Amount", "Status", "Provider", "Reference", "Paid"]}>
            {result.data.rows.length === 0 && <EmptyRow columns={10} />}
            {result.data.rows.map((row) => (
              <tr key={row.id}>
                <td className={`${td} whitespace-nowrap`}>{formatDateTime(row.createdAt)}</td>
                <td className={td}>
                  <Link href={`/tenants/${row.organizationId}`} className="text-blue-700 underline">
                    {row.organizationName ?? row.organizationId}
                  </Link>
                </td>
                <td className={td}>{row.userEmail ?? "–"}</td>
                <td className={td}>{row.kind}</td>
                <td className={td}>{row.what}</td>
                <td className={tdNumber}>{formatAmount(row.amountCzk, row.currency)}</td>
                <td className={td}>
                  <StatusBadge value={row.status} />
                </td>
                <td className={td}>{row.provider}</td>
                <td className={td}>{row.providerReference ?? "–"}</td>
                <td className={`${td} whitespace-nowrap`}>{formatDateTime(row.paidAt)}</td>
              </tr>
            ))}
          </Table>
          <Pager path="/payments" params={params} page={page} total={result.data.total} />
        </>
      )}
    </>
  );
}
