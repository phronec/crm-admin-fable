import { signOut } from "../(auth)/actions";

/** Shown to a signed-in person who is not a platform admin. Shows no data. */
export function NoAccess({ email }: { email: string | null }) {
  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-2 text-xl font-semibold">You do not have access</h1>
      <p className="mb-5 text-slate-600">
        {email ? `${email} is signed in, but is` : "This account is"} not a Clevia platform admin.
      </p>
      <form action={signOut}>
        <button
          type="submit"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold hover:bg-slate-50"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
