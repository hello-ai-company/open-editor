import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import type { EditorAsset, EditorBlock, JsonValue } from "@hello-ai-company/editor-core";
import type { DocumentIndex } from "../index/documentIndex.js";
import type { NotesCommand, NotesCommandOutcome, NotesDocumentSnapshot, NotesPersistenceMode, NotesTarget, NotesWorkspaceController } from "../notes/contracts.js";
import type { NotesContentCodecs, NotesMediaScope } from "./NotesContentTools.js";

export type NotesInsertKind = "text" | "page" | "link" | "card" | "attachment" | "image" | "video" | "audio" | "pdf" | "unsplash" | "code" | "equation" | "mermaid" | "whiteboard" | "htmlEmbed" | "syncedBlock" | "collection" | "gallery" | "kanban" | "columns" | "divider" | "pageBreak" | "tableInsert";
export type NotesStyleKind = "heading" | "quote" | "bullet" | "numbered" | "checklist" | "callout" | "alignLeft" | "alignCenter" | "alignRight" | "indent" | "outdent" | "fontSans" | "fontSerif" | "fontMono" | "textSmall" | "textLarge" | "clearFormatting" | "moveUp" | "moveDown" | "moveTop" | "moveBottom";

/** Local editing bridge. The integration publishes every successful local change with
 * controller.setDraft; these callbacks never imply a durable save or upload receipt.
 * supported actions must describe installed implementations and current authorization.
 */
export type NotesEditorBridge = {
  index: DocumentIndex;
  installedBlockTypes: readonly string[];
  supportedInsertActions: readonly NotesInsertKind[];
  supportedStyleActions: readonly NotesStyleKind[];
  editable: boolean;
  composing?: boolean;
  focusBlock(blockId: string): void;
  toggleTask?(blockId: string): void | Promise<void>;
  insert(kind: NotesInsertKind, signal: AbortSignal): void | Promise<void>;
  format(kind: NotesStyleKind, signal: AbortSignal): void | Promise<void>;
  /** Optional host picker, never a global browser event or implicit paid provider call. */
  classify?(signal: AbortSignal): Promise<Record<string, JsonValue> | undefined>;
  contentCodecs?: NotesContentCodecs;
  getSelectedBlockId?(): string;
  acceptAsset?(asset: EditorAsset, scope: NotesMediaScope, signal: AbortSignal, presentation?: "compact" | "card"): Promise<void>;
};
export type NotesPanelDataState = "loading" | "ready" | "error" | "unavailable";
export type NotesCatalogEntry<K extends string> = { kind: K; label: string; blockTypes?: readonly string[]; oneOfBlockTypes?: readonly string[] };

