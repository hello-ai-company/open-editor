import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { JsonValue } from "@hello-ai-company/editor-core";
import type { NotesCommandOutcome, NotesWorkspaceController } from "../notes/contracts.js";
import { NOTES_DATABASE_PROPERTY_LABELS, isNotesDatabasePropertyKind, notesPropertyAuthority, validateNotesDatabasePropertyValue, type NotesDatabasePropertyAdapters, type NotesDatabasePropertyDefinition, type NotesHostedPropertyKind } from "../notes/propertyCatalog.js";

export type NotesDatabasePropertiesProps = {
  databaseId: string; rowId: string;
  definitions: readonly NotesDatabasePropertyDefinition[];
  values: Readonly<Record<string, JsonValue>>;
  controller: NotesWorkspaceController;
  adapters?: NotesDatabasePropertyAdapters;
  onCommitted?(result: Extract<NotesCommandOutcome, { status: "committed" }>): void;
  onCancel?(): void;
};
/** UI never replaces a whole row. Only reviewed named-field commands reach the durable controller. */
export function NotesDatabaseProperties(props: NotesDatabasePropertiesProps) {
  return <section className="oe-notes-database-properties" aria-label="データベースのプロパティ">
    {props.definitions.map(definition => <PropertyDraft key={`${props.databaseId}:${props.rowId}:${definition.id}`} {...props} definition={definition} value={props.values[definition.id] ?? null} />)}
    {!props.definitions.length ? <p>プロパティはありません</p> : null}
  </section>;
}
function initialDraft(definition: NotesDatabasePropertyDefinition, value: JsonValue): string {
  if (["multi_select", "checkbox"].includes(definition.type)) return JSON.stringify(value);
  return value === null ? "" : typeof value === "string" ? value : JSON.stringify(value);
}
type PropertyCache = { draft: string; base: { revision: string; definition: string; value: JsonValue } };
function propertyCache(value: JsonValue | undefined): PropertyCache | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) value = value.presentation;
  if (!value || typeof value !== "object" || Array.isArray(value) || typeof value.draft !== "string" || !value.base || typeof value.base !== "object" || Array.isArray(value.base) || typeof value.base.revision !== "string" || typeof value.base.definition !== "string" || !Object.hasOwn(value.base, "value")) return undefined;
  return value as unknown as PropertyCache;
}
function PropertyDraft(props: NotesDatabasePropertiesProps & { definition: NotesDatabasePropertyDefinition; value: JsonValue }) {
  const { definition, value, controller } = props;
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
  const cacheKey = JSON.stringify(["notes-property", props.databaseId, props.rowId, definition.id]);
  const [draft, setDraft] = useState(() => propertyCache(state.localDrafts[cacheKey])?.draft ?? initialDraft(definition, value));
  const [base, setBase] = useState(() => propertyCache(state.localDrafts[cacheKey])?.base ?? { revision: state.snapshot?.revision ?? "", definition: JSON.stringify(definition), value });
  const [message, setMessage] = useState(""), [picking, setPicking] = useState(false);
  const pickerController = useRef<AbortController | undefined>(undefined), pickerPriorCache = useRef<JsonValue | undefined>(undefined), mounted = useRef(true), composing = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; pickerController.current?.abort(); if (composing.current) controller.setComposing(false); }; }, [controller]);
  const source = (next: string): string => ["number", "checkbox", "multi_select", "user", "files", "relation", "location"].includes(definition.type) ? next === "" && definition.type === "number" ? "null" : next : JSON.stringify(next === "" && ["select", "status", "date", "url", "email"].includes(definition.type) ? null : next);
  const cache = (next: string, reviewedSource = source(next)): JsonValue => ({ kind: "property", propertyId: definition.id, baseRevision: base.revision, source: reviewedSource, presentation: { draft: next, base } });
  const storeDraft = (next: string): void => { setDraft(next); controller.setLocalDraft(cacheKey, cache(next)); };
  const authority = notesPropertyAuthority(definition), adapter = props.adapters?.[definition.type as NotesHostedPropertyKind];
  const snapshot = state.snapshot, correctTarget = snapshot?.target.kind === "row" && snapshot.target.databaseId === props.databaseId && snapshot.target.rowId === props.rowId;
  const rowValues = snapshot?.metadata.properties;
  const canonicalValue = correctTarget && rowValues && typeof rowValues === "object" && !Array.isArray(rowValues) && Object.hasOwn(rowValues, definition.id) ? rowValues[definition.id]! : value;
  const stale = base.revision !== snapshot?.revision || base.definition !== JSON.stringify(definition);
  const inputBlocked = !correctTarget || state.status !== "ready" || state.dirty || picking;
  const blocked = inputBlocked || state.composing;
  const canCancel = correctTarget && !["loading", "saving", "unknown"].includes(state.status) && !state.composing && !picking;
  const writable = authority === "editable" || authority === "host-picker" && !!adapter;
  const canPatch = writable && snapshot?.capabilities.includes("property.patch") === true;
  const canAction = authority === "action" && snapshot?.capabilities.includes("database.action") === true && typeof definition.config?.actionId === "string";
  const reset = (): void => { setDraft(initialDraft(definition, canonicalValue)); setBase({ revision: snapshot?.revision ?? "", definition: JSON.stringify(definition), value: canonicalValue }); controller.setLocalDraft(cacheKey, undefined); setMessage(""); };
  useEffect(() => {
    // The controller alone clears confirmed reviewed caches. A common recovery button may do so
    // outside this form; refresh only after that clear, never while a newer typed cache remains.
    if (!state.localDrafts[cacheKey] && correctTarget && state.status === "ready" && snapshot && base.revision !== snapshot.revision) {
      setBase({ revision: snapshot.revision, definition: JSON.stringify(definition), value: canonicalValue });
      setDraft(initialDraft(definition, canonicalValue));
    }
  }, [state.localDrafts, state.status, snapshot?.revision, correctTarget, base.revision, cacheKey, canonicalValue, definition]);
  const settleDraft = (result: NotesCommandOutcome, next: JsonValue): boolean => {
    if (result.status !== "committed" || controller.getState().localDrafts[cacheKey]) return false;
    if (mounted.current) { setMessage("保存を確認しました"); setBase({ revision: result.snapshot.revision, definition: JSON.stringify(definition), value: next }); setDraft(initialDraft(definition, next)); props.onCommitted?.(result); }
    return true;
  };
  const resolve = async (picked?: JsonValue): Promise<void> => {
    if (blocked || stale || !canPatch) return;
    try {
      let next: JsonValue;
      if (picked !== undefined) next = picked;
      else if (draft === initialDraft(definition, base.value)) next = base.value;
      else if (definition.type === "number") {
        if (draft === "") next = null;
        else { if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(draft) || !Number.isFinite(Number(draft))) throw new Error("有限の数値を入力してください"); next = Number(draft); }
      } else if (definition.type === "checkbox" || definition.type === "multi_select" || authority === "host-picker") next = JSON.parse(draft) as JsonValue;
      else if (draft === "" && ["select", "status", "date", "url", "email"].includes(definition.type)) next = null;
      else next = draft;
      const safe = validateNotesDatabasePropertyValue(definition, next);
      controller.setLocalDraft(cacheKey, cache(draft, JSON.stringify(safe)));
      const result = await controller.execute({ kind: "property.patch", propertyId: definition.id, value: safe }, { localDraftId: cacheKey });
      if (settleDraft(result, safe) || !mounted.current) return;
      if (result.status === "committed") setMessage("保存を確認しました。後の入力は保持しています");
      else setMessage(result.status === "unknown" || result.status === "pending" ? "保存結果が不明です。再送せず結果を照会してください" : "保存できませんでした。入力を保持しています");
    } catch (error) { if (mounted.current) setMessage(error instanceof Error ? error.message : "入力を確認してください"); }
  };
  const pick = async (): Promise<void> => {
    if (blocked || stale || !canPatch || !adapter) return;
    const priorCache = controller.getState().localDrafts[cacheKey];
    pickerPriorCache.current = priorCache;
    controller.setLocalDraft(cacheKey, priorCache ?? cache(draft));
    const abort = new AbortController(); pickerController.current = abort; setPicking(true); setMessage("");
    try {
      const result = await adapter.pick({ definition, value: base.value, signal: abort.signal });
      if (!mounted.current || abort.signal.aborted) return;
      // A host picker supplies only a draft; explicit save still performs the named-field CAS.
      if (result !== undefined) { const safe = validateNotesDatabasePropertyValue(definition, result); storeDraft(JSON.stringify(safe)); }
      else controller.setLocalDraft(cacheKey, priorCache);
    } catch (error) { if (mounted.current && !abort.signal.aborted) setMessage(error instanceof Error ? error.message : "選択できませんでした"); }
    finally { if (mounted.current && pickerController.current === abort) setPicking(false); }
  };
  const action = async (): Promise<void> => {
    if (blocked || stale || !canAction) return;
    try {
      const result = await controller.execute({ kind: "database.action", databaseId: props.databaseId, rowId: props.rowId, actionId: definition.config!.actionId as string });
      if (!mounted.current) return;
      setMessage(result.status === "committed" ? "操作を確認しました" : "操作を確認できませんでした。再実行前に結果を確認してください");
      if (result.status === "committed") { setBase({ revision: result.snapshot.revision, definition: JSON.stringify(definition), value }); props.onCommitted?.(result); }
    } catch (error) { if (mounted.current) setMessage(error instanceof Error ? error.message : "操作できませんでした"); }
  };
  const label = `${definition.name}の値`, disabled = inputBlocked || !canPatch;
  let control;
  if (!writable) control = <output aria-label={label}>{typeof value === "string" ? value : JSON.stringify(value)}</output>;
  else if (authority === "host-picker") control = <><output aria-label={label}>{draft}</output><button type="button" disabled={disabled || stale} onClick={() => void pick()}>選択する</button>{picking ? <button type="button" onClick={() => { pickerController.current?.abort(); controller.setLocalDraft(cacheKey, pickerPriorCache.current); setPicking(false); }}>選択をキャンセル</button> : null}</>;
  else if (definition.type === "checkbox") control = <select aria-label={label} value={draft} disabled={disabled} onChange={event => storeDraft(event.target.value)}><option value="null">未設定</option><option value="true">チェック済み</option><option value="false">未チェック</option>{!["null", "true", "false"].includes(draft) ? <option value={draft}>不明な値を保持</option> : null}</select>;
  else if (definition.type === "select" || definition.type === "status") control = <select aria-label={label} value={draft} disabled={disabled} onChange={event => storeDraft(event.target.value)}><option value="">未設定</option>{definition.options?.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}{draft && !definition.options?.some(option => option.id === draft) ? <option value={draft}>不明な値を保持: {draft}</option> : null}</select>;
  else if (definition.type === "text" || definition.type === "multi_select") control = <textarea aria-label={label} value={draft} disabled={disabled} onChange={event => storeDraft(event.target.value)} />;
  else control = <input aria-label={label} value={draft} inputMode={definition.type === "number" ? "decimal" : undefined} disabled={disabled} onChange={event => storeDraft(event.target.value)} />;
  return <form aria-label={`${definition.name}の編集`} onCompositionStart={() => { composing.current = true; controller.setComposing(true); }} onCompositionEnd={() => { composing.current = false; controller.setComposing(false); }} onSubmit={event => { event.preventDefault(); void resolve(); }} onKeyDown={event => { if (event.key === "Escape" && !event.nativeEvent.isComposing && event.keyCode !== 229 && canCancel) { event.stopPropagation(); reset(); props.onCancel?.(); } }}>
    <label>{definition.name} <small>{isNotesDatabasePropertyKind(definition.type) ? NOTES_DATABASE_PROPERTY_LABELS[definition.type] : definition.type}</small>{control}</label>
    {authority === "unknown" ? <p>未対応の定義と値をそのまま保持しています</p> : authority === "host-computed" ? <p>ホストが管理する値です</p> : authority === "host-picker" && !adapter ? <p>選択用のホスト接続が必要です</p> : null}
    {stale ? <p role="status">別の変更を検出しました。入力を保持しています</p> : null}
    {canPatch || canAction ? <small>保存方式: {snapshot?.capabilitySemantics[canAction ? "database.action" : "property.patch"] ?? "未接続"}</small> : null}
    {writable ? <><button type="submit" disabled={blocked || stale || !canPatch}>確認して保存</button><button type="button" disabled={!canCancel} onClick={reset}>最新値に戻す</button></> : null}
    {authority === "action" ? <><button type="button" disabled={blocked || stale || !canAction} onClick={() => void action()}>{typeof definition.config?.label === "string" ? definition.config.label : "操作を確認して実行"}</button>{stale ? <button type="button" disabled={!canCancel} onClick={reset}>最新値に戻す</button> : null}</> : null}
    {state.status === "unknown" ? <button type="button" onClick={() => { const envelope = controller.getState().localDrafts[cacheKey]; let next: JsonValue | undefined; try { if (envelope && typeof envelope === "object" && !Array.isArray(envelope) && typeof envelope.source === "string") next = JSON.parse(envelope.source) as JsonValue; } catch { /* Invalid draft is kept. */ } void controller.reconcile().then(result => { if (next !== undefined) settleDraft(result, next); }).catch(error => { if (mounted.current) setMessage(String(error)); }); }}>保存結果を照会</button> : null}
    <p role="status">{message}</p>
  </form>;
}
