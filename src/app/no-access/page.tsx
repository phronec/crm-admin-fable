import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getAdminState } from "@/db/admin";
import { NoAccess } from "../_components/no-access";

export const metadata: Metadata = { title: "No access" };

export default function NoAccessPage() {
  return (
    <Suspense fallback={null}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const state = await getAdminState();
  if (state.kind === "signed-out") redirect("/sign-in");
  if (state.kind === "admin") redirect("/");
  return <NoAccess email={state.email} />;
}