/** Feature names are compatible with the Notes preset; implementations are OpenEditor/schema owned. */
export const NOTES_INSERT_CATALOG: readonly NotesCatalogEntry<NotesInsertKind>[] = [
  { kind: "text", label: "テキスト", blockTypes: ["paragraph"] },
  { kind: "page", label: "子ページ", blockTypes: ["childPage"] },
  { kind: "link", label: "リンク", blockTypes: ["paragraph"] },
  { kind: "card", label: "ページカード", blockTypes: ["pageCard"] },
  { kind: "attachment", label: "添付ファイル", blockTypes: ["file"] },
  { kind: "image", label: "画像", blockTypes: ["image"] },
  { kind: "video", label: "ビデオ", blockTypes: ["video"] },
  { kind: "audio", label: "音声", blockTypes: ["audio"] },
  { kind: "pdf", label: "PDF", blockTypes: ["file"] },
  { kind: "unsplash", label: "画像を探す", blockTypes: ["image"] },
  { kind: "code", label: "コード", blockTypes: ["codeBlock"] },
  { kind: "equation", label: "TeX 数式", blockTypes: ["mathBlock"] },
  { kind: "mermaid", label: "Mermaid 図", blockTypes: ["diagram"] },
  { kind: "whiteboard", label: "ホワイトボード", oneOfBlockTypes: ["whiteboard", "oeNotesDrawing"] },
  { kind: "htmlEmbed", label: "HTML ウィジェット", blockTypes: ["oeHtmlWidget"] },
  { kind: "syncedBlock", label: "同期ブロック", oneOfBlockTypes: ["oeNotesSyncedBlock", "pageTransclusion"] },
  { kind: "collection", label: "データベース", blockTypes: ["databaseView"] },
  { kind: "gallery", label: "ギャラリー", blockTypes: ["databaseView"] },
  { kind: "kanban", label: "カンバン", blockTypes: ["databaseView"] },
  { kind: "columns", label: "カラム", blockTypes: ["oeColumns", "oeColumn"] },
  { kind: "divider", label: "区切り線", blockTypes: ["divider"] },
  { kind: "pageBreak", label: "改ページ", blockTypes: ["oePageBreak"] },
  { kind: "tableInsert", label: "表", blockTypes: ["table"] }
];
export const NOTES_STYLE_CATALOG: readonly NotesCatalogEntry<NotesStyleKind>[] = [
  { kind: "heading", label: "見出し", blockTypes: ["heading"] },
  { kind: "quote", label: "引用", blockTypes: ["quote"] },
  { kind: "bullet", label: "箇条書き", blockTypes: ["bulletListItem"] },
  { kind: "numbered", label: "番号付きリスト", blockTypes: ["numberedListItem"] },
  { kind: "checklist", label: "チェックリスト", blockTypes: ["checkListItem"] },
  { kind: "callout", label: "コールアウト", blockTypes: ["callout"] },
  { kind: "alignLeft", label: "左寄せ" }, { kind: "alignCenter", label: "中央寄せ" }, { kind: "alignRight", label: "右寄せ" },
  { kind: "indent", label: "インデント" }, { kind: "outdent", label: "インデント解除" },
  { kind: "fontSans", label: "ゴシック体" }, { kind: "fontSerif", label: "明朝体" }, { kind: "fontMono", label: "等幅フォント" },
  { kind: "textSmall", label: "小さな文字" }, { kind: "textLarge", label: "大きな文字" }, { kind: "clearFormatting", label: "書式をクリア" },
  { kind: "moveUp", label: "上に移動" }, { kind: "moveDown", label: "下に移動" }, { kind: "moveTop", label: "先頭へ移動" }, { kind: "moveBottom", label: "末尾へ移動" }
];
export function notesAvailableCatalog<K extends string>(catalog: readonly NotesCatalogEntry<K>[], supported: readonly K[], installed: readonly string[]): readonly NotesCatalogEntry<K>[] {
  const actions = new Set(supported), types = new Set(installed);
  return catalog.filter(item => actions.has(item.kind) && (!item.blockTypes || item.blockTypes.every(type => types.has(type))) && (!item.oneOfBlockTypes || item.oneOfBlockTypes.some(type => types.has(type))));
}
export function notesTargetKey(target: NotesTarget): string {
  return JSON.stringify(target.kind === "page" ? ["page", target.pageId] : ["row", target.databaseId, target.rowId]);
}
const controllerIds = new WeakMap<NotesWorkspaceController, number>();
let nextControllerId = 0;
export function notesPanelIdentity(controller: NotesWorkspaceController, snapshot?: NotesDocumentSnapshot): string {
  if (!controllerIds.has(controller)) controllerIds.set(controller, ++nextControllerId);
  return JSON.stringify([controllerIds.get(controller), snapshot?.scope.actorId, snapshot?.scope.workspaceId, snapshot ? notesTargetKey(snapshot.target) : "empty"]);
}
export function notesPersistenceLabel(mode: NotesPersistenceMode): string {
  return ({ "local-only": "この端末に保存", "offline-queued": "同期待ち", "remote-committed": "サーバーに保存", "test-only": "合成デモ内のみ" })[mode];
}
export function notesIsComposing(event: KeyboardEvent): boolean {
  return event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229;
}
export function useNotesController(controller: NotesWorkspaceController) {
  return useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
}
/** Controller-owned form drafts survive closing a panel. Only explicit cancellation or
 * a controller-verified acknowledgement clears them; unmount never does. */
