/**
 * Gallery renderer — CSS grid cards over DatabaseRuntimeStore rows (4F-4B).
 * Media via host resolveRowMedia only — no fetch, no drag/reorder.
 */
import {
  useId,
  type KeyboardEvent,
  type ReactElement
} from "react";
import {
  buildDatabaseRowPresentation,
  cloneDatabaseRowRecord,
  safeResolveRowMedia
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
    viewType: "gallery"
  });
}

export function GalleryRenderer(
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

  return (
    <div
      className="oe-database-gallery"
      role="region"
      aria-label={`${title} gallery`}
      data-oe-gallery=""
      data-busy={busy ? "true" : "false"}
      aria-busy={busy || undefined}
    >
      {snap.pagination.hasMore ? (
        <p className="oe-database-view__notice" role="status">
          Showing loaded rows only — gallery is not a full-database total.
        </p>
      ) : null}

      <ul className="oe-database-gallery__grid" id={`${baseId}-grid`}>
        {snap.items.map((item) => {
          const presentation = buildDatabaseRowPresentation(
            item,
            definitions,
            { maxPreviewFields: 3 }
          );
          const { title: cardTitle, secondaryText, previewFields } =
            presentation;

          // Defensive deep clone — never hand RuntimeStore live row refs to host.
          const media = safeResolveRowMedia(runtime, {
            databaseId: snap.databaseId,
            rowKey: item.rowKey,
            row: cloneDatabaseRowRecord(item.row),
            viewId,
            viewType: "gallery"
          });

          return (
            <li
              key={item.rowKey}
              className="oe-database-gallery__card"
              data-row-key={item.rowKey}
            >
              {media ? (
                <div className="oe-database-gallery__media">
                  <img src={media.src} alt={media.alt ?? cardTitle} />
                </div>
              ) : (
                <div
                  className="oe-database-gallery__media oe-database-gallery__media--placeholder"
                  aria-hidden="true"
                />
              )}
              {openable ? (
                <button
                  type="button"
                  className="oe-database-gallery__card-title"
                  aria-label={`Open row ${cardTitle}`}
                  onClick={() => openRow(ctx, item.rowKey)}
                  onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      openRow(ctx, item.rowKey);
                    }
                  }}
                >
                  {cardTitle}
                </button>
              ) : (
                <span className="oe-database-gallery__card-title">
                  {cardTitle}
                </span>
              )}
              {secondaryText ? (
                <p className="oe-database-gallery__secondary">{secondaryText}</p>
              ) : null}
              {previewFields.length > 0 ? (
                <ul
                  className="oe-database-gallery__chips"
                  aria-label={`Properties for ${cardTitle}`}
                >
                  {previewFields.map(({ def, text }) => (
                    <li key={def.id} className="oe-database-gallery__chip">
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

/** Default gallery entry for the renderer map (component, not a bare call). */
export const renderGalleryView = GalleryRenderer;
