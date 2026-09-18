import { createReactBlockSpec } from "@blocknote/react";
import type {
  DatabaseProvider,
  DatabaseRowsPage,
  EditorDatabase
} from "@hello-ai-company/editor-core";
import { useEffect, useState, type ReactElement } from "react";
import {
  DATABASE_VIEW_TYPE,
  DATABASE_VIEW_TYPES,
  type DatabaseViewType
} from "./types.js";

export type DatabaseViewRuntime = {
  database?: DatabaseProvider;
  getTitle?: (databaseId: string) => string | undefined;
};

function DatabaseViewRender(props: {
  runtime: DatabaseViewRuntime;
  block: {
    props: {
      databaseId: string;
      viewId: string;
      viewType: string;
      titleHint: string;
    };
  };
}): ReactElement {
  const { runtime } = props;
  const { databaseId, viewId, viewType, titleHint } = props.block.props;
  const [meta, setMeta] = useState<EditorDatabase | null>(null);
  const [page, setPage] = useState<DatabaseRowsPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const provider = runtime.database;
    const listRows = provider?.listRows;
    if (!databaseId || !listRows) {
      setPage(null);
      setMeta(null);
      return;
    }
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const [rowsPage, db] = await Promise.all([
          listRows(databaseId, { limit: 50 }),
          provider?.getDatabase?.(databaseId) ?? Promise.resolve(null)
        ]);
        if (cancelled) return;
        setPage(rowsPage);
        setMeta(db);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load rows");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [databaseId, runtime, viewId, viewType]);

  const title =
    meta?.title ||
    runtime.getTitle?.(databaseId) ||
    titleHint ||
    databaseId ||
    "Database";

  const items = page?.items ?? [];
  const schemaKeys = page ? Object.keys(page.schema) : [];

  return (
    <section
      className="oe-database-view"
      data-oe-database-view={databaseId}
      data-view-id={viewId}
      data-view-type={viewType}
      aria-label={`${title} (${viewType})`}
    >
      <header className="oe-database-view__header">
        <h3 className="oe-database-view__title">{title}</h3>
        <span className="oe-database-view__meta">
          {viewType}
          {viewId ? ` · ${viewId}` : ""}
        </span>
      </header>
      {!runtime.database?.listRows ? (
        <p className="oe-database-view__empty">Database provider unavailable</p>
      ) : loading ? (
        <p className="oe-database-view__empty">Loading…</p>
      ) : error ? (
        <p className="oe-database-view__empty">{error}</p>
      ) : items.length === 0 ? (
        <p className="oe-database-view__empty">No rows</p>
      ) : (
        <div className="oe-database-view__table-wrap" role="region">
          <table className="oe-database-view__table">
            <thead>
              <tr>
                <th scope="col">Key</th>
                {schemaKeys.map((key) => (
                  <th key={key} scope="col">
                    {key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.rowKey}>
                  <td>{item.rowKey}</td>
                  {schemaKeys.map((key) => (
                    <td key={key}>{String(item.row[key] ?? "")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="oe-database-view__footnote">
        Document stores databaseId/viewId/viewType only — rows come from the
        host provider.
      </p>
    </section>
  );
}

/**
 * Database view block — identity + view config only.
 * Runtime (provider) is captured by closure — never module-global.
 */
export function createDatabaseViewBlockSpec(
  runtime: DatabaseViewRuntime = {}
) {
  return createReactBlockSpec(
    {
      type: DATABASE_VIEW_TYPE,
      propSchema: {
        databaseId: { default: "" as const },
        viewId: { default: "main" as const },
        viewType: {
          default: "table" as const,
          values: [...DATABASE_VIEW_TYPES]
        },
        titleHint: { default: "" as const }
      },
      content: "none" as const
    },
    {
      render: (props): ReactElement => (
        <DatabaseViewRender runtime={runtime} block={props.block} />
      )
    }
  )();
}

export type { DatabaseViewType };
