/**
 * Feed renderer — vertical article cards over DatabaseRuntimeStore rows (4F-4D).
 * Read-only presentation: preserves store order, no mutations, no drag/reorder.
 */
import {
  useEffect,
  useId,
  useState,
  type KeyboardEvent,
  type ReactElement
} from "react";
import {
  buildFeedItemPresentation,
  formatFeedDateMeta,
  listFeedDateProperties,
  resolveFeedDateProperty
} from "./databaseFeedModel.js";
import {
  cloneDatabaseRowRecord,
  safeResolveFeedRowMedia
} from "./databaseRowPresentation.js";
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
    viewType: "feed"
  });
}

export function FeedRenderer(
  ctx: DatabaseViewRendererContext
): ReactElement {
  const {
    snapshot: snap,
    definitions,
    busy,
    title,
    runtime,
    viewId
  } = ctx;
  const baseId = useId();
  const openable = Boolean(runtime.onOpenRow);

  const eligible = listFeedDateProperties(definitions);
  const [datePropertyId, setDatePropertyId] = useState<string | null>(
    () => resolveFeedDateProperty(definitions, null)?.id ?? null
  );

  useEffect(() => {
    const resolved = resolveFeedDateProperty(definitions, datePropertyId);
    const nextId = resolved?.id ?? null;
    if (nextId !== datePropertyId) {
      setDatePropertyId(nextId);
    }
  }, [definitions, datePropertyId]);

  const dateProperty = resolveFeedDateProperty(definitions, datePropertyId);

  return (
    <div
      className="oe-database-feed"
      role="region"
      aria-label={`${title} feed`}
      data-oe-feed=""
      data-busy={busy ? "true" : "false"}
      aria-busy={busy || undefined}
    >
      <div
        className="oe-database-feed__controls"
        role="toolbar"
        aria-label="Feed controls"
      >
        {eligible.length > 0 ? (
          <label>
            <span>Date property</span>
            <select
              aria-label="Feed date property"
              value={dateProperty?.id ?? ""}
              onChange={(event) => setDatePropertyId(event.target.value)}
            >
              {eligible.map((def) => (
                <option key={def.id} value={def.id}>
                  {def.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="oe-database-view__hint" role="status">
            Add a date property to show date metadata in Feed.
          </p>
        )}
      </div>

      {snap.pagination.hasMore ? (
        <p className="oe-database-view__notice" role="status">
          Showing loaded rows only — feed is not a full-database total.
        </p>
      ) : null}

      <div className="oe-database-feed__items" id={`${baseId}-items`}>
        {snap.items.map((item) => {
          const presentation = buildFeedItemPresentation(
            item,
            definitions,
            dateProperty?.id
          );
          const { title: itemTitle, secondaryText, previewFields } =
            presentation;

          const dateValue = dateProperty
            ? item.row[dateProperty.id]
            : undefined;
          const dateMeta = formatFeedDateMeta(dateValue);

          const media = safeResolveFeedRowMedia(runtime, {
            databaseId: snap.databaseId,
            rowKey: item.rowKey,
            row: cloneDatabaseRowRecord(item.row),
            viewId,
            viewType: "feed"
          });

          return (
            <article
              key={item.rowKey}
              className="oe-database-feed__item"
              data-row-key={item.rowKey}
            >
              {media ? (
                <div className="oe-database-feed__media">
                  <img src={media.src} alt={media.alt ?? itemTitle} />
                </div>
              ) : (
                <div
                  className="oe-database-feed__media oe-database-feed__media--placeholder"
                  aria-hidden="true"
                />
              )}
              <div className="oe-database-feed__body">
                {openable ? (
                  <button
                    type="button"
                    className="oe-database-feed__title"
                    aria-label={`Open row ${itemTitle}`}
                    onClick={() => openRow(ctx, item.rowKey)}
                    onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        openRow(ctx, item.rowKey);
                      }
                    }}
                  >
                    {itemTitle}
                  </button>
                ) : (
                  <h4 className="oe-database-feed__title">{itemTitle}</h4>
                )}
                {secondaryText ? (
                  <p className="oe-database-feed__secondary">{secondaryText}</p>
                ) : null}
                {dateProperty ? (
                  <p
                    className={`oe-database-feed__date oe-database-feed__date--${dateMeta.kind}`}
                    role="status"
                  >
                    {dateMeta.text}
                  </p>
                ) : null}
                {previewFields.length > 0 ? (
                  <ul
                    className="oe-database-feed__chips"
                    aria-label={`Properties for ${itemTitle}`}
                  >
                    {previewFields.map(({ def, text }) => (
                      <li key={def.id} className="oe-database-feed__chip">
                        <span className="oe-sr-only">{def.name}: </span>
                        {text}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

/** Default feed entry for the renderer map (component, not a bare call). */
export const renderFeedView = FeedRenderer;
