import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** The project address and the publishable key, which are safe to expose. */
export function publicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Copy .env.example to .env.local and fill in " +
        "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  return { url, key };
}

/**
 * Supabase client that acts as the signed-in person, through the session
 * cookies. It is used only for signing in and out and for asking the auth
 * server who the visitor is. It cannot read tenant data. Create a new one per
 * request.
 */
export async function createSessionClient() {
  const cookieStore = await cookies();
  const { url, key } = publicEnv();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server components cannot write cookies. The proxy refreshes the
          // session on every request, so this is safe to ignore here.
        }
      },
    },
  });
}
