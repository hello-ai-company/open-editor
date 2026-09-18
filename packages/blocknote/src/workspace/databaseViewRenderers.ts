/**
 * Database view renderer contract + default dispatch (Phase 4F-4A).
 *
 * Runtime/preset owns optional renderer overrides — never a module-global registry.
 */
import type { ReactElement } from "react";
import type { DatabaseRuntimeStore, DatabaseViewSnapshot } from "./databaseRuntimeStore.js";
import type { ResolvedPropertyDefinition } from "./databaseProperty.js";
import type { DatabaseViewType } from "./types.js";
import type { DatabaseViewRuntime } from "./databaseViewRuntime.js";

export type DatabaseRowOpenRequest = {
  databaseId: string;
  rowKey: string;
  viewId: string;
  viewType: DatabaseViewType;
};

export type DatabaseViewRendererContext = {
  snapshot: DatabaseViewSnapshot;
  store: DatabaseRuntimeStore;
  viewKey: string;
  viewId: string;
  viewType: DatabaseViewType;
  title: string;
  definitions: readonly ResolvedPropertyDefinition[];
  mutationsAllowed: boolean;
  busy: boolean;
  runtime: DatabaseViewRuntime;
};

export type DatabaseViewRenderer = (
  context: DatabaseViewRendererContext
) => ReactElement;

export type DatabaseViewRendererMap = Partial<
  Record<DatabaseViewType, DatabaseViewRenderer>
>;

const DEFERRED_VIEWS = new Set<DatabaseViewType>([
  "timeline",
  "gantt",
  "list",
  "gallery",
  "chart",
  "feed",
  "map",
  "dashboard"
]);

export function isDeferredDatabaseViewType(
  viewType: string
): boolean {
  return DEFERRED_VIEWS.has(viewType as DatabaseViewType);
}

/**
 * Resolve which renderer to use for a viewType.
 * Host override wins for that runtime instance only.
 */
export function resolveDatabaseViewRenderer(input: {
  viewType: string;
  runtime: DatabaseViewRuntime;
  defaults: DatabaseViewRendererMap;
}): DatabaseViewRenderer | null {
  const vt = input.viewType as DatabaseViewType;
  const override = input.runtime.renderers?.[vt];
  if (override) return override;
  const def = input.defaults[vt];
  if (def) return def;
  return null;
}
