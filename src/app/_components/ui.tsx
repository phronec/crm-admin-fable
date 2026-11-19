import Link from "next/link";
import type { ReactNode } from "react";
import { formatNumber, percentOf } from "@/core/format";
import { summarisePage } from "@/core/paging";
import { href } from "@/core/query";

export const td = "px-3 py-2 align-top";
export const tdNumber = "px-3 py-2 text-right align-top tabular-nums";

export function PageTitle({ children }: { children: ReactNode }) {
  return <h1 className="mb-5 text-2xl font-semibold">{children}</h1>;
}

export function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="mb-2 text-lg font-semibold">{title}</h2>
      {note && <p className="mb-2 text-slate-600">{note}</p>}
      {children}
    </section>
  );
}

/** What a block shows while its database table has not been created yet. */
export function Unavailable() {
  return (
    <p className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-slate-600">
      This data is not available yet.
    </p>
  );
}

export function Loading() {
  return <p className="text-slate-500">Loading…</p>;
}

export function Notice({ children }: { children: ReactNode }) {
  return <p className="mb-3 rounded-lg bg-blue-50 px-3 py-2 text-blue-950">{children}</p>;
}

export function Warning({ children }: { children: ReactNode }) {
  return <p className="mb-3 rounded-lg bg-orange-100 px-3 py-2 text-orange-950">{children}</p>;
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-left">
        <thead className="border-b border-slate-200 bg-slate-100 text-slate-600">
          <tr>
            {head.map((label) => (
              <th key={label} className="px-3 py-2 font-medium whitespace-nowrap">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

export function EmptyRow({ columns }: { columns: number }) {
  return (
    <tr>
      <td colSpan={columns} className="px-3 py-4 text-center text-slate-500">
        Nothing to show.
      </td>
    </tr>
  );
}

/** A figure with a label, for the overview. */
export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="text-slate-600">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-slate-500">{hint}</div>}
    </div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{children}</div>;
}

/** A row of a simple bar chart: label, a bar scaled to `max`, and the number. */
export function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="w-44 shrink-0 truncate">{label}</div>
      <div className="h-3 grow rounded bg-slate-200" role="presentation">
        <div className="h-3 rounded bg-blue-600" style={{ width: `${percentOf(value, max)}%` }} />
      </div>
      <div className="w-16 shrink-0 text-right tabular-nums">{formatNumber(value)}</div>
    </div>
  );
}

const STATUS_TONE: Record<string, string> = {
  active: "bg-green-100 text-green-900",
  paid: "bg-green-100 text-green-900",
  trialing: "bg-blue-100 text-blue-900",
  pending: "bg-blue-100 text-blue-900",
  past_due: "bg-orange-100 text-orange-900",
  failed: "bg-red-100 text-red-900",
  canceled: "bg-slate-200 text-slate-800",
  refunded: "bg-slate-200 text-slate-800",
};

export function StatusBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-slate-400">–</span>;
  return (
    <span className={`rounded px-1.5 py-0.5 ${STATUS_TONE[value] ?? "bg-slate-100 text-slate-800"}`}>
      {value.replace("_", " ")}
    </span>
  );
}

/** Filter choices as links; the current one is bold. "All" clears the filter. */
export function FilterLinks({
  label,
  path,
  params,
  param,
  options,
}: {
  label: string;
  path: string;
  /** The other parameters of the page, kept when a choice is clicked. */
  params: Record<string, string | undefined>;
  param: string;
  options: readonly string[];
}) {
  const current = params[param];
  const link = (value: string | undefined, text: string) => (
    <Link
      key={text}
      href={href(path, { ...params, [param]: value, page: undefined })}
      className={value === current ? "font-semibold text-slate-900" : "text-blue-700 underline"}
    >
      {text}
    </Link>
  );
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="text-slate-600">{label}:</span>
      {link(undefined, "all")}
      {options.map((option) => link(option, option.replace("_", " ")))}
    </div>
  );
}

/** "Rows 1 to 50 of 120" with Previous and Next links that keep the filters. */
export function Pager({
  path,
  params,
  pageParam = "page",
  page,
  total,
}: {
  path: string;
  params: Record<string, string | undefined>;
  pageParam?: string;
  page: number;
  total: number;
}) {
  const summary = summarisePage(page, total);
  const to = (n: number) => href(path, { ...params, [pageParam]: n === 1 ? undefined : n });
  return (
    <nav className="mt-2 flex items-center gap-4 text-slate-600" aria-label="Pages">
      <span>
        {summary.total === 0
          ? "No rows"
          : summary.first === 0
            ? `Page ${page} is past the end (${formatNumber(total)} rows)`
            : `Rows ${formatNumber(summary.first)} to ${formatNumber(summary.last)} of ${formatNumber(total)}`}
      </span>
      {page > 1 && (
        <Link href={to(Math.min(page - 1, summary.pages))} className="text-blue-700 underline">
          Previous
        </Link>
      )}
      {page < summary.pages && (
        <Link href={to(page + 1)} className="text-blue-700 underline">
          Next
        </Link>
      )}
    </nav>
  );
}

export function Facts({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1">
      {items.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-slate-600">{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
