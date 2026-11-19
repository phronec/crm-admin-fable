// Error handling that does not depend on the database client.

interface DbErrorLike {
  code?: string | null;
}

/**
 * True when the table (or view) does not exist. PostgREST reports it as
 * PGRST205 (not in its schema cache), Postgres itself as 42P01. Both mean the
 * platform migration has not been applied yet, which is a normal state for
 * this app, not a failure.
 */
export function isMissingTable(error: DbErrorLike | null | undefined): boolean {
  return error?.code === "PGRST205" || error?.code === "42P01";
}

/**
 * Removes every given secret from a text before it is logged or shown. The
 * app never puts the key in a message on purpose; this is the safety net for
 * messages that come from libraries.
 */
export function redactSecrets(text: string, secrets: Array<string | undefined>): string {
  let result = text;
  for (const secret of secrets) {
    if (secret) result = result.split(secret).join("[redacted]");
  }
  return result;
}
