import type { DatabaseProvider } from "@hello-ai-company/editor-core";

/** Legacy hosts expose schema on row pages, never in the opaque metadata bag.
 * Request one row solely for schema; discard rows, cursors and config entirely.
 */
export async function loadLegacyDatabaseSchema(
  provider: Pick<DatabaseProvider, "listRows"> | undefined,
  databaseId: string
): Promise<Record<string, string>> {
  if (!provider?.listRows) throw new Error("Legacy database schema is unavailable");
  const page = await provider.listRows(databaseId, { limit: 1 });
  if (page.databaseId !== databaseId || !page.schema || typeof page.schema !== "object" || Array.isArray(page.schema)) {
    throw new Error("Legacy database schema identity is invalid");
  }
  const entries = Object.entries(page.schema);
  if (entries.length > 1000 || entries.some(([id, type]) => !id || id.length > 256 || typeof type !== "string" || type.length > 256)) {
    throw new Error("Legacy database schema is invalid");
  }
  return Object.fromEntries(entries);
}
