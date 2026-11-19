import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { formatDateTime, formatDelta, formatNumber } from "@/core/format";
import { parsePage } from "@/core/paging";
import { LEDGER_REASONS, pickOne } from "@/core/query";
import { requireAdmin } from "@/db/admin";
import { listLedger, loadTokenTotals } from "@/db/tokens";
import {
  EmptyRow,
  FilterLinks,
  Loading,
  Notice,
  PageTitle,
  Pager,
  Section,
  Stat,
  StatGrid,
  Table,
  td,
  tdNumber,
  Unavailable,
} from "../../_components/ui";

export const metadata: Metadata = { title: "AI tokens" };

export default function TokensPage(props: PageProps<"/tokens">) {
  return (
    <Suspense fallback={<Loading />}>
      <Tokens searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Tokens({ searchParams }: Pick<PageProps<"/tokens">, "searchParams">) {
  const admin = await requireAdmin();
  const query = await searchParams;
  const reason = pickOne(query.reason, LEDGER_REASONS);
  const page = parsePage(query.page);
  const params = { reason };
  const [totals, ledger] = await Promise.all([
    loadTokenTotals(admin, new Date()),
    listLedger(admin, { reason, page }),
  ]);

  return (
    <>
      <PageTitle>Clevia AI tokens</PageTitle>
      <Section title="Totals" note="Clevia AI tokens are Clevia's own prepaid units, not the tokens an AI provider bills.">
        {totals.ok ? (
          <>
            {totals.data.partial && <Notice>Based on the most recent 10,000 ledger rows of the last 30 days only.</Notice>}
            <StatGrid>
              <Stat label="Granted, last 30 days" value={formatNumber(totals.data.last30.granted)} hint="trial and plan" />
              <Stat label="Bought, last 30 days" value={formatNumber(totals.data.last30.bought)} />
              <Stat label="Spent, last 30 days" value={formatNumber(totals.data.last30.spent)} />
              <Stat label="Adjusted, last 30 days" value={formatNumber(totals.data.last30.adjusted)} hint="refunds and corrections" />
              <Stat label="Ledger entries, all time" value={formatNumber(totals.data.entries)} />
            </StatGrid>
          </>
        ) : (
          <Unavailable />
        )}
      </Section>

      <Section title="Ledger" note="All companies, newest first.">
        <div className="mb-3">
          <FilterLinks label="Reason" path="/tokens" params={params} param="reason" options={LEDGER_REASONS} />
        </div>
        {!ledger.ok ? (
          <Unavailable />
        ) : (
          <>
            <Table head={["Date", "Company", "Who", "Reason", "Action", "Change", "Balance after"]}>
              {ledger.data.rows.length === 0 && <EmptyRow columns={7} />}
              {ledger.data.rows.map((row) => (
                <tr key={row.id}>
                  <td className={`${td} whitespace-nowrap`}>{formatDateTime(row.createdAt)}</td>
                  <td className={td}>
                    <Link href={`/tenants/${row.organizationId}`} className="text-blue-700 underline">
                      {row.organizationName ?? row.organizationId}
                    </Link>
                  </td>
                  <td className={td}>{row.userEmail ?? "–"}</td>
                  <td className={td}>{row.reason.replace("_", " ")}</td>
                  <td className={td}>{row.actionId ?? "–"}</td>
                  <td className={tdNumber}>{formatDelta(row.delta)}</td>
                  <td className={tdNumber}>{formatNumber(row.balanceAfter)}</td>
                </tr>
              ))}
            </Table>
            <Pager path="/tokens" params={params} page={page} total={ledger.data.total} />
          </>
        )}
      </Section>
    </>
  );
}
