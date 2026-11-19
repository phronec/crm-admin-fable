#!/usr/bin/env bash
# Runs the built app against the stand-in Supabase (scripts/standin-supabase.mjs)
# and checks the four cases that matter: not signed in, signed in but not an
# admin, an admin with data, and an admin with the new tables missing.
#
# Usage: scripts/smoke.sh <dir of a finished `next build`>
# For example, after /home/claude/tools/build-check.sh: scripts/smoke.sh /tmp/buildcheck-crm-admin-fable
set -uo pipefail
APP_DIR="${1:?directory with a finished build}"
HERE="$(cd "$(dirname "$0")" && pwd)"
PORT_APP=3111
PORT_DB=54321
APP="http://127.0.0.1:$PORT_APP"
DB="http://127.0.0.1:$PORT_DB"
FAILED=0

text() { python3 -c '
import sys, re, html
t = sys.stdin.read()
t = re.sub(r"<script.*?</script>|<style.*?</style>", "", t, flags=re.S)
t = re.sub(r"<[^>]+>", " ", t)
print(re.sub(r"\s+", " ", html.unescape(t)))'; }
check() { # check "what" command...
  local what="$1"; shift
  if "$@" >/dev/null 2>&1; then echo "ok   $what"; else echo "FAIL $what"; FAILED=1; fi
}
page() { curl -s -H "Cookie: ${COOKIE:-}" "$APP$1" | text; }
contains() { page "$1" | grep -q -- "$2"; }
absent() { ! page "$1" | grep -q -- "$2"; }
rest_requests() { curl -s "$DB/__log" | python3 -c '
import json, sys
print("\n".join(sorted({e["method"] + " " + e["path"].split("?")[0] + " " + e["key"] for e in json.load(sys.stdin) if "/rest/" in e["path"]})))'; }

start_db() {
  pkill -f "standin-supabase.mjs serve" 2>/dev/null; sleep 0.5
  PORT=$PORT_DB node "$HERE/standin-supabase.mjs" serve "$1" >/dev/null 2>&1 &
  sleep 1
}

(cd "$APP_DIR" && NEXT_PUBLIC_SUPABASE_URL=$DB NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test \
  SUPABASE_SECRET_KEY=sb_secret_test NEXT_TELEMETRY_DISABLED=1 npx next start -p $PORT_APP >/dev/null 2>&1 &)
sleep 4
ADMIN="$(node "$HERE/standin-supabase.mjs" cookie admin)"
MEMBER="$(node "$HERE/standin-supabase.mjs" cookie member)"
CUSTOMER_ADMIN="$(node "$HERE/standin-supabase.mjs" cookie admin customer)"
SIGNO=10000000-0000-4000-8000-000000000001
PAGES=(/ /tenants /tenants/$SIGNO /payments /tokens /activity)

echo "== not signed in"
start_db full
for p in "${PAGES[@]}"; do
  check "$p redirects to /sign-in" bash -c "curl -s -o /dev/null -w '%{http_code} %{redirect_url}' $APP$p | grep -q '^307 .*/sign-in$'"
done
check "no request reached Supabase" bash -c "[ \"\$(curl -s $DB/__log)\" = '[]' ]"
check "X-Robots-Tag is sent" bash -c "curl -s -D - -o /dev/null $APP/sign-in | grep -qi '^x-robots-tag: noindex'"

echo "== signed in, not an admin"
curl -s "$DB/__reset" >/dev/null
for p in "${PAGES[@]}"; do
  COOKIE="$MEMBER" check "$p says no access and shows no data" bash -c "
    $(declare -f text page); APP=$APP COOKIE='$MEMBER'
    out=\$(page $p); echo \"\$out\" | grep -q 'You do not have access' && ! echo \"\$out\" | grep -q -E 'Signo Reality|Companies in total'"
done
check "only the platform_admins lookup used the secret key" bash -c "
  $(declare -f rest_requests); DB=$DB
  [ \"\$(rest_requests)\" = 'GET /rest/v1/platform_admins secret' ]"

echo "== admin, with data"
COOKIE="$ADMIN"
check "overview totals" contains / "Companies in total 58"
check "overview keeps test-mode payments apart" contains / "Test mode (placeholder, no money taken) 2 1 480"
check "companies list shows plan and owner" contains /tenants "owner@signo.example"
check "companies list pages on the server" contains /tenants "Rows 1 to 50 of 58"
check "company detail shows the ledger" contains /tenants/$SIGNO "site.redesign"
check "payments filter by provider" contains "/payments?provider=placeholder" "Rows 1 to 3 of 3"
check "tokens filter by reason" contains "/tokens?reason=spend" "Rows 1 to 3 of 3"
check "activity filter by name and day" contains "/activity?name=site.published" "Rows 1 to 1 of 1"
check "a filter value that is not allowed is ignored" contains "/payments?status=paid%27%20or%201=1" "Rows 1 to 5 of 5"
check "the secret key is not in any page" absent / "sb_secret_test"

echo "== a customer-app session cookie is not a session here"
curl -s "$DB/__reset" >/dev/null
for p in "${PAGES[@]}" /no-access; do
  check "$p treats the default-named cookie as signed out" bash -c "curl -s -o /dev/null -w '%{http_code} %{redirect_url}' -H 'Cookie: $CUSTOMER_ADMIN' $APP$p | grep -q '^307 .*/sign-in$'"
done
check "zero secret-key requests reached the stand-in" bash -c "
  curl -s $DB/__log | python3 -c 'import json,sys; sys.exit(1 if any(e[\"key\"] == \"secret\" for e in json.load(sys.stdin)) else 0)'"

echo "== sign-in and sign-out use only the admin cookie"
signin_headers=$(curl -s -o /dev/null -D - -H "Origin: $APP" \
  --form-string "$(curl -s $APP/sign-in | grep -o 'name="\$ACTION_ID_[A-Za-z0-9]*"' | head -1 | sed 's/name="//;s/"//')=" \
  --form-string email=admin@example.com --form-string password=correct-password $APP/sign-in | tr -d '\r')
check "sign-in redirects to /" bash -c "echo '$signin_headers' | grep -qi '^location: /\$'"
check "sign-in sets clevia-admin-auth and no other cookie" bash -c "
  [ \"\$(echo '$signin_headers' | grep -i '^set-cookie' | grep -vc '^[Ss]et-[Cc]ookie: clevia-admin-auth')\" = 0 ] && echo '$signin_headers' | grep -qi '^set-cookie: clevia-admin-auth'"
check "that cookie is HttpOnly, SameSite=Lax, Secure, host-only" bash -c "
  line=\$(echo '$signin_headers' | grep -i '^set-cookie: clevia-admin-auth' | head -1)
  echo \"\$line\" | grep -qi 'httponly' && echo \"\$line\" | grep -qi 'samesite=lax' && echo \"\$line\" | grep -qi 'secure' && ! echo \"\$line\" | grep -qi 'domain='"
SESSION=$(echo "$signin_headers" | grep -i '^set-cookie: clevia-admin-auth' | head -1 | sed 's/^[^:]*: //; s/;.*//')
COOKIE="$SESSION"
check "admin pages work with the cookie sign-in set" contains / "Companies in total 58"
signout_headers=$(curl -s -o /dev/null -D - -H "Cookie: $SESSION" -H "Origin: $APP" \
  --form-string "$(curl -s -H "Cookie: $SESSION" $APP/ | grep -o 'name="\$ACTION_ID_[A-Za-z0-9]*"' | head -1 | sed 's/name="//;s/"//')=" $APP/ | tr -d '\r')
check "sign-out clears clevia-admin-auth" bash -c "echo '$signout_headers' | grep -i '^set-cookie: clevia-admin-auth=;' | grep -qi 'max-age=0'"
check "sign-out redirects to /sign-in" bash -c "echo '$signout_headers' | grep -qi '^location: /sign-in'"

COOKIE="$ADMIN"
echo "== admin, new tables missing (platform_admins present)"
start_db partial
for p in /payments /tokens /activity; do
  check "$p shows the not-available state" contains "$p" "This data is not available yet"
done
check "overview still shows the companies" contains / "Companies in total 58"
check "companies list names the missing columns" contains /tenants "Not available yet, shown as a dash"

echo "== admin, platform_admins missing too"
start_db empty
check "nobody is an admin, so no access" contains /tenants "You do not have access"

pkill -f "standin-supabase.mjs serve"; pkill -f "next start"; pkill -f next-server
exit $FAILED
