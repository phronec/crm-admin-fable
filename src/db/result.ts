import { isMissingTable, redactSecrets } from "@/core/errors";

/** The data, or the news that the table has not been created yet. */
export type Loaded<T> = { ok: true; data: T } | { ok: false };

class MissingTableError extends Error {}

/** A database failure. The text never contains the library's own message. */
class DatabaseError extends Error {}

interface Failure {
  code?: string | null;
  message?: string | null;
}

/**
 * Passes a result through, or stops: a missing table becomes
 * `MissingTableError` (caught by `loaded`), anything else a `DatabaseError`
 * with only the code in its text. The full message is logged with the key
 * removed.
 */
export function check<T extends { error: Failure | null }>(result: T): T {
  const { error } = result;
  if (!error) return result;
  if (isMissingTable(error)) throw new MissingTableError();
  console.error(
    "Database request failed:",
    error.code,
    redactSecrets(error.message ?? "", [process.env.SUPABASE_SECRET_KEY]),
  );
  throw new DatabaseError(`Database request failed (${error.code ?? "unknown"}).`);
}

/** Rows of a checked result, typed by the caller. */
export function rowsOf<T>(result: { data: unknown }): T[] {
  return (result.data ?? []) as T[];
}

/** Runs the reads of one section; a missing table gives `{ ok: false }`. */
export async function loaded<T>(work: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { ok: true, data: await work() };
  } catch (error) {
    if (error instanceof MissingTableError) return { ok: false };
    throw error;
  }
}

// PostgREST returns at most 1000 rows per request by default.
const CHUNK = 1000;
/** The most rows a summary reads. Beyond it the result is marked as partial. */
export const SCAN_CAP = 10_000;

/**
 * Reads the rows of a bounded window (for example the last 30 days) in chunks
 * so they can be summed here: PostgREST cannot sum without an aggregate
 * function on the database. Never used to count a table; counts use the
 * server's own count.
 */
export async function scan<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown; error: Failure | null }>,
  cap = SCAN_CAP,
): Promise<{ rows: T[]; truncated: boolean }> {
  const rows: T[] = [];
  while (rows.length < cap) {
    const result = check(await page(rows.length, rows.length + CHUNK - 1));
    const chunk = rowsOf<T>(result);
    rows.push(...chunk);
    if (chunk.length < CHUNK) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}

/** The server-side count of a `{ count: "exact", head: true }` query. */
export async function countOf(
  query: PromiseLike<{ count: number | null; error: Failure | null }>,
): Promise<number> {
  return check(await query).count ?? 0;
}
