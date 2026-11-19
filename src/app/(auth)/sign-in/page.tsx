import type { Metadata } from "next";
import { Suspense } from "react";
import { signIn } from "../actions";

export const metadata: Metadata = { title: "Sign in" };

// Fixed texts for the codes passed in the URL, so the page never echoes input.
const MESSAGES: Record<string, string> = {
  missing: "Enter your email and password.",
  invalid: "The email or password is not correct.",
};

export default function SignInPage(props: PageProps<"/sign-in">) {
  return (
    <Suspense fallback={<SignInCard message={null} />}>
      <SignIn searchParams={props.searchParams} />
    </Suspense>
  );
}

async function SignIn({ searchParams }: Pick<PageProps<"/sign-in">, "searchParams">) {
  const { m } = await searchParams;
  return <SignInCard message={typeof m === "string" ? (MESSAGES[m] ?? null) : null} />;
}

function SignInCard({ message }: { message: string | null }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-7">
        <h1 className="mb-1 text-xl font-semibold">Clevia admin</h1>
        <p className="mb-5 text-slate-600">Sign in with your Clevia account. Admins only.</p>
        {message && (
          <p role="alert" className="mb-4 rounded-lg bg-orange-100 px-3 py-2 text-orange-950">
            {message}
          </p>
        )}
        <form action={signIn} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="font-medium">Email</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="min-h-11 rounded-lg border border-slate-300 px-3"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-medium">Password</span>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="min-h-11 rounded-lg border border-slate-300 px-3"
            />
          </label>
          <button
            type="submit"
            className="min-h-11 rounded-lg bg-blue-700 px-4 font-semibold text-white hover:bg-blue-800"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
