// The session cookie of this app. It has its own name, not the library's
// default `sb-<project>-auth-token`, because the customer app sets that
// default cookie on `.clevia.cz`, and the browser sends it to
// `admin.clevia.cz` too. With a different name, a customer's session is simply
// not a session here, and a sign-in here cannot clash with theirs.
//
// Every Supabase client of this app that reads or writes the session (the
// server client and the proxy) takes these options, so the name is used
// consistently. No `domain` is set, so the cookie stays on the host that set
// it. Nothing in the browser needs to read it, so it is HttpOnly.
export const SESSION_COOKIE_OPTIONS = {
  name: "clevia-admin-auth",
  path: "/",
  sameSite: "lax" as const,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
};
