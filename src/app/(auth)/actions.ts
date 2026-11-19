"use server";

import { redirect } from "next/navigation";
import { createSessionClient } from "@/db/supabase";

// Sign-in and sign-out are the only actions, and the only code that runs
// before `requireAdmin()` can pass: they use the publishable key and read no
// data. There is no sign-up: admins are people who already have an account
// and a row in `platform_admins`.

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) redirect("/sign-in?m=missing");

  const supabase = await createSessionClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/sign-in?m=invalid");
  redirect("/");
}

export async function signOut() {
  const supabase = await createSessionClient();
  // Only this browser: other devices of the same person stay signed in.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/sign-in");
}