export function useLocalNotesDraft<T extends JsonValue>(controller: NotesWorkspaceController, id: string) {
  const state = useNotesController(controller);
  const key = JSON.stringify([state.snapshot?.scope, state.snapshot?.target, id]);
  return { value: state.localDrafts[key] as T | undefined, id: key, set: (value: T | undefined) => controller.setLocalDraft(key, value) };
}
/** Clear only this input's composition ownership when it closes or its target changes. */
export function useNotesComposition(controller: NotesWorkspaceController, identity?: string | boolean) {
  const own = useRef(false);
  const end = () => { if (own.current) { own.current = false; controller.setComposing(false); } };
  useEffect(() => end, [controller, identity]);
  return { onCompositionStart: () => { own.current = true; controller.setComposing(true); }, onCompositionEnd: end, onBlur: end };
}
export function useNotesEntries(index: DocumentIndex) {
  useSyncExternalStore(index.subscribe, index.getRevision, index.getRevision);
  return index.list();
}
export function notesBlockById(blocks: readonly EditorBlock[], id: string): EditorBlock | undefined {
  for (const block of blocks) { if (block.id === id) return block; const hit = notesBlockById(block.children ?? [], id); if (hit) return hit; }
  return undefined;
}
export function notesOutcomeMessage(outcome: NotesCommandOutcome): string {
  if (outcome.status === "committed") return `${notesPersistenceLabel(outcome.persistence)} · 結果を確認しました`;
  if (outcome.status === "unknown" || outcome.status === "pending") return "保存結果が不明です。再送せず結果を照会してください";
  if (outcome.status === "cancelled") return "送信前に取り消しました";
  if (outcome.status === "conflict") return "別の変更を検出しました。入力を保持しています";
  return "保存できませんでした。権限と最新データを確認してください";
}
/** Single-flight UI orchestration; controller owns CAS, receipts and cancellation semantics. */
export function useNotesPanelCommands(controller: NotesWorkspaceController) {
  const state = useNotesController(controller), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const flight = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const canEdit = (kind: NotesCommand["kind"]): boolean => !!state.snapshot?.capabilities.includes(kind) && !!state.snapshot.capabilitySemantics[kind] && state.status === "ready" && !state.dirty && !busy;
  const available = (kind: NotesCommand["kind"], localDraftId?: string): boolean => canEdit(kind) && !state.composing && (!state.pendingEditors || kind === "document.save" || !!localDraftId && Object.hasOwn(state.localDrafts, localDraftId));
  const execute = async (command: NotesCommand, options?: { localDraftId?: string }): Promise<boolean> => {
    if (flight.current || !available(command.kind, options?.localDraftId)) return false;
    flight.current = true; setBusy(true); setMessage("");
    try { const outcome = options ? await controller.execute(command, options) : await controller.execute(command); if (mounted.current) setMessage(notesOutcomeMessage(outcome)); return outcome.status === "committed"; }
    catch { if (mounted.current) setMessage("操作を完了できませんでした。入力を保持しています"); return false; }
    finally { flight.current = false; if (mounted.current) setBusy(false); }
  };
  return { state, busy, message, canEdit, available, execute };
}
export function NotesPanelStatus({ controller, message }: { controller: NotesWorkspaceController; message?: string }) {
  const state = useNotesController(controller), [lookupBusy, setLookupBusy] = useState(false), [lookupMessage, setLookupMessage] = useState("");
  const mounted = useRef(true), flight = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  return <div className="oe-notes-panel-status" aria-live="polite">
    <p role="status">{lookupMessage || message || state.message || (state.pendingEditors ? "未保存の入力を保持しています。保存またはキャンセルしてから移動してください" : state.dirty ? "本文の変更を保存してから操作してください" : "")}</p>
    {state.snapshot ? <small>{[...new Set(Object.values(state.snapshot.capabilitySemantics))].map(mode => notesPersistenceLabel(mode!)).join(" / ")}</small> : null}
    {state.status === "saving" ? <button type="button" onClick={() => controller.cancel()}>操作を中断</button> : null}
    {state.status === "unknown" ? <button type="button" disabled={lookupBusy} onClick={() => {
      if (flight.current) return; flight.current = true; setLookupBusy(true);
      void controller.reconcile().then(outcome => { if (mounted.current) setLookupMessage(notesOutcomeMessage(outcome)); }).catch(() => { if (mounted.current) setLookupMessage("結果を確認できませんでした。入力と照会情報を保持しています"); }).finally(() => { flight.current = false; if (mounted.current) setLookupBusy(false); });
    }}>保存結果を照会</button> : null}
  </div>;
}
