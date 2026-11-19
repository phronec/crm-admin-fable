# Clevia admin

The internal admin app for Clevia. The owner uses it to see every company that
registered, their subscriptions, payments, AI token use and activity. It is
read-only: it never writes tenant data.

It is a separate project from the customer app (`crm-fable`) on purpose. It
holds the one key that can read every customer's data, the Supabase secret key,
so that key lives only here and the customer app never sees it.

## Who can use it

Only people with a row in `platform_admins`. Sign-in is email and password
against the same Supabase project as the customer app; there is no
self-registration. Anyone else, signed in or not, gets no data: a signed-in
person who is not an admin sees "You do not have access" and a sign-out button.

### Make someone an admin

The person needs an account first (they sign up in the customer app, or you
invite them in the Supabase dashboard, with a password). Then, in the Supabase
SQL editor:

```sql
insert into public.platform_admins (user_id)
select id from auth.users where email = 'owner@example.com';
```

To remove access: `delete from public.platform_admins where user_id = '...';`.
The change takes effect on the next request.

`platform_admins` is created by the platform migration in `crm-fable`
(`20261120000000_platform.sql`). Until it is applied nobody can be an admin.

## Environment variables

| Variable | What |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL, the same as the customer app |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key, used for sign-in and for asking who is signed in |
| `SUPABASE_SECRET_KEY` | Secret key. Server only. Used to check `platform_admins` and to read data |

`cp .env.example .env.local` and fill them in.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run lint
npm run typecheck
npm test           # unit tests for src/core
npm run build
```

## Pages

| Address | Shows |
|---|---|
| `/` | Overview: companies in total and new in 7 and 30 days; companies active in 7 and 30 days; subscriptions by status and plan; payments of the last 30 days (real and test mode apart); AI tokens granted, bought and spent; counts of the main events |
| `/tenants` | One row per company. Search by name or address name, sort by created or last active, 50 per page |
| `/tenants/[id]` | One company in full: facts, subscription, modules, domains, members, payments, token ledger and event timeline, each newest first and paged |
| `/payments` | All payments; filter by status, kind and provider |
| `/tokens` | Totals and the token ledger of all companies; filter by reason |
| `/activity` | All events; filter by name and date range |

Dates and times are shown in UTC. Amounts are in CZK without VAT.

A block whose database table does not exist yet shows "This data is not
available yet" instead of failing.

## How it is built

| Path | What lives there | May import |
|---|---|---|
| `src/core` | Pure logic with unit tests: formatting, date ranges, paging, aggregation, error classification | Nothing from the other layers, and no Next.js or React (enforced by ESLint) |
| `src/db` | Data access. `admin.ts` is the only place that uses the secret key | `core` |
| `src/app` | Pages and the sign-in and sign-out actions | `core`, `db` |
| `src/proxy.ts` | Refreshes the session and sends signed-out visitors to sign-in | |
| `scripts` | Test tools, not part of the app (see below) | |

### The access rule

- `src/db/admin.ts` is the only module that creates the secret-key client
  (`import "server-only"`, so importing it from client code fails the build). The
  client is not exported. The only way to get one is `requireAdmin()`.
- `requireAdmin()` checks the session with the auth server, then looks the user
  up in `platform_admins` with the secret key. It returns an `Admin` that carries
  the client; every data function in `src/db` takes that `Admin`. Nothing can be
  read before the check has passed.
- The admin layout renders its pages only for an admin. Every page and data read
  calls `requireAdmin()` again (once per request, cached).
- The only server actions are sign-in and sign-out. They use the publishable key
  and read no data.
- If the `platform_admins` lookup fails for any reason, the answer is "not an
  admin".
- Errors shown to the user carry no database message. Messages that are logged
  have the secret key removed first.
- Every response carries `X-Robots-Tag: noindex` and the pages set `robots`
  noindex; `robots.txt` disallows everything.

### Limits worth knowing

PostgREST cannot sum or count distinct values without a database function, and
this version adds none to the database. So:

- Counts (companies, subscriptions, events, rows of a list) use the server's own
  count; no table is loaded to be counted.
- Sums over the last 30 days (payments, tokens) and the distinct companies
  active in 30 days read the rows of that window, at most 10,000 of them, newest
  first. If the window holds more, the page says the figure is partial.
- "Sort by last active" puts the 100 most recently active companies first (read
  from the newest events) and the rest by creation date.

## Try it without a Supabase project

`scripts/standin-supabase.mjs` is a small stand-in for the Supabase REST and
auth endpoints this app calls. `scripts/smoke.sh` runs a finished build against
it and checks: not signed in, signed in but not an admin, admin with data, admin
with the new tables missing.

```bash
npm run build
scripts/smoke.sh .        # needs python3 and curl; starts the app on :3111 and the stand-in on :54321
```

The stand-in is not a security test of Supabase; it only shows that this app
asks the right questions and uses the right key.

## Deploy as a second Vercel project

1. In Vercel, add a new project from the same GitHub repository as this one
   (`crm-admin-fable`), not from the customer app's repository. Framework:
   Next.js. Leave the build settings at their defaults.
2. Under Settings, Environment Variables, add `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` (the values
   of the customer app's project). Mark `SUPABASE_SECRET_KEY` as Sensitive and
   give it to Production only unless you need it in previews. Do not add the
   secret key to the customer app's Vercel project.
3. Under Settings, Domains, add `admin.clevia.cz` when it is ready (until then
   the `*.vercel.app` address works). Consider Vercel's deployment protection on
   preview deployments.
4. Under Authentication, URL Configuration in Supabase nothing needs to change:
   sign-in is by email and password, with no redirect.
5. Apply the platform migration from `crm-fable` and add the first admin (see
   above).

Cookies: on `admin.clevia.cz` the customer app's session cookie
(`domain=.clevia.cz`) is also sent to this app, so someone already signed in
there is signed in here too. They still need a row in `platform_admins`. Signing
out here clears only the cookie this app set.
