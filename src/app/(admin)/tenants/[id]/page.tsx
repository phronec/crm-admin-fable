import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  formatAmount,
  formatCzk,
  formatDate,
  formatDateTime,
  formatDelta,
  formatDetail,
  formatNumber,
} from "@/core/format";
import { parsePage } from "@/core/paging";
import { isUuid } from "@/core/query";
import { requireAdmin, type Admin } from "@/db/admin";
import {
  loadDomains,
  loadMembers,
  loadModules,
  loadSubscription,
  loadTenantEvents,
  loadTenantFacts,
  loadTenantLedger,
  loadTenantPayments,
  loadTenantProfile,
} from "@/db/tenant-detail";
import {
  EmptyRow,
  Facts,
  Loading,
  PageTitle,
  Pager,
  Section,
  StatusBadge,
  Table,
  td,
  tdNumber,
  Unavailable,
} from "../../../_components/ui";

export const metadata: Metadata = { title: "Company" };

type Props = PageProps<"/tenants/[id]">;

export default function TenantPage(props: Props) {
  return (
    <Suspense fallback={<Loading />}>
      <Tenant params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

// The four lists on the page each have their own page number in the address.
const PAGE_PARAMS = ["members_page", "payments_page", "ledger_page", "events_page"] as const;
type PageParam = (typeof PAGE_PARAMS)[number];

async function Tenant({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const admin = await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const profile = await loadTenantProfile(admin, id);
  if (!profile) notFound();

  const query = await searchParams;
  const pages = Object.fromEntries(PAGE_PARAMS.map((name) => [name, parsePage(query[name])])) as Record<
    PageParam,
    number
  >;
  // Keeps the other lists where they are when one list changes page.
  const keep = (own: PageParam) =>
    Object.fromEntries(
      PAGE_PARAMS.filter((name) => name !== own && pages[name] > 1).map((name) => [name, String(pages[name])]),
    );
  const path = `/tenants/${id}`;

  return (
    <>
      <p className="mb-2">
        <Link href="/tenants" className="text-blue-700 underline">
          All companies
        </Link>
      </p>
      <PageTitle>{profile.name}</PageTitle>

      <Section title="Company">
        <Suspense fallback={<Loading />}>
          <Facts
            items={[
              ["Address name", profile.slug],
              ["Created", formatDateTime(profile.createdAt)],
              ["Industry template", profile.industryTemplate],
              ["Language", profile.language],
              ["Currency", profile.currency],
              ["Visibility", profile.visibility],
              ["Id", <code key="id">{profile.id}</code>],
            ]}
          />
          <FactsBlock admin={admin} id={id} />
        </Suspense>
      </Section>

      <Section title="Subscription">
        <Suspense fallback={<Loading />}>
          <SubscriptionBlock admin={admin} id={id} />
        </Suspense>
      </Section>

      <Section title="Modules">
        <Suspense fallback={<Loading />}>
          <ModulesBlock admin={admin} id={id} />
        </Suspense>
      </Section>

      <Section title="Domains">
        <Suspense fallback={<Loading />}>
          <DomainsBlock admin={admin} id={id} />
        </Suspense>
      </Section>

      <Section title="Members">
        <Suspense fallback={<Loading />}>
          <MembersBlock admin={admin} id={id} page={pages.members_page} path={path} params={keep("members_page")} />
        </Suspense>
      </Section>

      <Section title="Payments" note="Newest first. Provider placeholder means test mode: no money was taken.">
        <Suspense fallback={<Loading />}>
          <PaymentsBlock admin={admin} id={id} page={pages.payments_page} path={path} params={keep("payments_page")} />
        </Suspense>
      </Section>

      <Section title="Clevia AI token ledger" note="Newest first.">
        <Suspense fallback={<Loading />}>
          <LedgerBlock admin={admin} id={id} page={pages.ledger_page} path={path} params={keep("ledger_page")} />
        </Suspense>
      </Section>

      <Section title="Event timeline" note="Newest first.">
        <Suspense fallback={<Loading />}>
          <EventsBlock admin={admin} id={id} page={pages.events_page} path={path} params={keep("events_page")} />
        </Suspense>
      </Section>
    </>
  );
}

interface BlockProps {
  admin: Admin;
  id: string;
}

interface PagedBlockProps extends BlockProps {
  page: number;
  path: string;
  params: Record<string, string | undefined>;
}

async function FactsBlock({ admin, id }: BlockProps) {
  const facts = await loadTenantFacts(admin, id);
  return (
    <div className="mt-1">
      <Facts
        items={[
          ["Active members", formatNumber(facts.activeMembers)],
          ["Deals", formatNumber(facts.deals)],
          ["Listings", formatNumber(facts.listings)],
          [
            "Website",
            facts.site
              ? `${facts.site.publishedAt ? "published" : "not published"} (${facts.site.slug}${
                  facts.site.publishedAt ? `, since ${formatDate(facts.site.publishedAt)}` : ""
                })`
              : "none yet",
          ],
        ]}
      />
    </div>
  );
}

async function SubscriptionBlock({ admin, id }: BlockProps) {
  const loaded = await loadSubscription(admin, id);
  if (!loaded.ok) return <Unavailable />;
  const sub = loaded.data;
  if (!sub) return <p className="text-slate-600">This company has no subscription.</p>;
  return (
    <Facts
      items={[
        ["Plan", `${sub.planName ?? sub.planId}${sub.priceCzk === null ? "" : ` (${formatCzk(sub.priceCzk)} per month)`}`],
        ["Status", <StatusBadge key="s" value={sub.status} />],
        ["Trial ends", formatDateTime(sub.trialEndsAt)],
        ["Current period", `${formatDate(sub.periodStart)} to ${formatDate(sub.periodEnd)}`],
        ["Users allowed", sub.maxUsers === null ? "–" : formatNumber(sub.maxUsers)],
        ["AI tokens per month", sub.monthlyTokens === null ? "–" : formatNumber(sub.monthlyTokens)],
        ["AI token balance", sub.balance === null ? "–" : formatNumber(sub.balance)],
        ["Subscribed since", formatDateTime(sub.createdAt)],
      ]}
    />
  );
}

async function ModulesBlock({ admin, id }: BlockProps) {
  const loaded = await loadModules(admin, id);
  if (!loaded.ok) return <Unavailable />;
  return (
    <Table head={["Module", "Enabled"]}>
      {loaded.data.length === 0 && <EmptyRow columns={2} />}
      {loaded.data.map((row) => (
        <tr key={row.module}>
          <td className={td}>{row.module}</td>
          <td className={td}>{row.enabled ? "yes" : "no"}</td>
        </tr>
      ))}
    </Table>
  );
}

async function DomainsBlock({ admin, id }: BlockProps) {
  const loaded = await loadDomains(admin, id);
  if (!loaded.ok) return <Unavailable />;
  return (
    <Table head={["Hostname", "Kind", "Status", "Added", "Verified"]}>
      {loaded.data.length === 0 && <EmptyRow columns={5} />}
      {loaded.data.map((row) => (
        <tr key={row.hostname}>
          <td className={td}>{row.hostname}</td>
          <td className={td}>{row.kind}</td>
          <td className={td}>{row.status}</td>
          <td className={td}>{formatDate(row.created_at)}</td>
          <td className={td}>{formatDate(row.verified_at)}</td>
        </tr>
      ))}
    </Table>
  );
}

async function MembersBlock({ admin, id, page, path, params }: PagedBlockProps) {
  const loaded = await loadMembers(admin, id, page);
  if (!loaded.ok) return <Unavailable />;
  return (
    <>
      <Table head={["Email", "Role", "Status", "Joined"]}>
        {loaded.data.rows.length === 0 && <EmptyRow columns={4} />}
        {loaded.data.rows.map((row) => (
          <tr key={row.userId}>
            <td className={td}>{row.email ?? "–"}</td>
            <td className={td}>{row.role}</td>
            <td className={td}>{row.status}</td>
            <td className={td}>{formatDate(row.createdAt)}</td>
          </tr>
        ))}
      </Table>
      <Pager path={path} params={params} pageParam="members_page" page={page} total={loaded.data.total} />
    </>
  );
}

async function PaymentsBlock({ admin, id, page, path, params }: PagedBlockProps) {
  const loaded = await loadTenantPayments(admin, id, page);
  if (!loaded.ok) return <Unavailable />;
  return (
    <>
      <Table head={["Created", "Kind", "What", "Amount", "Status", "Provider", "Reference", "Paid"]}>
        {loaded.data.rows.length === 0 && <EmptyRow columns={8} />}
        {loaded.data.rows.map((row) => (
          <tr key={row.id}>
            <td className={`${td} whitespace-nowrap`}>{formatDateTime(row.createdAt)}</td>
            <td className={td}>{row.kind}</td>
            <td className={td}>{row.kind === "subscription" ? row.planId : row.packId}</td>
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
      <Pager path={path} params={params} pageParam="payments_page" page={page} total={loaded.data.total} />
    </>
  );
}

async function LedgerBlock({ admin, id, page, path, params }: PagedBlockProps) {
  const loaded = await loadTenantLedger(admin, id, page);
  if (!loaded.ok) return <Unavailable />;
  return (
    <>
      <Table head={["Date", "Who", "Reason", "Action", "Change", "Balance after"]}>
        {loaded.data.rows.length === 0 && <EmptyRow columns={6} />}
        {loaded.data.rows.map((row) => (
          <tr key={row.id}>
            <td className={`${td} whitespace-nowrap`}>{formatDateTime(row.createdAt)}</td>
            <td className={td}>{row.userEmail ?? "–"}</td>
            <td className={td}>{row.reason.replace("_", " ")}</td>
            <td className={td}>{row.actionId ?? "–"}</td>
            <td className={tdNumber}>{formatDelta(row.delta)}</td>
            <td className={tdNumber}>{formatNumber(row.balanceAfter)}</td>
          </tr>
        ))}
      </Table>
      <Pager path={path} params={params} pageParam="ledger_page" page={page} total={loaded.data.total} />
    </>
  );
}

async function EventsBlock({ admin, id, page, path, params }: PagedBlockProps) {
  const loaded = await loadTenantEvents(admin, id, page);
  if (!loaded.ok) return <Unavailable />;
  return (
    <>
      <Table head={["Time", "Event", "Who", "Detail"]}>
        {loaded.data.rows.length === 0 && <EmptyRow columns={4} />}
        {loaded.data.rows.map((row) => (
          <tr key={row.id}>
            <td className={`${td} whitespace-nowrap`}>{formatDateTime(row.createdAt)}</td>
            <td className={td}>{row.name}</td>
            <td className={td}>{row.userEmail ?? "–"}</td>
            <td className={`${td} font-mono text-xs break-all`}>{formatDetail(row.detail)}</td>
          </tr>
        ))}
      </Table>
      <Pager path={path} params={params} pageParam="events_page" page={page} total={loaded.data.total} />
    </>
  );
}
