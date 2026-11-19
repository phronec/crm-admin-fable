import type { Metadata } from "next";
import { Suspense } from "react";
import { formatCzk, formatNumber } from "@/core/format";
import { requireAdmin } from "@/db/admin";
import { loadOverview } from "@/db/overview";
import {
  BarRow,
  Loading,
  Notice,
  PageTitle,
  Section,
  Stat,
  StatGrid,
  Table,
  td,
  tdNumber,
  Unavailable,
} from "../_components/ui";

export const metadata: Metadata = { title: "Overview" };

export default function OverviewPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Overview />
    </Suspense>
  );
}

async function Overview() {
  const admin = await requireAdmin();
  const overview = await loadOverview(admin, new Date());
  const { companies, active, subscriptions, payments, tokens, events } = overview;

  return (
    <>
      <PageTitle>Overview</PageTitle>

      <Section title="Companies">
        {companies.ok ? (
          <StatGrid>
            <Stat label="Companies in total" value={formatNumber(companies.data.total)} />
            <Stat label="New in the last 7 days" value={formatNumber(companies.data.new7)} />
            <Stat label="New in the last 30 days" value={formatNumber(companies.data.new30)} />
          </StatGrid>
        ) : (
          <Unavailable />
        )}
      </Section>

      <Section title="Active companies" note="Companies with at least one event in the activity log.">
        {active.ok ? (
          <>
            {active.data.partial && (
              <Notice>Based on the most recent 10,000 events only; the true figure is at least this high.</Notice>
            )}
            <StatGrid>
              <Stat label="Active in the last 7 days" value={formatNumber(active.data.last7)} />
              <Stat label="Active in the last 30 days" value={formatNumber(active.data.last30)} />
            </StatGrid>
          </>
        ) : (
          <Unavailable />
        )}
      </Section>

      <Section title="Subscriptions">
        {subscriptions.ok ? (
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="mb-1 font-medium text-slate-600">By status</h3>
              {subscriptions.data.byStatus.map((row) => (
                <BarRow
                  key={row.status}
                  label={row.status.replace("_", " ")}
                  value={row.count}
                  max={Math.max(...subscriptions.data.byStatus.map((r) => r.count))}
                />
              ))}
            </div>
            <div>
              <h3 className="mb-1 font-medium text-slate-600">By plan</h3>
              {subscriptions.data.byPlan.map((row) => (
                <BarRow
                  key={row.plan}
                  label={row.plan}
                  value={row.count}
                  max={Math.max(...subscriptions.data.byPlan.map((r) => r.count))}
                />
              ))}
            </div>
          </div>
        ) : (
          <Unavailable />
        )}
      </Section>

      <Section
        title="Payments in the last 30 days"
        note="Only paid payments are counted. Test-mode payments take no money and are kept apart from real ones."
      >
        {payments.ok ? (
          <>
            {payments.data.partial && (
              <Notice>Based on the most recent 10,000 payments only.</Notice>
            )}
            <Table head={["", "Payments", "Total"]}>
              <tr>
                <td className={td}>Real payments</td>
                <td className={tdNumber}>{formatNumber(payments.data.summary.real.count)}</td>
                <td className={tdNumber}>{formatCzk(payments.data.summary.real.totalCzk)}</td>
              </tr>
              <tr>
                <td className={td}>Test mode (placeholder, no money taken)</td>
                <td className={tdNumber}>{formatNumber(payments.data.summary.placeholder.count)}</td>
                <td className={tdNumber}>{formatCzk(payments.data.summary.placeholder.totalCzk)}</td>
              </tr>
              <tr>
                <td className={td}>Not paid (pending, failed, refunded)</td>
                <td className={tdNumber}>{formatNumber(payments.data.summary.notPaid)}</td>
                <td className={tdNumber}>–</td>
              </tr>
            </Table>
          </>
        ) : (
          <Unavailable />
        )}
      </Section>

      <Section title="Clevia AI tokens in the last 30 days">
        {tokens.ok ? (
          <>
            {tokens.data.partial && <Notice>Based on the most recent 10,000 ledger rows only.</Notice>}
            <StatGrid>
              <Stat label="Granted" value={formatNumber(tokens.data.summary.granted)} hint="trial and plan" />
              <Stat label="Bought" value={formatNumber(tokens.data.summary.bought)} />
              <Stat label="Spent" value={formatNumber(tokens.data.summary.spent)} />
              <Stat
                label="Adjusted"
                value={formatNumber(tokens.data.summary.adjusted)}
                hint="refunds and corrections"
              />
            </StatGrid>
          </>
        ) : (
          <Unavailable />
        )}
      </Section>

      <Section title="Events in the last 30 days">
        {events.ok ? (
          <div>
            {events.data.map((row) => (
              <BarRow
                key={row.name}
                label={row.name}
                value={row.count}
                max={Math.max(...events.data.map((r) => r.count))}
              />
            ))}
          </div>
        ) : (
          <Unavailable />
        )}
      </Section>
    </>
  );
}
