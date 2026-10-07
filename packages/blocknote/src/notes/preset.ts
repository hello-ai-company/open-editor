import { createOpenEditorPowerPreset } from "../features/compose.js";
import type { OpenEditorPowerFeature } from "../features/types.js";
import { createDocumentWorkspaceFeature } from "../document/workspaceFeature.js";
import { createDocumentTypographyFeature } from "../document/typography.js";
import { copyLegacyNotesJson } from "../document/legacyNotes.js";
import { createPageRuntimeStore, createPageRuntimesFromStore } from "../workspace/pageRuntimeStore.js";
import { createDatabaseRuntimeStore, createDatabaseViewRuntimeFromStore } from "../workspace/databaseRuntimeStore.js";
import type { DatabaseViewConfigProvider } from "../workspace/databaseViewConfig.js";
import { createNotesWorkspaceController } from "./controller.js";
import type { NotesRecovery, NotesTarget, NotesWorkspaceConfig, NotesWorkspaceHost } from "./contracts.js";
import { createNotesDocumentWidgetsFeature, type NotesSharedBlockController } from "./documentWidgets.js";

export const DEFAULT_NOTES_WORKSPACE_CONFIG: NotesWorkspaceConfig = Object.freeze({
  version: 1, title: "Notes", navigation: Object.freeze(["tree", "library", "favorites", "recent", "trash"] as const),
  documentPanels: Object.freeze(["outline", "tasks", "media", "search", "comments", "history", "info"] as const),
  inspectorPanels: Object.freeze(["insert", "style", "info"] as const), defaultDocumentPanel: "outline", defaultInspectorPanel: "insert", theme: "system", density: "comfortable"
});
/** Strict bounded JSON presentation config; functions, host secrets and mutation grants are rejected. */
export function parseNotesWorkspaceConfig(value: unknown): NotesWorkspaceConfig {
  const config = copyLegacyNotesJson(value) as unknown as NotesWorkspaceConfig;
  if (!config || typeof config !== "object" || Array.isArray(config) || config.version !== 1 || Object.keys(config).some(key => !["version", "title", "navigation", "documentPanels", "inspectorPanels", "defaultDocumentPanel", "defaultInspectorPanel", "theme", "density", "locale", "navigationWidth", "inspectorWidth", "featureIds"].includes(key))) throw new Error("Invalid Notes workspace config");
  if (config.title !== undefined && (typeof config.title !== "string" || config.title.length > 256)) throw new Error("Invalid Notes workspace title");
  const arrays: readonly [unknown, readonly string[]][] = [[config.navigation, ["tree", "library", "favorites", "recent", "trash"]], [config.documentPanels, ["outline", "tasks", "media", "search", "comments", "history", "info"]], [config.inspectorPanels, ["insert", "style", "info"]]];
  for (const [value, allowed] of arrays) if (value !== undefined && (!Array.isArray(value) || value.length > allowed.length || new Set(value).size !== value.length || value.some(item => !allowed.includes(item)))) throw new Error("Invalid Notes workspace panels");
  if (config.defaultDocumentPanel !== undefined && !(config.documentPanels ?? DEFAULT_NOTES_WORKSPACE_CONFIG.documentPanels)!.includes(config.defaultDocumentPanel)) throw new Error("Default document panel unavailable");
  if (config.defaultInspectorPanel !== undefined && !(config.inspectorPanels ?? DEFAULT_NOTES_WORKSPACE_CONFIG.inspectorPanels)!.includes(config.defaultInspectorPanel)) throw new Error("Default inspector panel unavailable");
  if (config.theme !== undefined && !["light", "dark", "system"].includes(config.theme)) throw new Error("Invalid Notes theme");
  if (config.density !== undefined && !["comfortable", "compact"].includes(config.density)) throw new Error("Invalid Notes density");
  if (config.locale !== undefined && (typeof config.locale !== "string" || !config.locale || config.locale.length > 64)) throw new Error("Invalid Notes locale");
  for (const width of [config.navigationWidth, config.inspectorWidth]) if (width !== undefined && (typeof width !== "number" || !Number.isFinite(width) || width < 180 || width > 480)) throw new Error("Invalid Notes panel width");
  if (config.featureIds !== undefined && (!Array.isArray(config.featureIds) || config.featureIds.length > 100 || new Set(config.featureIds).size !== config.featureIds.length || config.featureIds.some(id => typeof id !== "string" || !id || id.length > 128))) throw new Error("Invalid Notes configured features");
  return config;
}

/** All stores, controllers and runtime closures belong to this preset instance.
 * Host owns authentication/storage/authorization. No application implementation is imported. */
export function createOpenEditorNotesPreset(options: {
  host: NotesWorkspaceHost; config?: NotesWorkspaceConfig;
  features?: readonly OpenEditorPowerFeature[];
  databaseViewConfig?: DatabaseViewConfigProvider;
  resolveSharedController?(sharedId: string): NotesSharedBlockController | undefined;
  /** Workspace shells route inline reference navigation through their pane/tab guards. */
  onNavigate?(target: NotesTarget): Promise<boolean>;
  timeoutMs?: number; recovery?: NotesRecovery;
}) {
  const config = parseNotesWorkspaceConfig(options.config ?? DEFAULT_NOTES_WORKSPACE_CONFIG);
  const controller = createNotesWorkspaceController(options.host, { timeoutMs: options.timeoutMs, recovery: options.recovery });
  const pageStore = createPageRuntimeStore({ getPage: options.host.providers?.pages?.getPage });
  const pageRuntimes = createPageRuntimesFromStore(pageStore, { onOpen: pageId => { const destination: NotesTarget = { kind: "page", pageId }; void Promise.resolve().then(() => options.onNavigate ? options.onNavigate(destination) : controller.open(destination)).catch(() => false); } });
  const databaseStore = createDatabaseRuntimeStore({ provider: options.host.providers?.database });
  const preset = createOpenEditorPowerPreset({
    features: [createDocumentWorkspaceFeature(), createDocumentTypographyFeature(), createNotesDocumentWidgetsFeature({ resolveSharedController: options.resolveSharedController }), ...(options.features ?? [])] as const,
    ...pageRuntimes,
    databaseViewRuntime: createDatabaseViewRuntimeFromStore(databaseStore, options.host.providers?.database, options.databaseViewConfig)
  });
  if (config.featureIds?.some(id => !preset.featureIds.includes(id))) throw new Error("Configured Notes feature is not installed");
  return { ...preset, config, host: options.host, controller, pageStore, databaseStore, dispose: () => { controller.dispose(); pageStore.invalidate(); } };
}
