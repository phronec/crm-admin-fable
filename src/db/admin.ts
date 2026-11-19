import "server-only";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { redactSecrets } from "@/core/errors";
import { createSessionClient, publicEnv } from "./supabase";

// This is the only file that knows the Supabase secret key. The key bypasses
// row-level security, so it can read every customer's data. Nothing outside
// this file can get a client that uses it, except through `requireAdmin()`,
// which hands one out only after the visitor has been checked.

/** The secret-key client. Not exported on purpose. */
function createSecretClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) {
    throw new Error("The admin app is not configured: SUPABASE_SECRET_KEY is missing.");
  }
  return createClient(publicEnv().url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export type AdminDb = ReturnType<typeof createSecretClient>;

/** A verified platform admin, and the means to read as one. */
export interface Admin {
  userId: string;
  email: string | null;
  db: AdminDb;
  /** Email of an auth user, looked up once per request. Null if there is none. */
  emailOf(userId: string): Promise<string | null>;
}

export type AdminState =
  | { kind: "signed-out" }
  | { kind: "not-admin"; email: string | null }
  | { kind: "admin"; admin: Admin };

function createAdmin(userId: string, email: string | null, db: AdminDb): Admin {
  const emails = new Map<string, Promise<string | null>>();
  return {
    userId,
    email,
    db,
    emailOf(id) {
      let found = emails.get(id);
      if (!found) {
        found = db.auth.admin
          .getUserById(id)
          .then(({ data }) => data.user?.email ?? null)
          .catch(() => null);
        emails.set(id, found);
      }
      return found;
    },
  };
}

/**
 * Who is asking, and are they an admin? The session is checked with the auth
 * server (not just read from the cookie), so a revoked session stops working
 * at once. Only after that is the secret key used, to look the person up in
 * `platform_admins`. If that lookup fails for any reason the answer is "not an
 * admin". Checked once per request however many components ask.
 */
export const getAdminState = cache(async (): Promise<AdminState> => {
  // The auth library reads the clock, which Next.js refuses while it renders a
  // page ahead of time. Declaring the page request-time first keeps that out.
  await connection();
  const session = await createSessionClient();
  const { data, error } = await session.auth.getUser();
  if (error || !data.user) return { kind: "signed-out" };
  const { id, email } = data.user;

  const db = createSecretClient();
  const { data: row, error: lookupError } = await db
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", id)
    .maybeSingle();
  if (lookupError) {
    console.error(
      "Admin check failed:",
      lookupError.code,
      redactSecrets(lookupError.message, [process.env.SUPABASE_SECRET_KEY]),
    );
    return { kind: "not-admin", email: email ?? null };
  }
  if (!row) return { kind: "not-admin", email: email ?? null };
  return { kind: "admin", admin: createAdmin(id, email ?? null, db) };
});

/**
 * Every page and every data function starts here. It returns the admin, or
 * leaves the page: to sign-in when nobody is signed in, to the "no access"
 * page when the person is not an admin.
 */
export async function requireAdmin(): Promise<Admin> {
  const state = await getAdminState();
  if (state.kind === "signed-out") redirect("/sign-in");
  if (state.kind === "not-admin") redirect("/no-access");
  return state.admin;
}
