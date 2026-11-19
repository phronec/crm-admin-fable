import { daysBefore } from "@/core/dates";
import { MAIN_EVENTS, SUBSCRIPTION_STATUSES } from "@/core/query";
import {
  countActiveCompanies,
  summariseLedger,
  summarisePayments,
  type EventOrgRow,
  type LedgerRow,
  type PaymentRow,
  type PaymentSummary,
  type TokenSummary,
} from "@/core/stats";
import type { Admin } from "./admin";
import { check, countOf, loaded, rowsOf, scan, type Loaded } from "./result";

export interface Overview {
  companies: Loaded<{ total: number; new7: number; new30: number }>;
  active: Loaded<{ last7: number; last30: number; partial: boolean }>;
  subscriptions: Loaded<{
    byStatus: Array<{ status: string; count: number }>;
    byPlan: Array<{ plan: string; count: number }>;
  }>;
  payments: Loaded<{ summary: PaymentSummary; partial: boolean }>;
  tokens: Loaded<{ summary: TokenSummary; partial: boolean }>;
  events: Loaded<Array<{ name: string; count: number }>>;
}

/**
 * Every figure of the overview page. Each block is read on its own, so one
 * missing table leaves the rest of the page intact.
 */
export async function loadOverview(admin: Admin, now: Date): Promise<Overview> {
  const { db } = admin;
  const since7 = daysBefore(now, 7).toISOString();
  const since30 = daysBefore(now, 30).toISOString();

  const organizations = () => db.from("organizations").select("id", { count: "exact" });

  const [companies, active, subscriptions, payments, tokens, events] = await Promise.all([
    loaded(async () => {
      const [total, new7, new30] = await Promise.all([
        countOf(organizations()),
        countOf(organizations().gte("created_at", since7)),
        countOf(organizations().gte("created_at", since30)),
      ]);
      return { total, new7, new30 };
    }),

    // Distinct companies cannot be counted by the server without a database
    // function, so the company ids of the window are read (newest first, so
    // a cut-off drops the oldest events) and counted here.
    loaded(async () => {
      const { rows, truncated } = await scan<EventOrgRow>((from, to) =>
        db
          .from("events")
          .select("organization_id, created_at")
          .gte("created_at", since30)
          .not("organization_id", "is", null)
          .order("created_at", { ascending: false })
          .range(from, to),
      );
      return { ...countActiveCompanies(rows, now), partial: truncated };
    }),

    loaded(async () => {
      const plans = rowsOf<{ id: string; name: string }>(
        check(await db.from("plans").select("id, name").order("position")),
      );
      const [byStatus, byPlan] = await Promise.all([
        Promise.all(
          SUBSCRIPTION_STATUSES.map(async (status) => ({
            status,
            count: await countOf(
              db
                .from("subscriptions")
                .select("organization_id", { count: "exact" })
                .eq("status", status),
            ),
          })),
        ),
        Promise.all(
          plans.map(async (plan) => ({
            plan: plan.name,
            count: await countOf(
              db
                .from("subscriptions")
                .select("organization_id", { count: "exact" })
                .eq("plan_id", plan.id),
            ),
          })),
        ),
      ]);
      return { byStatus, byPlan };
    }),

    loaded(async () => {
      const { rows, truncated } = await scan<PaymentRow>((from, to) =>
        db
          .from("payments")
          .select("provider, status, amount_czk")
          .gte("created_at", since30)
          .order("created_at", { ascending: false })
          .range(from, to),
      );
      return { summary: summarisePayments(rows), partial: truncated };
    }),

    loaded(async () => {
      const { rows, truncated } = await scan<LedgerRow>((from, to) =>
        db
          .from("token_ledger")
          .select("reason, delta")
          .gte("created_at", since30)
          .order("created_at", { ascending: false })
          .range(from, to),
      );
      return { summary: summariseLedger(rows), partial: truncated };
    }),

    loaded(() =>
      Promise.all(
        MAIN_EVENTS.map(async (name) => ({
          name,
          count: await countOf(
            db
              .from("events")
              .select("id", { count: "exact" })
              .eq("name", name)
              .gte("created_at", since30),
          ),
        })),
      ),
    ),
  ]);

  return { companies, active, subscriptions, payments, tokens, events };
}
