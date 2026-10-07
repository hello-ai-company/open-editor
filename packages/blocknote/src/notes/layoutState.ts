import { copyLegacyNotesJson } from "../document/legacyNotes.js";
import type { NotesTarget } from "./contracts.js";

export type NotesLayoutScope = { actorId: string; workspaceId: string };
export type NotesWorkspaceTab = { id: string; target: NotesTarget; title: string; pinned: boolean };
export type NotesSplitAxis = "horizontal" | "vertical";
export type NotesDropZone = "left" | "right" | "top" | "bottom" | "center";
export type NotesLayoutState = {
  version: 1; scope: NotesLayoutScope; tabs: readonly NotesWorkspaceTab[];
  activeTabId: string | null;
  split: { axis: NotesSplitAxis; tabIds: readonly string[]; primaryPosition?: number };
  previewTabId: string | null;
};
/** Host storage is actor/workspace scoped; this API deliberately cannot erase legacy keys. */
export type NotesLayoutStorage = {
  read(key: string): Promise<string | null>;
  /** Compare expected raw bytes atomically; reject concurrent changes. */
  write(key: string, value: string, expectedOriginal: string | null): Promise<void>;
};
export type NotesLayoutLoad =
  | { status: "loaded" | "empty" | "migrated"; layout: NotesLayoutState }
  | { status: "invalid"; original: string; message: string }
  | { status: "unavailable"; message: string };
