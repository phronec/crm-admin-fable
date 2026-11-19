// A stand-in for the parts of Supabase that the admin app calls, for trying
// the built app without a real project. It is a test tool and is not part of
// the app. It has no real security: it only pretends well enough to show that
// the app asks the right questions and uses the right key.
//
//   node scripts/standin-supabase.mjs serve [full|partial|empty]   (PORT, default 54321)
//   node scripts/standin-supabase.mjs cookie admin|member           prints a session cookie
//
// Scenarios:
//   full     every table exists and has data
//   partial  only platform_admins of the new tables exists (the others answer PGRST205)
//   empty    none of the new tables exists, not even platform_admins
//
// GET /__log returns the requests received, POST /__reset clears the log.
import { createServer } from "node:http";

const PORT = Number(process.env.PORT ?? 54321);
const SECRET = "sb_secret_test";
const PUBLISHABLE = "sb_publishable_test";
const COOKIE_NAME = "sb-127-auth-token"; // @supabase/ssr: "sb-" + first label of the host + "-auth-token"

const USERS = {
  admin: { id: "00000000-0000-4000-8000-0000000000a1", email: "admin@example.com" },
  member: { id: "00000000-0000-4000-8000-0000000000b2", email: "member@example.com" },
  owner1: { id: "00000000-0000-4000-8000-0000000000c1", email: "owner@signo.example" },
  owner2: { id: "00000000-0000-4000-8000-0000000000c2", email: "boss@horizon.example" },
  staff1: { id: "00000000-0000-4000-8000-0000000000c3", email: "agent@signo.example" },
};
const PASSWORD = "correct-password";

