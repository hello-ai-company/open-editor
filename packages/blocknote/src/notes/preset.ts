import { en, ja } from "@blocknote/core/locales";
import { createOpenEditorPowerPreset } from "../features/compose.js";
import type { OpenEditorPowerFeature } from "../features/types.js";
import { createDocumentWorkspaceFeature } from "../document/workspaceFeature.js";
import { createDocumentTypographyFeature } from "../document/typography.js";
import { copyLegacyNotesJson } from "../document/legacyNotes.js";
import { createPageRuntimeStore, createPageRuntimesFromStore } from "../workspace/pageRuntimeStore.js";
import { createDatabaseRuntimeStore, createDatabaseViewRuntimeFromStore } from "../workspace/databaseRuntimeStore.js";
import type { DatabaseViewConfigProvider } from "../workspace/databaseViewConfig.js";
import type { DatabaseViewRuntime } from "../workspace/databaseViewRuntime.js";
import { createNotesWorkspaceController } from "./controller.js";
import type { NotesRecovery, NotesTarget, NotesWorkspaceConfig, NotesWorkspaceHost } from "./contracts.js";
import { createNotesDocumentWidgetsFeature, type NotesSharedBlockController } from "./documentWidgets.js";
import type { NotesTableEditingRegistry } from "./tableEditing.js";

export const DEFAULT_NOTES_WORKSPACE_CONFIG: NotesWorkspaceConfig = Object.freeze({
  version: 1, title: "Notes", navigation: Object.freeze(["tree", "library", "favorites", "recent", "trash"] as const),
  documentPanels: Object.freeze(["outline", "tasks", "media", "search", "comments", "history", "info"] as const),
  inspectorPanels: Object.freeze(["insert", "style", "info"] as const), defaultDocumentPanel: "outline", defaultInspectorPanel: "insert", theme: "system", density: "comfortable"
});
/** Strict bounded JSON presentation config; functions, host secrets and mutation grants are rejected. */
export function parseNotesWorkspaceConfig(value: unknown): NotesWorkspaceConfig {
  const config = copyLegacyNotesJson(value) as unknown as NotesWorkspaceConfig;
  if (!config || typeof config !== "object" || Array.isArray(config) || config.version !== 1 || Object.keys(config).some(key => !["version", "title", "navigation", "documentPanels", "inspectorPanels", "defaultDocumentPanel", "defaultInspectorPanel", "theme", "appearance", "pageStyle", "density", "locale", "navigationWidth", "inspectorWidth", "featureIds"].includes(key))) throw new Error("Invalid Notes workspace config");
  if (config.title !== undefined && (typeof config.title !== "string" || config.title.length > 256)) throw new Error("Invalid Notes workspace title");
  const arrays: readonly [unknown, readonly string[]][] = [[config.navigation, ["tree", "library", "favorites", "recent", "trash"]], [config.documentPanels, ["outline", "tasks", "media", "search", "comments", "history", "info"]], [config.inspectorPanels, ["insert", "style", "info"]]];
  for (const [value, allowed] of arrays) if (value !== undefined && (!Array.isArray(value) || value.length > allowed.length || new Set(value).size !== value.length || value.some(item => !allowed.includes(item)))) throw new Error("Invalid Notes workspace panels");
  if (config.defaultDocumentPanel !== undefined && !(config.documentPanels ?? DEFAULT_NOTES_WORKSPACE_CONFIG.documentPanels)!.includes(config.defaultDocumentPanel)) throw new Error("Default document panel unavailable");
  if (config.defaultInspectorPanel !== undefined && !(config.inspectorPanels ?? DEFAULT_NOTES_WORKSPACE_CONFIG.inspectorPanels)!.includes(config.defaultInspectorPanel)) throw new Error("Default inspector panel unavailable");
  if (config.theme !== undefined && !["light", "dark", "system"].includes(config.theme)) throw new Error("Invalid Notes theme");
  if (config.appearance !== undefined && !["default", "classic"].includes(config.appearance)) throw new Error("Invalid Notes appearance");
  if (config.pageStyle !== undefined && !["clean", "editorial", "journal", "mono", "compact", "midnight", "paperback", "postcard", "studio", "blueprint", "gallery", "minimal"].includes(config.pageStyle)) throw new Error("Invalid Notes page style");
  if (config.density !== undefined && !["comfortable", "compact"].includes(config.density)) throw new Error("Invalid Notes density");
  if (config.locale !== undefined && (typeof config.locale !== "string" || !config.locale || config.locale.length > 64)) throw new Error("Invalid Notes locale");
  for (const width of [config.navigationWidth, config.inspectorWidth]) if (width !== undefined && (typeof width !== "number" || !Number.isFinite(width) || width < 180 || width > 480)) throw new Error("Invalid Notes panel width");
  if (config.featureIds !== undefined && (!Array.isArray(config.featureIds) || config.featureIds.length > 100 || new Set(config.featureIds).size !== config.featureIds.length || config.featureIds.some(id => typeof id !== "string" || !id || id.length > 128))) throw new Error("Invalid Notes configured features");
  return config;
}

/** All stores, controllers and runtime closures belong to this preset instance.
 * Host owns authentication/storage/authorization. No application implementation is imported. */
/** Native BlockNote locale; an explicit editorOptions dictionary takes precedence. */
export function notesEditorDictionary(locale?: string) { return !locale || locale.toLowerCase().startsWith("ja") ? ja : en; }

