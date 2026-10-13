import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { JsonValue } from "@hello-ai-company/editor-core";
import type { NotesScope, NotesTarget, NotesWorkspaceController } from "../notes/contracts.js";
import { validateNotesDatabasePropertyValue, type NotesDatabasePropertyAdapters, type NotesDatabasePropertyDefinition, type NotesHostedPropertyKind, type NotesPropertyValueMode } from "../notes/propertyCatalog.js";
import { notesIsComposing, notesTargetKey, useNotesController } from "./notesWorkspacePanels.js";
import { NotesOverlayPortal } from "./NotesOverlayPortal.js";
import { useDialogFocusTrap } from "./useDialogFocusTrap.js";

export type NotesPropertyChoice = { id: string; label: string; value: JsonValue };
export type NotesPropertyChoicePage = {
  scope: NotesScope; target: NotesTarget; propertyId: string;
  valueMode: NotesPropertyValueMode; choices: readonly NotesPropertyChoice[]; nextCursor?: string;
};
export type NotesPropertyOptionsHost = {
  read(request: { scope: NotesScope; target: NotesTarget; definition: NotesDatabasePropertyDefinition; query: string; cursor?: string; signal: AbortSignal }): Promise<NotesPropertyChoicePage>;
};
type Pending = { host: NotesPropertyOptionsHost; scope: NotesScope; read: NotesPropertyOptionsHost["read"]; opener: HTMLElement | null; target: NotesTarget; revision: string; definition: NotesDatabasePropertyDefinition; value: JsonValue; signal: AbortSignal; settle(value: JsonValue | undefined): void };
/** Public picker UI used by PropertyDraft's existing explicit pick + named-field save contract.
 * Choosing supplies a draft only. Unmount, cancel, scope/revision change and AbortSignal settle undefined. */
