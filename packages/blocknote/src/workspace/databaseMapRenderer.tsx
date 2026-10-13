/**
 * Map renderer — equirectangular pins + accessible companion list (4F-4E).
 * Host `resolveMapLocation` only — no SDK, tiles, geocoding, or mutations.
 */
import {
  useId, useEffect, useRef, useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactElement
} from "react";
import {
  buildMapRowPresentations, clusterMapPins,
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
  const plane = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement | null>(null);
  const [size, setSize] = useState({ width: 320, height: 160 });
  const [chosen, setChosen] = useState<readonly string[]>([]);
  useEffect(() => {
    const element = plane.current; if (!element) return;
    const measure = () => { const box = element.getBoundingClientRect(); if (box.width > 0 && box.height > 0) setSize(previous => previous.width === box.width && previous.height === box.height ? previous : { width: box.width, height: box.height }); };
    measure(); const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measure); observer?.observe(element);
    return () => observer?.disconnect();
  }, []);
  useEffect(() => setChosen([]), [snap.databaseId, viewId]);

  const rows = buildMapRowPresentations({
    items: snap.items,
    runtime,
    databaseId: snap.databaseId,
    viewId
  });

  const located = rows.filter((r) => r.status.kind === "located");
  const clusters = clusterMapPins(rows, size.width, size.height);
  const selected = rows.filter(row => chosen.includes(row.item.rowKey));
  const close = () => { setChosen([]); if (trigger.current?.isConnected) trigger.current.focus(); else plane.current?.focus(); };

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
        ref={plane} tabIndex={-1} role="group"
        aria-label={`${located.length} located ${located.length === 1 ? "pin" : "pins"} on map`}
      >
        {clusters.map(cluster => {
          const row = cluster.rows[0]!, grouped = cluster.rows.length > 1;
          const style = { left: `clamp(14px, ${cluster.projection.xPercent}%, calc(100% - 14px))`, top: `clamp(14px, ${cluster.projection.yPercent}%, calc(100% - 14px))` } as CSSProperties;
          const label = grouped ? `Show ${cluster.rows.length} nearby locations` : `Open row ${resolveDatabaseRowTitle(row.item, definitions)}`;
          if (grouped || openable) return <button key={row.item.rowKey} type="button" className="oe-database-map__pin" data-cluster-count={cluster.rows.length} data-row-key={row.item.rowKey} style={style} aria-label={label} aria-expanded={grouped ? cluster.rows.every(item => chosen.includes(item.item.rowKey)) : undefined} aria-controls={grouped ? `${baseId}-selected` : undefined} onClick={event => { if (grouped) { trigger.current = event.currentTarget; setChosen(cluster.rows.map(item => item.item.rowKey)); } else openRow(ctx, row.item.rowKey); }}>{grouped ? cluster.rows.length : null}</button>;
          return <span key={row.item.rowKey} className="oe-database-map__pin" style={style} data-row-key={row.item.rowKey} aria-hidden="true" />;
        })}
      </div>
      {selected.length ? <section className="oe-database-map__selection" id={`${baseId}-selected`} aria-label="Nearby locations" onKeyDown={event => { if (event.key === "Escape" && !event.nativeEvent.isComposing) { event.preventDefault(); close(); } }}><header><strong>{selected.length} nearby locations</strong><button type="button" onClick={close}>Close locations</button></header><ul>{selected.map(row => <li key={row.item.rowKey}>{openable ? <button type="button" onClick={() => openRow(ctx, row.item.rowKey)}>{resolveDatabaseRowTitle(row.item, definitions)}</button> : <strong>{resolveDatabaseRowTitle(row.item, definitions)}</strong>} <span>{locationStatusText(row)}</span></li>)}</ul></section> : null}

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
