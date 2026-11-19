import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { getAdminState } from "@/db/admin";
import { Nav } from "../_components/nav";
import { NoAccess } from "../_components/no-access";
import { Loading } from "../_components/ui";

// Everything under here is for platform admins. The check happens before the
// page below is rendered at all: `children` is only returned for an admin, so
// a signed-in person who is not one never causes a page to run. Pages and data
// functions check again through `requireAdmin()`.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<Loading />}>
      <Gate>{children}</Gate>
    </Suspense>
  );
}

async function Gate({ children }: { children: ReactNode }) {
  const state = await getAdminState();
  if (state.kind === "signed-out") redirect("/sign-in");
  if (state.kind === "not-admin") return <NoAccess email={state.email} />;
  return (
    <>
      <Nav email={state.admin.email} />
      <main className="mx-auto max-w-7xl p-4">{children}</main>
    </>
  );
}