export function notesTargetKey(target: NotesTarget): string {
  return target.kind === "page" ? JSON.stringify(["page", target.pageId]) : JSON.stringify(["row", target.databaseId, target.rowId]);
}
export function notesLayoutStorageKey(scope: NotesLayoutScope): string {
  assertScope(scope);
  return `open-editor:notes-layout:v1:${JSON.stringify([scope.actorId, scope.workspaceId])}`;
}
function assertScope(scope: NotesLayoutScope): void {
  if (!scope || typeof scope.actorId !== "string" || !scope.actorId || scope.actorId.length > 512 || typeof scope.workspaceId !== "string" || !scope.workspaceId || scope.workspaceId.length > 512) throw new Error("Invalid Notes layout scope");
}
export function createNotesLayout(scope: NotesLayoutScope): NotesLayoutState {
  assertScope(scope);
  return { version: 1, scope: { ...scope }, tabs: [], activeTabId: null, split: { axis: "horizontal", tabIds: [] }, previewTabId: null };
}
export function parseNotesLayout(value: unknown, scope: NotesLayoutScope): NotesLayoutState {
  assertScope(scope);
  const layout = copyLegacyNotesJson(value) as unknown as NotesLayoutState;
  if (!layout || typeof layout !== "object" || Array.isArray(layout) || layout.version !== 1 || !layout.scope || layout.scope.actorId !== scope.actorId || layout.scope.workspaceId !== scope.workspaceId) throw new Error("Notes layout scope/version mismatch");
  if (Object.keys(layout).some(key => !["version", "scope", "tabs", "activeTabId", "split", "previewTabId"].includes(key))) throw new Error("Unsupported Notes layout fields");
  if (!Array.isArray(layout.tabs) || layout.tabs.length > 200) throw new Error("Invalid Notes tabs");
  const ids = new Set<string>();
  for (const tab of layout.tabs) {
    if (!tab || typeof tab.id !== "string" || !tab.id || tab.id.length > 512 || ids.has(tab.id) || typeof tab.title !== "string" || tab.title.length > 1024 || typeof tab.pinned !== "boolean") throw new Error("Invalid Notes tab");
    const target = tab.target;
    if (!target || (target.kind !== "page" && target.kind !== "row") || (target.kind === "page" ? typeof target.pageId !== "string" || !target.pageId : typeof target.databaseId !== "string" || !target.databaseId || typeof target.rowId !== "string" || !target.rowId)) throw new Error("Invalid Notes tab target");
    if (Object.keys(tab).some(key => !["id", "target", "title", "pinned"].includes(key)) || Object.keys(target).some(key => !(target.kind === "page" ? ["kind", "pageId"] : ["kind", "databaseId", "rowId"]).includes(key))) throw new Error("Unsupported Notes tab fields");
    ids.add(tab.id);
  }
  if ((layout.activeTabId !== null && !ids.has(layout.activeTabId)) || (layout.tabs.length > 0 && layout.activeTabId === null) || (layout.previewTabId !== null && !ids.has(layout.previewTabId))) throw new Error("Invalid active Notes tab");
  if (!layout.split || !["horizontal", "vertical"].includes(layout.split.axis) || !Array.isArray(layout.split.tabIds) || layout.split.tabIds.length > 2 || new Set(layout.split.tabIds).size !== layout.split.tabIds.length || layout.split.tabIds.some(id => !ids.has(id) || id === layout.activeTabId) || (layout.split.primaryPosition !== undefined && (!Number.isInteger(layout.split.primaryPosition) || layout.split.primaryPosition < 0 || layout.split.primaryPosition > layout.split.tabIds.length))) throw new Error("Invalid Notes split");
  return layout;
}
export function openNotesTab(layout: NotesLayoutState, tab: NotesWorkspaceTab): NotesLayoutState {
  const existing = layout.tabs.find(item => notesTargetKey(item.target) === notesTargetKey(tab.target));
  if (!existing && layout.tabs.length >= 200) throw new Error("Too many Notes tabs");
  const id = existing?.id ?? tab.id;
  const splitIds = layout.split.tabIds.filter(item => item !== id);
  return parseNotesLayout({ ...layout, tabs: existing ? layout.tabs : [...layout.tabs, tab], activeTabId: id, split: { ...layout.split, tabIds: splitIds, primaryPosition: Math.min(layout.split.primaryPosition ?? 0, splitIds.length) } }, layout.scope);
}
/** Call only after the host/controller has guarded dirty input and pending operations. */
export function closeNotesTab(layout: NotesLayoutState, id: string): NotesLayoutState {
  const tab = layout.tabs.find(item => item.id === id);
  if (!tab || tab.pinned) return layout;
  const tabs = layout.tabs.filter(item => item.id !== id);
  const activeTabId = layout.activeTabId === id ? tabs[tabs.length - 1]?.id ?? null : layout.activeTabId;
  const tabIds = layout.split.tabIds.filter(item => item !== id && item !== activeTabId);
  return { ...layout, tabs, activeTabId, split: { ...layout.split, tabIds, primaryPosition: Math.min(layout.split.primaryPosition ?? 0, tabIds.length) }, previewTabId: layout.previewTabId === id ? null : layout.previewTabId };
}
export function splitNotesTab(layout: NotesLayoutState, id: string, zone: NotesDropZone): NotesLayoutState {
  if (!layout.tabs.some(tab => tab.id === id) || id === layout.activeTabId) return layout;
  if (zone === "center") { const tabIds = layout.split.tabIds.filter(item => item !== id); return { ...layout, activeTabId: id, split: { ...layout.split, tabIds, primaryPosition: Math.min(layout.split.primaryPosition ?? 0, tabIds.length) } }; }
  const others = layout.split.tabIds.filter(item => item !== id);
  const tabIds = zone === "left" || zone === "top" ? [id, ...others] : [...others, id];
  return { ...layout, split: { axis: zone === "left" || zone === "right" ? "horizontal" : "vertical", tabIds: tabIds.slice(0, 2), primaryPosition: zone === "left" || zone === "top" ? 1 : 0 } };
}
export function notesDropZone(x: number, y: number): NotesDropZone {
  if (x < .24) return "left";
  if (x > .76) return "right";
  if (y < .24) return "top";
  if (y > .76) return "bottom";
  return "center";
}
/** Duplicate resource panes are readable mirrors, never independent concurrent writers. */
export function notesLayoutPanes(layout: NotesLayoutState): readonly { paneId: string; tab: NotesWorkspaceTab; readOnly: boolean }[] {
  const seen = new Set<string>();
  const panes = [layout.activeTabId, ...layout.split.tabIds].flatMap((id, index) => {
    const tab = layout.tabs.find(item => item.id === id);
    if (!tab) return [];
    const key = notesTargetKey(tab.target), readOnly = seen.has(key);
    seen.add(key);
    return [{ paneId: index === 0 ? "primary" : `split-${tab.id}`, tab, readOnly }];
  });
  const primary = panes.shift();
  if (primary) panes.splice(layout.split.primaryPosition ?? 0, 0, primary);
  return panes;
}
export async function saveNotesLayout(storage: NotesLayoutStorage, layout: NotesLayoutState): Promise<void> {
  const checked = parseNotesLayout(layout, layout.scope);
  const key = notesLayoutStorageKey(layout.scope);
  const original = await storage.read(key);
  let legacyOriginal: unknown;
  if (original !== null) {
    const envelope = JSON.parse(original) as { layout?: unknown; legacyOriginal?: unknown };
    parseNotesLayout(envelope.layout ?? envelope, layout.scope);
    legacyOriginal = envelope.legacyOriginal;
  }
  await storage.write(key, JSON.stringify({ layout: checked, ...(legacyOriginal === undefined ? {} : { legacyOriginal }) }), original);
}
/** Invalid records stay byte-for-byte in host storage until this explicit user repair action. */
export async function repairNotesLayout(storage: NotesLayoutStorage, layout: NotesLayoutState, expectedOriginal: string): Promise<void> {
  const checked = parseNotesLayout(layout, layout.scope), key = notesLayoutStorageKey(layout.scope);
  if (await storage.read(key) !== expectedOriginal) throw new Error("Notes layout changed during repair");
  await storage.write(key, JSON.stringify({ layout: checked, legacyOriginal: expectedOriginal }), expectedOriginal);
}
export async function loadNotesLayout(storage: NotesLayoutStorage, scope: NotesLayoutScope, legacy?: { key: string; title?: (pageId: string) => string }): Promise<NotesLayoutLoad> {
  try {
    const key = notesLayoutStorageKey(scope), original = await storage.read(key);
    if (original !== null) {
      try {
        const envelope = JSON.parse(original) as { layout?: unknown };
        return { status: "loaded", layout: parseNotesLayout(envelope.layout ?? envelope, scope) };
      } catch { return { status: "invalid", original, message: "Notes layout is invalid; original preserved" }; }
    }
    const empty = createNotesLayout(scope);
    if (!legacy) return { status: "empty", layout: empty };
    const legacyOriginal = await storage.read(legacy.key);
    if (legacyOriginal === null) return { status: "empty", layout: empty };
    const ids: unknown = JSON.parse(legacyOriginal);
    if (!Array.isArray(ids) || ids.length > 200 || ids.some(id => typeof id !== "string" || !id)) return { status: "invalid", original: legacyOriginal, message: "Legacy tabs invalid; originals preserved" };
    let layout = empty;
    for (const id of [...new Set(ids as string[])]) layout = openNotesTab(layout, { id, target: { kind: "page", pageId: id }, title: legacy.title?.(id) ?? id, pinned: false });
    await storage.write(key, JSON.stringify({ layout, legacyOriginal }), null);
    return { status: "migrated", layout };
  } catch { return { status: "unavailable", message: "Notes layout storage unavailable; originals preserved" }; }
}
