/**
 * Database view renderer contract + default dispatch (Phase 4F-4A / 4F-4B).
 *
 * Runtime/preset owns optional renderer overrides — never a module-global registry.
 * Renderers are React components (hooks-safe), not bare functions invoked by the shell.
 */
import type { ComponentType } from "react";
import type {
  DatabaseRuntimeStore,
  DatabaseViewSnapshot
} from "./databaseRuntimeStore.js";
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

/**
 * Host / default view body renderer.
 * Must be used as a React component (`<Renderer {...ctx} />`), never called as a plain function.
 */
export type DatabaseViewRenderer =
  ComponentType<DatabaseViewRendererContext>;

export type DatabaseViewRendererMap = Partial<
  Record<DatabaseViewType, DatabaseViewRenderer>
>;

/**
 * No current DatabaseViewType is deferred after Phase 4F-4E
 * (Table / Board / Calendar / List / Gallery / Timeline / Gantt / Chart / Feed / Map / Dashboard).
 * Kept for host forward-compat with unknown future view strings.
 */
const DEFERRED_VIEWS = new Set<DatabaseViewType>();

export function isDeferredDatabaseViewType(viewType: string): boolean {
  return DEFERRED_VIEWS.has(viewType as DatabaseViewType);
}

/**
 * Resolve which renderer component to use for a viewType.
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
