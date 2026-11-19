import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const SIGN_IN = "/sign-in";

// Runs before every page. It refreshes the Supabase session and sends visitors
// who are not signed in to the sign-in page. That is a convenience only: it
// uses the publishable key and cannot tell whether someone is an admin. Every
// page and data read checks that again through `requireAdmin()`
// (src/db/admin.ts), so nothing depends on this file for safety.
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = typeof data?.claims?.sub === "string";
  const { pathname } = request.nextUrl;

  const redirectTo = (path: string) => {
    const destination = request.nextUrl.clone();
    destination.pathname = path;
    destination.search = "";
    const redirect = NextResponse.redirect(destination);
    // Keep any refreshed session cookies on the redirect.
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  if (!signedIn && pathname !== SIGN_IN) return redirectTo(SIGN_IN);
  if (signedIn && pathname === SIGN_IN) return redirectTo("/");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
