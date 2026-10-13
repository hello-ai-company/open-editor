import { createContext, useContext, useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import type { NotesHtmlSourceDraftState } from "../notes/htmlSourceDraft.js";
import type { JsonValue } from "@hello-ai-company/editor-core";

type EditorDraftScope = { workspaceId: string; actorId: string };
type EditorDraftTarget = { kind: "page"; pageId: string } | { kind: "row"; databaseId: string; rowId: string };
export type EditorDraftLifecycleState = {
  snapshot?: { scope: EditorDraftScope; target: EditorDraftTarget };
  localDrafts: Readonly<Record<string, JsonValue>>;
  sourceDrafts?: NotesHtmlSourceDraftState;
};
/** Optional structural interface; standalone widgets do not depend on a Notes host or controller. */
export type EditorDraftLifecycleController = {
  getState(): EditorDraftLifecycleState;
  subscribe(listener: () => void): () => void;
  setLocalDraft(id: string, value: JsonValue | undefined): void;
  setComposing(composing: boolean): void;
  getDraftSessionId?(): number;
  assertLocalSourceCurrent?(id: string): void;
  resumeLocalSourceDraft?(id: string): void;
  markLocalDraftApplied?(id: string): void;
  discardLocalDraft?(id: string): Promise<boolean>;
  retrySourceDrafts?(): Promise<boolean>;
};
const DraftLifecycleContext = createContext<EditorDraftLifecycleController | undefined>(undefined);
const viewIdentities = new WeakMap<EditorDraftLifecycleController, string>();
export function EditorDraftLifecycleProvider({ controller, children }: { controller: EditorDraftLifecycleController; children: ReactNode }) {
  return <DraftLifecycleContext.Provider value={controller}>{children}</DraftLifecycleContext.Provider>;
}
const noopSubscribe = (): (() => void) => () => undefined;
const emptySnapshot = (): undefined => undefined;
/** Ordered tuples avoid page/row and delimiter collisions. A key never contains content or credentials. */
export function editorLocalDraftKey(snapshot: NonNullable<EditorDraftLifecycleState["snapshot"]>, blockId: string, kind: string): string {
  const valid = (id: string): boolean => typeof id === "string" && id.length > 0 && id.length <= 512;
  const { scope, target } = snapshot;
  if (!valid(scope.workspaceId) || !valid(scope.actorId) || !valid(blockId) || !valid(kind)) throw new Error("Invalid editor draft identity");
  const targetKey = target.kind === "page" ? ["page", target.pageId] : target.kind === "row" ? ["row", target.databaseId, target.rowId] : [];
  if (!targetKey.length || targetKey.some(id => !valid(id))) throw new Error("Invalid editor draft target");
  const key = JSON.stringify(["editor-local-draft", scope.workspaceId, scope.actorId, targetKey, kind, blockId]);
  if (key.length > 4096) throw new Error("Editor draft identity exceeds the cache key limit");
  return key;
}
export type EditorLocalDraftLifecycle = {
  identity: string;
  available: boolean;
  unavailableReason?: string;
  persisted: boolean;
  value: JsonValue | undefined;
  assertCurrent(): void;
  set(value: JsonValue | undefined): void;
  setComposition(composing: boolean): void;
  durable?: NotesHtmlSourceDraftState;
  assertSourceCurrent(): void;
  resume(): void;
  applied(): void;
  discard(): Promise<boolean>;
  retry(): Promise<boolean>;
};
/** Input is cached synchronously before rendering it. Unmount releases composition, never a draft.
 * Delayed imports and old widget callbacks cannot write a different document/scope's cache. */
export function useEditorLocalDraft(blockId: string, kind: string): EditorLocalDraftLifecycle {
  const controller = useContext(DraftLifecycleContext);
  const state = useSyncExternalStore(controller?.subscribe ?? noopSubscribe, controller?.getState ?? emptySnapshot, controller?.getState ?? emptySnapshot);
  let key: string | undefined, unavailableReason: string | undefined;
  if (controller) {
    if (!state?.snapshot) unavailableReason = "Source editing is unavailable until the document draft cache is ready. Original source is retained.";
    else try { key = editorLocalDraftKey(state.snapshot, blockId, kind); }
    catch (reason) { unavailableReason = `${reason instanceof Error ? reason.message : "Editor draft identity is unavailable"}. Source editing is disabled; original source is retained.`; }
  }
  if (controller && !viewIdentities.has(controller)) viewIdentities.set(controller, crypto.randomUUID());
  const viewIdentity = controller ? viewIdentities.get(controller)! : "standalone";
  const sessionId = controller?.getDraftSessionId?.();
  const seen = useRef<{ sessionId?: number; key?: string; controller?: EditorDraftLifecycleController; value?: JsonValue }>({ sessionId, key, controller, value: key ? state?.localDrafts[key] : undefined });
  if (seen.current.key !== key || seen.current.controller !== controller || seen.current.sessionId !== sessionId) seen.current = { sessionId, key, controller, value: key ? state?.localDrafts[key] : undefined };
  const activeComposition = useRef(false);
  const matches = (): boolean => {
    if (!controller || !key || !controller.getState().snapshot || controller.getDraftSessionId?.() !== sessionId) return false;
    try { return editorLocalDraftKey(controller.getState().snapshot!, blockId, kind) === key; }
    catch { return false; }
  };
  const assertCurrent = (): void => { if (!controller) return; if (!matches()) throw new Error("The editor draft target changed; original draft retained"); if (JSON.stringify(controller.getState().localDrafts[key!]) !== JSON.stringify(seen.current.value)) throw new Error("This source draft changed in another editor. Original cached input is retained."); };
  useEffect(() => {
    activeComposition.current = false;
    return () => {
      // Clearing composition is separate from preserving raw input and pendingEditors.
      if (activeComposition.current && matches()) controller!.setComposing(false);
      activeComposition.current = false;
    };
  }, [controller, key, sessionId]);
  return {
    identity: JSON.stringify([viewIdentity, sessionId, key ?? [controller ? "unbound" : "standalone", kind, blockId]]), available: !controller || Boolean(key), unavailableReason, persisted: Boolean(controller), value: key ? state?.localDrafts[key] : undefined,
    assertCurrent,
    durable: state?.sourceDrafts,
    assertSourceCurrent: () => { assertCurrent(); if (key) controller?.assertLocalSourceCurrent?.(key); },
    resume: () => { assertCurrent(); if (!controller || !key || !controller.resumeLocalSourceDraft) return; controller.resumeLocalSourceDraft(key); seen.current.value = controller.getState().localDrafts[key]; },
    applied: () => { assertCurrent(); if (!controller || !key) return; if (controller.markLocalDraftApplied) controller.markLocalDraftApplied(key); else controller.setLocalDraft(key, undefined); seen.current.value = undefined; },
    discard: async () => { assertCurrent(); if (!controller || !key) return true; const result = controller.discardLocalDraft ? await controller.discardLocalDraft(key) : (controller.setLocalDraft(key, undefined), true); if (result) seen.current.value = undefined; return result; },
    retry: async () => Boolean(await controller?.retrySourceDrafts?.()),
    set: value => { if (!controller) return; assertCurrent(); controller.setLocalDraft(key!, value); seen.current.value = value; },
    setComposition: composing => { if (!controller) return; if (!matches()) return; activeComposition.current = composing; controller.setComposing(composing); }
  };
}