export function useNotesPropertyPickers({ controller, scope, host }: { controller: NotesWorkspaceController; scope: NotesScope; host?: NotesPropertyOptionsHost }): { adapters?: NotesDatabasePropertyAdapters; picker: ReactNode } {
  const state = useNotesController(controller), active = useRef<Pending | undefined>(undefined), [pending, setPending] = useState<Pending>();
  const finish = (value?: JsonValue) => { const captured = active.current; if (!captured) return; active.current = undefined; setPending(undefined); captured.settle(value); };
  useEffect(() => () => { const captured = active.current; active.current = undefined; captured?.settle(undefined); }, []);
  useEffect(() => { if (active.current && (state.snapshot?.revision !== active.current.revision || !state.snapshot || notesTargetKey(state.snapshot.target) !== notesTargetKey(active.current.target) || state.status !== "ready" || state.composing || active.current.scope.actorId !== scope.actorId || active.current.scope.workspaceId !== scope.workspaceId || active.current.read !== host?.read || active.current.host !== host)) finish(); }, [state.snapshot?.revision, state.snapshot?.target, state.status, state.composing, scope.actorId, scope.workspaceId, host]);
  const adapters = useMemo(() => {
    if (!host) return undefined;
    const pick = async (request: { definition: NotesDatabasePropertyDefinition; value: JsonValue; signal: AbortSignal }): Promise<JsonValue | undefined> => {
      const current = controller.getState();
      if (active.current || request.signal.aborted || !current.snapshot || current.snapshot.target.kind !== "row" || current.status !== "ready" || current.composing || current.dirty || current.snapshot.scope.actorId !== scope.actorId || current.snapshot.scope.workspaceId !== scope.workspaceId) return undefined;
      return new Promise(resolve => {
        const settle = (value: JsonValue | undefined) => { request.signal.removeEventListener("abort", abort); resolve(value); };
        const abort = () => { if (active.current?.signal === request.signal) { active.current = undefined; setPending(undefined); } settle(undefined); };
        request.signal.addEventListener("abort", abort, { once: true });
        const next: Pending = { ...request, scope: { ...scope }, host, read: host.read, opener: document.activeElement instanceof HTMLElement ? document.activeElement : null, revision: current.snapshot!.revision, target: current.snapshot!.target, settle };
        active.current = next; setPending(next);
      });
    };
    // The dialog validates each candidate with its exact definition before returning.
    return Object.fromEntries((["user", "files", "relation", "location"] as NotesHostedPropertyKind[]).map(kind => [kind, { pick }])) as NotesDatabasePropertyAdapters;
  }, [controller, host, scope.actorId, scope.workspaceId]);
  const bound = pending && host && pending.scope.actorId === scope.actorId && pending.scope.workspaceId === scope.workspaceId && pending.read === host.read && pending.host === host;
  return { adapters, picker: bound ? <PropertyPicker key={JSON.stringify([notesTargetKey(pending.target), pending.definition.id, pending.revision])} pending={pending} onClose={finish} /> : null };
}
function PropertyPicker({ pending, onClose }: { pending: Pending; onClose(value?: JsonValue): void }) {
  const scope = pending.scope;
  const root = useRef<HTMLDivElement>(null), [query, setQuery] = useState(""), [search, setSearch] = useState(""), [compositionEnd, setCompositionEnd] = useState(0), composing = useRef(false), [choices, setChoices] = useState<readonly NotesPropertyChoice[]>([]), [cursor, setCursor] = useState<string>(), [selected, setSelected] = useState<string>(), [message, setMessage] = useState(""), [loading, setLoading] = useState(false), flight = useRef<AbortController | undefined>(undefined);
  useDialogFocusTrap(true, root);
  const read = async (nextCursor?: string) => {
    flight.current?.abort(); const abort = new AbortController(); flight.current = abort; setLoading(true); setMessage("");
    try {
      const result = await pending.read.call(pending.host, { scope, target: pending.target, definition: pending.definition, query, cursor: nextCursor, signal: abort.signal });
      if (flight.current !== abort || abort.signal.aborted || pending.signal.aborted) return;
      if (result.scope.actorId !== scope.actorId || result.scope.workspaceId !== scope.workspaceId || notesTargetKey(result.target) !== notesTargetKey(pending.target) || result.propertyId !== pending.definition.id || result.valueMode !== (pending.definition.config?.valueMode ?? "reference") || !Array.isArray(result.choices) || result.choices.length > 100 || result.choices.some(item => typeof item.id !== "string" || !item.id || item.id.length > 512 || typeof item.label !== "string" || item.label.length > 4000) || new Set(result.choices.map(item => item.id)).size !== result.choices.length || result.nextCursor !== undefined && (typeof result.nextCursor !== "string" || !result.nextCursor || result.nextCursor.length > 4096) || nextCursor && result.nextCursor === nextCursor) throw new Error("Invalid property projection");
      for (const choice of result.choices) validateNotesDatabasePropertyValue(pending.definition, choice.value);
      setChoices(previous => nextCursor ? [...previous, ...result.choices.filter(choice => !previous.some(old => old.id === choice.id))] : result.choices); setCursor(result.nextCursor);
    } catch { if (!abort.signal.aborted) setMessage("選択肢を読み込めませんでした。元の値は保持しています"); }
    finally { if (flight.current === abort) { flight.current = undefined; setLoading(false); } }
  };
  useEffect(() => { setChoices([]); setSelected(undefined); setCursor(undefined); void read(); return () => { flight.current?.abort(); }; }, [query, pending.read, compositionEnd]);
  return <NotesOverlayPortal anchor={pending.opener} onDismiss={() => onClose()}><div className="oe-notes-property-picker" role="dialog" aria-modal="true" aria-label={pending.definition.name + "を選択"} tabIndex={-1} ref={root} onKeyDown={event => { if (event.key === "Escape" && !notesIsComposing(event)) { event.preventDefault(); event.stopPropagation(); onClose(); } }}><header><h3>{pending.definition.name}を選択</h3><button type="button" onClick={() => onClose()}>キャンセル</button></header><input type="search" aria-label="選択肢を検索" value={search} onCompositionStart={() => { composing.current = true; flight.current?.abort(); setLoading(false); setChoices([]); setSelected(undefined); setCursor(undefined); }} onCompositionEnd={event => { composing.current = false; setQuery(event.currentTarget.value); setCompositionEnd(value => value + 1); }} onChange={event => { setSearch(event.target.value); if (!composing.current) setQuery(event.target.value); }} />
    <p>選択後に値を確認して保存できます。</p><fieldset><legend>許可された選択肢</legend>{choices.map(choice => <label key={choice.id}><input type="radio" name="notes-property-choice" checked={selected === choice.id} onChange={() => setSelected(choice.id)} />{choice.label}</label>)}</fieldset>
    {!loading && !choices.length ? <p>選択肢はありません</p> : null}{cursor ? <button type="button" disabled={loading} onClick={() => void read(cursor)}>続きを読み込む</button> : null}
    <button type="button" disabled={loading || !selected || !choices.some(choice => choice.id === selected)} onClick={() => { const choice = choices.find(choice => choice.id === selected); if (choice) onClose(validateNotesDatabasePropertyValue(pending.definition, choice.value)); }}>この値を選択</button>
    {loading ? <p role="status">読み込んでいます</p> : null}{message ? <p role="status">{message}</p> : null}
  </div></NotesOverlayPortal>;
}
