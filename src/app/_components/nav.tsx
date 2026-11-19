import Link from "next/link";
import { signOut } from "../(auth)/actions";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/tenants", label: "Companies" },
  { href: "/payments", label: "Payments" },
  { href: "/tokens", label: "AI tokens" },
  { href: "/activity", label: "Activity" },
];

export function Nav({ email }: { email: string | null }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <span className="font-semibold">Clevia admin</span>
        <nav className="flex flex-wrap gap-4" aria-label="Main">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="text-blue-700 hover:underline">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-slate-600">
          {email && <span>{email}</span>}
          <form action={signOut}>
            <button type="submit" className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