const b64url = (value) => Buffer.from(value).toString("base64url");
function makeSession(user) {
  const exp = Math.floor(Date.now() / 1000) + 86400;
  // An HS256 token without a key id: the client cannot check it itself and
  // asks the auth server (GET /auth/v1/user), as it does for a real project.
  const token = [
    b64url(JSON.stringify({ alg: "HS256", typ: "JWT" })),
    b64url(JSON.stringify({ sub: user.id, email: user.email, role: "authenticated", aud: "authenticated", exp })),
    b64url("not-a-real-signature"),
  ].join(".");
  return {
    access_token: token,
    refresh_token: "refresh-" + user.id,
    expires_in: 86400,
    expires_at: exp,
    token_type: "bearer",
    user: authUser(user),
  };
}
// What the auth server does with a bearer token: known user, our fixed
// "signature", not expired. Anything else is refused.
function userForToken(token) {
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || signature !== b64url("not-a-real-signature")) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (claims.exp * 1000 < Date.now()) return null;
    return Object.values(USERS).find((u) => u.id === claims.sub) ?? null;
  } catch {
    return null;
  }
}
const authUser = (u) => ({ id: u.id, aud: "authenticated", role: "authenticated", email: u.email, app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" });

// --- data -----------------------------------------------------------------
const ago = (days, hours = 0) => new Date(Date.now() - days * 86400000 - hours * 3600000).toISOString();
const ORG = {
  signo: "10000000-0000-4000-8000-000000000001",
  horizon: "10000000-0000-4000-8000-000000000002",
  quiet: "10000000-0000-4000-8000-000000000003",
};
const organizations = [
  { id: ORG.signo, name: "Signo Reality", slug: "signo", industry_template: "real_estate", language: "cs", currency: "CZK", visibility: "shared", created_at: ago(40) },
  { id: ORG.horizon, name: "Horizon Homes", slug: "horizon", industry_template: "generic", language: "sk", currency: "CZK", visibility: "private", created_at: ago(5) },
  { id: ORG.quiet, name: "Quiet Co", slug: "quiet", industry_template: "generic", language: "cs", currency: "CZK", visibility: "shared", created_at: ago(2) },
];
for (let i = 1; i <= 55; i++) {
  organizations.push({
    id: `20000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    name: `Bulk Company ${String(i).padStart(2, "0")}`,
    slug: `bulk-${String(i).padStart(2, "0")}`,
    industry_template: "generic", language: "cs", currency: "CZK", visibility: "shared",
    created_at: ago(100 + i),
  });
}
const memberships = [
  { id: "m1", organization_id: ORG.signo, user_id: USERS.owner1.id, role: "owner", status: "active", created_at: ago(40) },
  { id: "m2", organization_id: ORG.signo, user_id: USERS.staff1.id, role: "member", status: "active", created_at: ago(30) },
  { id: "m3", organization_id: ORG.signo, user_id: USERS.member.id, role: "member", status: "invited", created_at: ago(3) },
  { id: "m4", organization_id: ORG.horizon, user_id: USERS.owner2.id, role: "owner", status: "active", created_at: ago(5) },
  { id: "m5", organization_id: ORG.quiet, user_id: USERS.member.id, role: "owner", status: "active", created_at: ago(2) },
];
const deals = Array.from({ length: 7 }, (_, i) => ({ id: `d${i}`, organization_id: ORG.signo }));
deals.push({ id: "dh", organization_id: ORG.horizon });
const listings = [{ id: "l1", organization_id: ORG.signo }, { id: "l2", organization_id: ORG.signo }];
const sites = [
  { id: "s1", organization_id: ORG.signo, slug: "signo", published_at: ago(20), created_at: ago(30) },
  { id: "s2", organization_id: ORG.horizon, slug: "horizon", published_at: null, created_at: ago(4) },
];
const domains = [{ id: "dm1", organization_id: ORG.signo, hostname: "signo.cz", kind: "site", status: "active", created_at: ago(20), verified_at: ago(19) }];

const plans = [
  { id: "start", name: "Start", price_czk: 490, max_users: 3, monthly_tokens: 1000, trial_tokens: 300, position: 1, active: true },
  { id: "team", name: "Team", price_czk: 1290, max_users: 10, monthly_tokens: 5000, trial_tokens: 300, position: 2, active: true },
  { id: "business", name: "Business", price_czk: 2990, max_users: 30, monthly_tokens: 20000, trial_tokens: 300, position: 3, active: true },
];
const subscriptions = [
  { organization_id: ORG.signo, plan_id: "team", status: "active", trial_ends_at: ago(26), current_period_start: ago(3), current_period_end: ago(-27), created_at: ago(40), updated_at: ago(3) },
  { organization_id: ORG.horizon, plan_id: "start", status: "trialing", trial_ends_at: ago(-9), current_period_start: null, current_period_end: null, created_at: ago(5), updated_at: ago(5) },
  { organization_id: ORG.quiet, plan_id: "business", status: "past_due", trial_ends_at: ago(-12), current_period_start: null, current_period_end: null, created_at: ago(2), updated_at: ago(2) },
];
const organization_modules = ["crm", "website", "dashboard", "marketing"].map((module) => ({ organization_id: ORG.signo, module, enabled: module !== "marketing" }));
const token_balances = [
  { organization_id: ORG.signo, balance: 4850, updated_at: ago(1) },
  { organization_id: ORG.horizon, balance: 250, updated_at: ago(1) },
];
const token_ledger = [
  { id: 1, organization_id: ORG.signo, user_id: null, delta: 300, reason: "trial_grant", action_id: null, payment_id: null, balance_after: 300, created_at: ago(40) },
  { id: 2, organization_id: ORG.signo, user_id: USERS.owner1.id, delta: 5000, reason: "plan_grant", action_id: null, payment_id: "p1", balance_after: 5300, created_at: ago(3) },
  { id: 3, organization_id: ORG.signo, user_id: USERS.staff1.id, delta: -50, reason: "spend", action_id: "site.generate", payment_id: null, balance_after: 5250, created_at: ago(2) },
  { id: 4, organization_id: ORG.signo, user_id: USERS.staff1.id, delta: 50, reason: "adjustment", action_id: "site.generate", payment_id: null, balance_after: 5300, created_at: ago(2, -1) },
  { id: 5, organization_id: ORG.signo, user_id: USERS.owner1.id, delta: -450, reason: "spend", action_id: "site.redesign", payment_id: null, balance_after: 4850, created_at: ago(1) },
  { id: 6, organization_id: ORG.horizon, user_id: null, delta: 300, reason: "trial_grant", action_id: null, payment_id: null, balance_after: 300, created_at: ago(5) },
  { id: 7, organization_id: ORG.horizon, user_id: USERS.owner2.id, delta: -50, reason: "spend", action_id: "site.generate", payment_id: null, balance_after: 250, created_at: ago(40, 1) },
];
const payments = [
  { id: "p1", organization_id: ORG.signo, user_id: USERS.owner1.id, kind: "subscription", plan_id: "team", pack_id: null, amount_czk: 1290, currency: "CZK", status: "paid", provider: "placeholder", provider_reference: null, created_at: ago(3), paid_at: ago(3) },
  { id: "p2", organization_id: ORG.signo, user_id: USERS.owner1.id, kind: "tokens", plan_id: null, pack_id: "pack_1000", amount_czk: 190, currency: "CZK", status: "paid", provider: "placeholder", provider_reference: null, created_at: ago(2), paid_at: ago(2) },
  { id: "p3", organization_id: ORG.horizon, user_id: USERS.owner2.id, kind: "subscription", plan_id: "start", pack_id: null, amount_czk: 490, currency: "CZK", status: "paid", provider: "stripe", provider_reference: "pi_123", created_at: ago(1), paid_at: ago(1) },
  { id: "p4", organization_id: ORG.horizon, user_id: USERS.owner2.id, kind: "tokens", plan_id: null, pack_id: "pack_5000", amount_czk: 790, currency: "CZK", status: "failed", provider: "stripe", provider_reference: "pi_456", created_at: ago(1), paid_at: null },
  { id: "p5", organization_id: ORG.signo, user_id: USERS.owner1.id, kind: "tokens", plan_id: null, pack_id: "pack_1000", amount_czk: 190, currency: "CZK", status: "paid", provider: "placeholder", provider_reference: null, created_at: ago(60), paid_at: ago(60) },
];
const events = [];
let eventId = 0;
const addEvent = (org, user, name, createdAt, detail = {}) =>
  events.push({ id: ++eventId, created_at: createdAt, organization_id: org, user_id: user, name, detail });
addEvent(ORG.signo, USERS.owner1.id, "organization.created", ago(40));
addEvent(ORG.horizon, USERS.owner2.id, "organization.created", ago(5));
addEvent(ORG.quiet, USERS.member.id, "organization.created", ago(2));
addEvent(null, USERS.admin.id, "user.signed_in", ago(1), { method: "password" });
addEvent(ORG.horizon, USERS.owner2.id, "site.created", ago(4));
// Enough events for the signo timeline to need a second page, and a window
// that reaches past 30 days.
for (let i = 0; i < 130; i++) addEvent(ORG.signo, USERS.staff1.id, i % 3 === 0 ? "deal.created" : "user.signed_in", ago(0, i * 5), { n: i, method: "password" });
addEvent(ORG.signo, USERS.owner1.id, "site.published", ago(20));
addEvent(ORG.signo, USERS.owner1.id, "site.ai_generated", ago(45));
const platform_admins = [{ user_id: USERS.admin.id, created_at: ago(100) }];

const NEW_TABLES = ["plans", "token_packs", "ai_actions", "platform_settings", "subscriptions", "organization_modules", "token_balances", "token_ledger", "payments", "events", "platform_admins"];
const TABLES = { organizations, memberships, deals, listings, sites, domains, plans, subscriptions, organization_modules, token_balances, token_ledger, payments, events, platform_admins };

// --- a small PostgREST ------------------------------------------------------
const splitTop = (text) => {
  const parts = []; let depth = 0; let current = "";
  for (const ch of text) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { parts.push(current); current = ""; } else current += ch;
  }
  if (current) parts.push(current);
  return parts;
};
const listOf = (text) => splitTop(text.replace(/^\(|\)$/g, ""));
const likeToRegExp = (pattern) => new RegExp("^" + pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$", "i");

function test(row, column, spec) {
  const negate = spec.startsWith("not.");
  const body = negate ? spec.slice(4) : spec;
  const dot = body.indexOf(".");
  const op = body.slice(0, dot);
  const value = body.slice(dot + 1);
  const cell = row[column];
  let result;
  if (op === "eq") result = String(cell) === value;
  else if (op === "gte") result = cell !== null && cell >= value;
  else if (op === "lt") result = cell !== null && cell < value;
  else if (op === "in") result = listOf(value).includes(String(cell));
  else if (op === "is") result = value === "null" ? cell === null || cell === undefined : cell === (value === "true");
  else if (op === "ilike") result = likeToRegExp(value).test(String(cell ?? ""));
  else throw new Error("operator not supported: " + op);
  return negate ? !result : result;
}
function matches(row, params, prefix = "") {
  for (const [key, value] of params) {
    if (["select", "order", "limit", "offset", "or"].includes(key)) continue;
    if (prefix ? !key.startsWith(prefix + ".") : key.includes(".")) continue;
    if (!test(row, prefix ? key.slice(prefix.length + 1) : key, value)) return false;
  }
  return true;
}
function matchesOr(row, params) {
  const or = params.get("or");
  if (!or) return true;
  return listOf(or).some((condition) => {
    const [column, ...rest] = condition.split(".");
    return test(row, column, rest.join("."));
  });
}
function embed(row, spec, params) {
  const match = /^(\w+)\((.*)\)$/.exec(spec);
  const [, name, inner] = match;
  const rows = (TABLES[name] ?? []).filter((r) => r.organization_id === row.id && matches(r, params, name));
  if (inner === "count") return [name, [{ count: rows.length }]];
  const columns = inner.split(",").map((c) => c.trim());
  const pick = (r) => Object.fromEntries(columns.map((c) => [c, r[c]]));
  return [name, name === "sites" ? (rows[0] ? pick(rows[0]) : null) : rows.map(pick)];
}
function rest(table, params) {
  let rows = (TABLES[table] ?? []).filter((r) => matches(r, params) && matchesOr(r, params));
  const order = params.get("order");
  if (order) {
    const keys = order.split(",").map((o) => { const [column, dir] = o.split("."); return { column, sign: dir === "desc" ? -1 : 1 }; });
    rows = [...rows].sort((a, b) => {
      for (const { column, sign } of keys) {
        if (a[column] < b[column]) return -sign;
        if (a[column] > b[column]) return sign;
      }
      return 0;
    });
  }
  const total = rows.length;
  const offset = Number(params.get("offset") ?? 0);
  const limit = Math.min(Number(params.get("limit") ?? 1000), 1000); // the usual max-rows
  rows = rows.slice(offset, offset + limit);
  const select = params.get("select") ?? "*";
  const specs = splitTop(select).map((s) => s.trim());
  const out = rows.map((row) => {
    const result = {};
    for (const spec of specs) {
      if (spec === "*") Object.assign(result, row);
      else if (spec.includes("(")) { const [k, v] = embed(row, spec, params); result[k] = v; }
      else result[spec] = row[spec];
    }
    return result;
  });
  return { out, total, offset };
}

// --- server -----------------------------------------------------------------
function serve(scenario) {
  const missing = new Set(scenario === "full" ? [] : scenario === "partial" ? NEW_TABLES.filter((t) => t !== "platform_admins") : NEW_TABLES);
  const log = [];
  const send = (res, status, body, headers = {}) => {
    res.writeHead(status, { "content-type": "application/json", ...headers });
    res.end(body === undefined ? undefined : JSON.stringify(body));
  };
  const keyKind = (req) => {
    const key = req.headers.apikey;
    return key === SECRET ? "secret" : key === PUBLISHABLE ? "publishable" : "none";
  };
  createServer((req, res) => {
    const url = new URL(req.url, "http://standin");
    if (url.pathname === "/__log") return send(res, 200, log);
    if (url.pathname === "/__reset") { log.length = 0; return send(res, 200, {}); }
    log.push({ method: req.method, path: url.pathname + url.search, key: keyKind(req) });
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      const bearer = (req.headers.authorization ?? "").replace(/^Bearer /, "");

      if (url.pathname === "/auth/v1/user") {
        const user = userForToken(bearer);
        if (!user) return send(res, 401, { code: 401, error_code: "bad_jwt", msg: "invalid JWT" });
        return send(res, 200, authUser(user));
      }
      if (url.pathname.startsWith("/auth/v1/admin/users/")) {
        if (req.headers.apikey !== SECRET || bearer !== SECRET) return send(res, 401, { code: 401, msg: "not allowed" });
        const id = url.pathname.split("/").pop();
        const user = Object.values(USERS).find((u) => u.id === id);
        return user ? send(res, 200, authUser(user)) : send(res, 404, { code: 404, error_code: "user_not_found", msg: "User not found" });
      }
      if (url.pathname === "/auth/v1/token") {
        const { email, password } = JSON.parse(body || "{}");
        const user = Object.values(USERS).find((u) => u.email === email);
        if (!user || password !== PASSWORD) return send(res, 400, { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" });
        return send(res, 200, makeSession(user));
      }
      if (url.pathname === "/auth/v1/logout") return send(res, 204);

      const match = /^\/rest\/v1\/(\w+)$/.exec(url.pathname);
      if (match) {
        // Tenant data is for the secret key only, as row-level security would
        // refuse everything else.
        if (req.headers.apikey !== SECRET || bearer !== SECRET) return send(res, 401, { code: "42501", message: "permission denied" });
        const table = match[1];
        if (missing.has(table) || !TABLES[table]) {
          return send(res, 404, { code: "PGRST205", message: `Could not find the table 'public.${table}' in the schema cache`, hint: null, details: null });
        }
        const { out, total, offset } = rest(table, url.searchParams);
        const range = out.length === 0 ? `*/${total}` : `${offset}-${offset + out.length - 1}/${total}`;
        const headers = /count=/.test(req.headers.prefer ?? "") ? { "content-range": range } : {};
        if (req.method === "HEAD") { res.writeHead(200, headers); return res.end(); }
        if (/pgrst\.object/.test(req.headers.accept ?? "")) {
          return out.length === 1 ? send(res, 200, out[0], headers) : send(res, 406, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" });
        }
        return send(res, 200, out, headers);
      }
      send(res, 404, { message: "not found" });
    });
  }).listen(PORT, "127.0.0.1", () => console.log(`stand-in Supabase (${scenario}) on http://127.0.0.1:${PORT}`));
}

const [command, argument] = process.argv.slice(2);
if (command === "serve") serve(argument ?? "full");
else if (command === "cookie") {
  const user = USERS[argument];
  if (!user) throw new Error("who? admin or member");
  // Same shape @supabase/ssr stores: "base64-" and the session as base64url JSON.
  console.log(`${COOKIE_NAME}=base64-${b64url(JSON.stringify(makeSession(user)))}`);
} else {
  console.error("usage: standin-supabase.mjs serve [full|partial|empty] | cookie admin|member");
  process.exit(1);
}
