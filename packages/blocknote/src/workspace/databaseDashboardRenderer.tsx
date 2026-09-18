/**
 * Dashboard renderer — loaded-snapshot descriptive summary (4F-4E).
 * Read-only aggregates; no product BI heuristics; no row-open for counts.
 */
import {
  useEffect,
  useId,
  useState,
  type ReactElement
} from "react";
import {
  buildDashboardCategoricalSummary,
  buildDashboardDateSummary,
  buildDashboardNumericSummary,
  buildDashboardOverview,
  listDashboardCategoricalProperties,
  listDashboardDateProperties,
  listDashboardNumericProperties,
  resolveDashboardCategoricalProperty,
  resolveDashboardDateProperty,
  resolveDashboardNumericProperty
} from "./databaseDashboardModel.js";
import { formatDatabaseCellDisplay } from "./databaseProperty.js";
import type { DatabaseViewRendererContext } from "./databaseViewRenderers.js";

export function DashboardRenderer(
  ctx: DatabaseViewRendererContext
): ReactElement {
  const { snapshot: snap, definitions, busy, title } = ctx;
  const baseId = useId();

  const categoricalEligible = listDashboardCategoricalProperties(definitions);
  const numericEligible = listDashboardNumericProperties(definitions);
  const dateEligible = listDashboardDateProperties(definitions);

  const [categoricalId, setCategoricalId] = useState<string | null>(
    () => resolveDashboardCategoricalProperty(definitions, null)?.id ?? null
  );
  const [numericId, setNumericId] = useState<string | null>(
    () => resolveDashboardNumericProperty(definitions, null)?.id ?? null
  );
  const [dateId, setDateId] = useState<string | null>(
    () => resolveDashboardDateProperty(definitions, null)?.id ?? null
  );

  useEffect(() => {
    const next =
      resolveDashboardCategoricalProperty(definitions, categoricalId)?.id ??
      null;
    if (next !== categoricalId) setCategoricalId(next);
  }, [definitions, categoricalId]);

  useEffect(() => {
    const next =
      resolveDashboardNumericProperty(definitions, numericId)?.id ?? null;
    if (next !== numericId) setNumericId(next);
  }, [definitions, numericId]);

  useEffect(() => {
    const next =
      resolveDashboardDateProperty(definitions, dateId)?.id ?? null;
    if (next !== dateId) setDateId(next);
  }, [definitions, dateId]);

  const categorical = resolveDashboardCategoricalProperty(
    definitions,
    categoricalId
  );
  const numeric = resolveDashboardNumericProperty(definitions, numericId);
  const dateProperty = resolveDashboardDateProperty(definitions, dateId);

  const overview = buildDashboardOverview({
    items: snap.items,
    definitions
  });

  return (
    <div
      className="oe-database-dashboard"
      role="region"
      aria-label={`${title} dashboard`}
      data-oe-dashboard=""
      data-busy={busy ? "true" : "false"}
      aria-busy={busy || undefined}
    >
      {snap.pagination.hasMore ? (
        <p className="oe-database-view__notice" role="status">
          Showing loaded rows only — metrics do not represent full database.
        </p>
      ) : null}

      <section
        className="oe-database-dashboard__overview"
        aria-labelledby={`${baseId}-overview`}
      >
        <h4 id={`${baseId}-overview`} className="oe-database-dashboard__heading">
          Overview
        </h4>
        <dl className="oe-database-dashboard__metrics">
          <div>
            <dt>Loaded rows</dt>
            <dd data-oe-dashboard-loaded-rows="">{overview.loadedRowCount}</dd>
          </div>
          <div>
            <dt>Properties</dt>
            <dd data-oe-dashboard-property-count="">
              {overview.propertyDefinitionCount}
            </dd>
          </div>
        </dl>
      </section>

      <div
        className="oe-database-dashboard__controls"
        role="toolbar"
        aria-label="Dashboard property selectors"
      >
        {categoricalEligible.length > 0 ? (
          <label>
            <span>Categorical</span>
            <select
              aria-label="Dashboard categorical property"
              value={categorical?.id ?? ""}
              onChange={(event) => setCategoricalId(event.target.value)}
            >
              {categoricalEligible.map((def) => (
                <option key={def.id} value={def.id}>
                  {def.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {numericEligible.length > 0 ? (
          <label>
            <span>Numeric</span>
            <select
              aria-label="Dashboard numeric property"
              value={numeric?.id ?? ""}
              onChange={(event) => setNumericId(event.target.value)}
            >
              {numericEligible.map((def) => (
                <option key={def.id} value={def.id}>
                  {def.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {dateEligible.length > 0 ? (
          <label>
            <span>Date</span>
            <select
              aria-label="Dashboard date property"
              value={dateProperty?.id ?? ""}
              onChange={(event) => setDateId(event.target.value)}
            >
              {dateEligible.map((def) => (
                <option key={def.id} value={def.id}>
                  {def.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {categorical ? (
        <section
          className="oe-database-dashboard__categorical"
          aria-labelledby={`${baseId}-cat`}
        >
          <h4 id={`${baseId}-cat`} className="oe-database-dashboard__heading">
            {categorical.name}
          </h4>
          <ul
            className="oe-database-dashboard__buckets"
            aria-label={`${categorical.name} distribution`}
          >
            {buildDashboardCategoricalSummary({
              items: snap.items,
              metric: categorical
            }).buckets.map((bucket) => (
              <li
                key={bucket.keyEncode}
                className="oe-database-dashboard__bucket"
                data-category-key={bucket.keyEncode}
              >
                <span className="oe-database-dashboard__bucket-label">
                  {bucket.label}
                </span>
                <span className="oe-database-dashboard__bucket-count">
                  {bucket.count}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="oe-database-view__hint" role="status">
          Add a status or select property for categorical summary.
        </p>
      )}

      {numeric ? (
        <section
          className="oe-database-dashboard__numeric"
          aria-labelledby={`${baseId}-num`}
        >
          <h4 id={`${baseId}-num`} className="oe-database-dashboard__heading">
            {numeric.name}
          </h4>
          <NumericBody items={snap.items} metric={numeric} />
        </section>
      ) : (
        <p className="oe-database-view__hint" role="status">
          Add a number property for numeric summary.
        </p>
      )}

      {dateProperty ? (
        <section
          className="oe-database-dashboard__date"
          aria-labelledby={`${baseId}-date`}
        >
          <h4 id={`${baseId}-date`} className="oe-database-dashboard__heading">
            {dateProperty.name}
          </h4>
          <DateBody items={snap.items} dateProperty={dateProperty} />
        </section>
      ) : (
        <p className="oe-database-view__hint" role="status">
          Add a date property for date summary.
        </p>
      )}
    </div>
  );
}

function NumericBody(input: {
  items: DatabaseViewRendererContext["snapshot"]["items"];
  metric: NonNullable<ReturnType<typeof resolveDashboardNumericProperty>>;
}): ReactElement {
  const summary = buildDashboardNumericSummary(input);
  const fmt = (n: number | null) =>
    n === null ? "—" : formatDatabaseCellDisplay(n, "number");

  return (
    <dl className="oe-database-dashboard__metrics" data-oe-dashboard-numeric="">
      <div>
        <dt>Finite values</dt>
        <dd>{summary.finiteCount}</dd>
      </div>
      <div>
        <dt>Skipped</dt>
        <dd>{summary.skippedCount}</dd>
      </div>
      <div>
        <dt>Sum</dt>
        <dd>{fmt(summary.finiteCount > 0 ? summary.sum : null)}</dd>
      </div>
      <div>
        <dt>Average</dt>
        <dd>{fmt(summary.average)}</dd>
      </div>
      <div>
        <dt>Min</dt>
        <dd>{fmt(summary.min)}</dd>
      </div>
      <div>
        <dt>Max</dt>
        <dd>{fmt(summary.max)}</dd>
      </div>
    </dl>
  );
}

function DateBody(input: {
  items: DatabaseViewRendererContext["snapshot"]["items"];
  dateProperty: NonNullable<ReturnType<typeof resolveDashboardDateProperty>>;
}): ReactElement {
  const summary = buildDashboardDateSummary(input);

  return (
    <dl className="oe-database-dashboard__metrics" data-oe-dashboard-date="">
      <div>
        <dt>Valid</dt>
        <dd>{summary.validCount}</dd>
      </div>
      <div>
        <dt>Missing</dt>
        <dd>{summary.missingCount}</dd>
      </div>
      <div>
        <dt>Invalid</dt>
        <dd>{summary.invalidCount}</dd>
      </div>
      <div>
        <dt>Earliest</dt>
        <dd>{summary.earliest ?? "—"}</dd>
      </div>
      <div>
        <dt>Latest</dt>
        <dd>{summary.latest ?? "—"}</dd>
      </div>
    </dl>
  );
}

/** Default dashboard entry for the renderer map (component, not a bare call). */
export const renderDashboardView = DashboardRenderer;
