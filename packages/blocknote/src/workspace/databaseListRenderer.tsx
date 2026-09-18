/**
 * List renderer — compact ordered rows over DatabaseRuntimeStore (4F-4B).
 * Read-only presentation: no reorderRows, no mutations, no completion checkbox.
 */
import {
  useId,
  type KeyboardEvent,
  type ReactElement
} from "react";
import { buildDatabaseRowPresentation } from "./databaseRowPresentation.js";
import type { DatabaseViewRendererContext } from "./databaseViewRenderers.js";

function openRow(
  ctx: DatabaseViewRendererContext,
  rowKey: string
): void {
  const onOpen = ctx.runtime.onOpenRow;
  if (!onOpen) return;
  onOpen({
    databaseId: ctx.snapshot.databaseId,
    rowKey,
    viewId: ctx.viewId,
    viewType: "list"
  });
}

export function ListRenderer(
  ctx: DatabaseViewRendererContext
): ReactElement {
  const {
    snapshot: snap,
    definitions,
    busy,
    title
  } = ctx;
  const baseId = useId();
  const openable = Boolean(ctx.runtime.onOpenRow);

  return (
    <div
      className="oe-database-list"
      role="region"
      aria-label={`${title} list`}
      data-oe-list=""
      data-busy={busy ? "true" : "false"}
      aria-busy={busy || undefined}
    >
      {snap.pagination.hasMore ? (
        <p className="oe-database-view__notice" role="status">
          Showing loaded rows only — list is not a full-database total.
        </p>
      ) : null}

      <ul className="oe-database-list__rows" id={`${baseId}-rows`}>
        {snap.items.map((item) => {
          const presentation = buildDatabaseRowPresentation(
            item,
            definitions,
            { maxPreviewFields: 5 }
          );
          const { title: rowTitle, secondaryText, previewFields } =
            presentation;

          return (
            <li
              key={item.rowKey}
              className="oe-database-list__row"
              data-row-key={item.rowKey}
            >
              {openable ? (
                <button
                  type="button"
                  className="oe-database-list__row-title"
                  aria-label={`Open row ${rowTitle}`}
                  onClick={() => openRow(ctx, item.rowKey)}
                  onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      openRow(ctx, item.rowKey);
                    }
                  }}
                >
                  {rowTitle}
                </button>
              ) : (
                <span className="oe-database-list__row-title">{rowTitle}</span>
              )}
              {secondaryText ? (
                <p className="oe-database-list__secondary">{secondaryText}</p>
              ) : null}
              {previewFields.length > 0 ? (
                <ul
                  className="oe-database-list__chips"
                  aria-label={`Properties for ${rowTitle}`}
                >
                  {previewFields.map(({ def, text }) => (
                    <li key={def.id} className="oe-database-list__chip">
                      <span className="oe-sr-only">{def.name}: </span>
                      {text}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Default list entry for the renderer map (component, not a bare call). */
export const renderListView = ListRenderer;