export function createOpenEditorNotesPreset(options: {
  host: NotesWorkspaceHost; config?: NotesWorkspaceConfig;
  /** Explicit host translations, passed to the public BlockNote constructor unchanged. */
  dictionary?: import("@blocknote/core").Dictionary;
  features?: readonly OpenEditorPowerFeature[];
  databaseViewConfig?: DatabaseViewConfigProvider;
  /** Borrowed, host-owned registry; use the same instance in all Split panes. */
  tableEditing?: NotesTableEditingRegistry;
  /** Authorized presentation projections only; row navigation always uses Notes guards. */
  databasePresentation?: Pick<DatabaseViewRuntime, "resolveRowMedia" | "resolveFeedRowMedia" | "resolveMapLocation" | "renderers">;
  resolveSharedController?(sharedId: string): NotesSharedBlockController | undefined;
  /** Workspace shells route inline reference navigation through their pane/tab guards. */
  onNavigate?(target: NotesTarget): Promise<boolean>;
  timeoutMs?: number; recovery?: NotesRecovery;
}) {
  const config = parseNotesWorkspaceConfig(options.config ?? DEFAULT_NOTES_WORKSPACE_CONFIG);
  const controller = createNotesWorkspaceController(options.host, { timeoutMs: options.timeoutMs, recovery: options.recovery, beforeOpen: options.tableEditing ? async (source, signal) => {
    if (!await options.tableEditing!.beforeLeave(source.target, signal)) return undefined;
    return options.tableEditing!.captureLeaveGuard(source.target);
  } : undefined });
  if (options.tableEditing && (options.tableEditing.scope.actorId !== options.host.scope.actorId || options.tableEditing.scope.workspaceId !== options.host.scope.workspaceId)) throw new Error("Table registry scope mismatch");
  if (options.tableEditing && (options.tableEditing.version !== 1 || typeof options.tableEditing.captureLeaveGuard !== "function" || typeof options.tableEditing.getGeneration !== "function")) throw new Error("Versioned table registry is required");
  const beforeTableLeave = async (signal: AbortSignal = new AbortController().signal): Promise<boolean> => {
    const source = controller.getState().snapshot;
    return !options.tableEditing || Boolean(source && await options.tableEditing.beforeLeave(source.target, signal));
  };
  const captureTableLeaveGuard = () => {
    if (!options.tableEditing) return () => true;
    const source = controller.getState().snapshot;
    if (!source) return () => false;
    const guarded = options.tableEditing.captureLeaveGuard(source.target);
    return () => {
      const current = controller.getState().snapshot;
      return guarded() && Boolean(current && JSON.stringify(current.scope) === JSON.stringify(source.scope) && JSON.stringify(current.target) === JSON.stringify(source.target));
    };
  };
  const pageStore = createPageRuntimeStore({ getPage: options.host.providers?.pages?.getPage });
  const pageRuntimes = createPageRuntimesFromStore(pageStore, { onOpen: pageId => { const destination: NotesTarget = { kind: "page", pageId }; const captured = controller.getState(); void Promise.resolve().then(async () => { if (!await beforeTableLeave() || controller.getState() !== captured) return false; return options.onNavigate ? options.onNavigate(destination) : controller.open(destination); }).catch(() => false); } });
  const databaseStore = createDatabaseRuntimeStore({ provider: options.host.providers?.database });
  const preset = createOpenEditorPowerPreset({
    features: [createDocumentWorkspaceFeature(), createDocumentTypographyFeature(), createNotesDocumentWidgetsFeature({ resolveSharedController: options.resolveSharedController }), ...(options.features ?? [])] as const,
    ...pageRuntimes,
    databaseViewRuntime: {
      ...createDatabaseViewRuntimeFromStore(databaseStore, options.host.providers?.database, options.databaseViewConfig),
      ...options.databasePresentation,
      tableEditing: options.tableEditing ? { registry: options.tableEditing, source: () => {
        const snapshot = controller.getState().snapshot;
        return snapshot ? { scope: snapshot.scope, parentTarget: snapshot.target } : undefined;
      } } : undefined,
      onOpenRow: request => {
        const destination: NotesTarget = { kind: "row", databaseId: request.databaseId, rowId: request.rowKey };
        const source = controller.getState();
        void Promise.resolve().then(async () => {
          if (!await beforeTableLeave()) return false;
          const current = controller.getState();
          if (current !== source || !current.snapshot || current.pendingEditors || current.composing || current.recovery || current.manualSaveRequired || current.status !== "ready") return false;
          // Custom navigation completes the host's nested-writer drain and body-save
          // guard (the tabbed workspace does this). Never bypass local input guards.
          return options.onNavigate ? options.onNavigate(destination) : controller.open(destination);
        }).catch(() => false);
      }
    }
  });
  if (config.featureIds?.some(id => !preset.featureIds.includes(id))) throw new Error("Configured Notes feature is not installed");
  return { ...preset, editorOptions: (overrides?: Parameters<typeof preset.editorOptions>[0]) => preset.editorOptions({ ...overrides, dictionary: overrides?.dictionary ?? options.dictionary ?? notesEditorDictionary(config.locale) }), config, host: options.host, controller, pageStore, databaseStore, beforeTableLeave, captureTableLeaveGuard, dispose: () => { controller.dispose(); pageStore.invalidate(); } };
}
