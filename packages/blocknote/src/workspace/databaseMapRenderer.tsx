/**
 * Map renderer — equirectangular pins + accessible companion list (4F-4E).
 * Host `resolveMapLocation` only — no SDK, tiles, geocoding, or mutations.
 */
import {
  useId,
  type CSSProperties,
  type KeyboardEvent,
  type ReactElement
} from "react";
import {
  buildMapRowPresentations,
  type MapRowPresentation
} from "./databaseMapModel.js";
import { resolveDatabaseRowTitle } from "./databaseRowPresentation.js";
import type { DatabaseViewRendererContext } from "./databaseViewRenderers.js";

function openRow(ctx: DatabaseViewRendererContext, rowKey: string): void {
  const onOpen = ctx.runtime.onOpenRow;
  if (!onOpen) return;
  onOpen({
    databaseId: ctx.snapshot.databaseId,
    rowKey,
    viewId: ctx.viewId,
    viewType: "map"
  });
}

function locationStatusText(row: MapRowPresentation): string {
  if (row.status.kind === "located") {
    const loc = row.status.location;
    const label = loc.label?.trim() || loc.address?.trim();
    if (label) {
      return `${label} (${loc.latitude}, ${loc.longitude})`;
    }
    return `${loc.latitude}, ${loc.longitude}`;
  }
  if (row.status.kind === "invalid-location") {
    return "Invalid location";
  }
  return "No location";
}

export function MapRenderer(ctx: DatabaseViewRendererContext): ReactElement {
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

  const rows = buildMapRowPresentations({
    items: snap.items,
    runtime,
    databaseId: snap.databaseId,
    viewId
  });

  const located = rows.filter((r) => r.status.kind === "located");

  return (
    <div
      className="oe-database-map"
      role="region"
      aria-label={`${title} map`}
      data-oe-map=""
      data-busy={busy ? "true" : "false"}
      aria-busy={busy || undefined}
    >
      {snap.pagination.hasMore ? (
        <p className="oe-database-view__notice" role="status">
          Showing loaded rows only — map pins are for loaded rows, not the full
          database.
        </p>
      ) : null}

      <div
        className="oe-database-map__plane"
        id={`${baseId}-plane`}
        role="img"
        aria-label={`${located.length} located ${
          located.length === 1 ? "pin" : "pins"
        } on map`}
      >
        {located.map((row) => {
          const rowTitle = resolveDatabaseRowTitle(row.item, definitions);
          const style = {
            left: `${row.projection!.xPercent}%`,
            top: `${row.projection!.yPercent}%`
          } as CSSProperties;
          if (openable) {
            return (
              <button
                key={row.item.rowKey}
                type="button"
                className="oe-database-map__pin"
                style={style}
                data-row-key={row.item.rowKey}
                aria-label={`Open row ${rowTitle}`}
                onClick={() => openRow(ctx, row.item.rowKey)}
                onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    openRow(ctx, row.item.rowKey);
                  }
                }}
              />
            );
          }
          return (
            <span
              key={row.item.rowKey}
              className="oe-database-map__pin"
              style={style}
              data-row-key={row.item.rowKey}
              aria-hidden="true"
            />
          );
        })}
      </div>

      <ul
        className="oe-database-map__list"
        id={`${baseId}-list`}
        aria-label={`${title} locations`}
      >
        {rows.map((row) => {
          const rowTitle = resolveDatabaseRowTitle(row.item, definitions);
          const statusText = locationStatusText(row);
          return (
            <li
              key={row.item.rowKey}
              className="oe-database-map__list-item"
              data-row-key={row.item.rowKey}
              data-location-status={row.status.kind}
            >
              {openable ? (
                <button
                  type="button"
                  className="oe-database-map__list-title"
                  aria-label={`Open row ${rowTitle}`}
                  onClick={() => openRow(ctx, row.item.rowKey)}
                  onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      openRow(ctx, row.item.rowKey);
                    }
                  }}
                >
                  {rowTitle}
                </button>
              ) : (
                <span className="oe-database-map__list-title">{rowTitle}</span>
              )}
              <span
                className={`oe-database-map__list-status oe-database-map__list-status--${row.status.kind}`}
                role="status"
              >
                {statusText}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Default map entry for the renderer map (component, not a bare call). */
export const renderMapView = MapRenderer;
