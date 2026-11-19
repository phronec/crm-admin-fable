"use client";

// Shows no details: the message of a server error can carry internals. The
// digest lets the owner find the entry in the server log.
export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="mb-2 text-xl font-semibold">Something went wrong</h1>
      <p className="mb-4 text-slate-600">
        The page could not be loaded. Look in the server log
        {error.digest ? ` for ${error.digest}` : ""}.
      </p>
      <button
        type="button"
        onClick={() => unstable_retry()}
        className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800"
      >
        Try again
      </button>
    </main>
  );
}
