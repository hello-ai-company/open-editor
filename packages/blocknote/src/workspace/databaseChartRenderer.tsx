/**
 * Chart renderer — categorical (select/status) and numeric (number) over loaded rows (4F-4D).
 * Read-only presentation: no updateRow/reorderRows.
 */
import {
  useEffect,
  useId,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactElement
} from "react";
import {
  buildCategoricalChart,
  buildNumericChart,
  categoryKeyEncode,
  listChartMetricProperties,
  resolveChartMetricProperty
} from "./databaseChartModel.js";
import { formatDatabaseCellDisplay } from "./databaseProperty.js";
import { resolveDatabaseRowTitle } from "./databaseRowPresentation.js";
import type { DatabaseViewRendererContext } from "./databaseViewRenderers.js";

function openRow(ctx: DatabaseViewRendererContext, rowKey: string): void {
  const onOpen = ctx.runtime.onOpenRow;
  if (!onOpen) return;
  onOpen({
    databaseId: ctx.snapshot.databaseId,
    rowKey,
    viewId: ctx.viewId,
    viewType: "chart"
  });
}

export function ChartRenderer(
  ctx: DatabaseViewRendererContext
): ReactElement {
  const { snapshot: snap, definitions, busy, title, runtime } = ctx;
  const baseId = useId();
  const eligible = listChartMetricProperties(definitions);
  const [metricPropertyId, setMetricPropertyId] = useState<string | null>(
    () => resolveChartMetricProperty(definitions, null)?.id ?? null
  );

  useEffect(() => {
    const resolved = resolveChartMetricProperty(definitions, metricPropertyId);
    const nextId = resolved?.id ?? null;
    if (nextId !== metricPropertyId) {
      setMetricPropertyId(nextId);
    }
  }, [definitions, metricPropertyId]);

  const metric = resolveChartMetricProperty(definitions, metricPropertyId);
  const openable = Boolean(runtime.onOpenRow);

  if (eligible.length === 0) {
    return (
      <p className="oe-database-view__empty" role="status">
        Add a number, select, or status property to use Chart
      </p>
    );
  }

  const maxCategoricalCount =
    metric && metric.type !== "number"
      ? Math.max(
          1,
          ...buildCategoricalChart({ items: snap.items, metric }).buckets.map(
            (b) => b.count
          )
        )
      : 1;

  return (
    <div
      className="oe-database-chart"
      role="region"
      aria-label={`${title} chart`}
      data-oe-chart=""
      data-busy={busy ? "true" : "false"}
      aria-busy={busy || undefined}
    >
      <div className="oe-database-chart__controls">
        <label className="oe-database-chart__metric-select">
          <span>Metric</span>
          <select
            aria-label="Chart metric property"
            value={metric?.id ?? ""}
            onChange={(event) => setMetricPropertyId(event.target.value)}
          >
            {eligible.map((def) => (
              <option key={def.id} value={def.id}>
                {def.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {snap.pagination.hasMore ? (
        <p className="oe-database-view__notice" role="status">
          Showing loaded rows only — chart counts are for loaded rows, not the
          full database.
        </p>
      ) : null}

      {metric?.type === "number" ? (
        <NumericChartBody
          ctx={ctx}
          metric={metric}
          baseId={baseId}
          openable={openable}
        />
      ) : metric ? (
        <CategoricalChartBody
          metric={metric}
          items={snap.items}
          maxCount={maxCategoricalCount}
          baseId={baseId}
        />
      ) : null}
    </div>
  );
}

function CategoricalChartBody(input: {
  metric: NonNullable<ReturnType<typeof resolveChartMetricProperty>>;
  items: DatabaseViewRendererContext["snapshot"]["items"];
  maxCount: number;
  baseId: string;
}): ReactElement {
  const { metric, items, maxCount, baseId } = input;
  const { buckets } = buildCategoricalChart({ items, metric });

  return (
    <ul
      className="oe-database-chart__categories"
      id={`${baseId}-categories`}
      aria-label={`${metric.name} distribution`}
    >
      {buckets.map((bucket) => {
        const widthPercent =
          maxCount > 0 ? (bucket.count / maxCount) * 100 : 0;
        return (
          <li
            key={categoryKeyEncode(bucket.key)}
            className="oe-database-chart__category"
            data-category-key={categoryKeyEncode(bucket.key)}
          >
            <span className="oe-database-chart__category-label">
              {bucket.label}
            </span>
            <span className="oe-database-chart__category-count">
              {bucket.count}
            </span>
            <div
              className="oe-database-chart__category-track"
              aria-hidden="true"
            >
              <div
                className="oe-database-chart__category-bar"
                style={{ width: `${widthPercent}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function NumericChartBody(input: {
  ctx: DatabaseViewRendererContext;
  metric: NonNullable<ReturnType<typeof resolveChartMetricProperty>>;
  baseId: string;
  openable: boolean;
}): ReactElement {
  const { ctx, metric, baseId, openable } = input;
  const { definitions, snapshot: snap } = ctx;
  const chart = buildNumericChart({ items: snap.items, metric });

  return (
    <div className="oe-database-chart__numeric">
      {chart.skippedCount > 0 ? (
        <p className="oe-database-view__hint" role="status">
          {chart.skippedCount} loaded{" "}
          {chart.skippedCount === 1 ? "row" : "rows"} excluded (missing or
          non-numeric values).
        </p>
      ) : null}

      <div
        className="oe-database-chart__numeric-scale"
        aria-hidden="true"
        style={
          {
            "--oe-chart-zero": `${chart.zeroPercent}%`
          } as CSSProperties
        }
      >
        <div className="oe-database-chart__numeric-zero" />
      </div>

      <ul
        className="oe-database-chart__numeric-rows"
        id={`${baseId}-numeric`}
        aria-label={`${metric.name} values`}
      >
        {chart.entries.map((entry) => {
          const rowTitle = resolveDatabaseRowTitle(entry.item, definitions);
          const valueText = formatDatabaseCellDisplay(entry.value, "number");
          return (
            <li
              key={entry.item.rowKey}
              className="oe-database-chart__numeric-row"
              data-row-key={entry.item.rowKey}
              data-direction={entry.direction}
            >
              {openable ? (
                <button
                  type="button"
                  className="oe-database-chart__numeric-title"
                  aria-label={`Open row ${rowTitle}`}
                  onClick={() => openRow(ctx, entry.item.rowKey)}
                  onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      openRow(ctx, entry.item.rowKey);
                    }
                  }}
                >
                  {rowTitle}
                </button>
              ) : (
                <span className="oe-database-chart__numeric-title">
                  {rowTitle}
                </span>
              )}
              <span className="oe-database-chart__numeric-value">{valueText}</span>
              <div
                className="oe-database-chart__numeric-track"
                aria-hidden="true"
              >
                <div
                  className="oe-database-chart__numeric-bar"
                  style={{
                    left: `${entry.leftPercent}%`,
                    width: `${entry.widthPercent}%`
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Default chart entry for the renderer map (component, not a bare call). */
export const renderChartView = ChartRenderer;
