import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { JsonValue } from "@hello-ai-company/editor-core";
import type { NotesCommand, NotesCommandOutcome, NotesWorkspaceController } from "../notes/contracts.js";
import { NOTES_DATABASE_PROPERTY_KINDS, NOTES_DATABASE_PROPERTY_LABELS, isNotesDatabasePropertyKind, parseNotesDatabasePropertyDefinition, type NotesDatabasePropertyDefinition, type NotesDatabaseSchemaSnapshot } from "../notes/propertyCatalog.js";

export type NotesDatabaseSchemaProps = {
  databaseId: string; schema: NotesDatabaseSchemaSnapshot; controller: NotesWorkspaceController;
  onCommitted?(result: Extract<NotesCommandOutcome, { status: "committed" }>): void;
};
type SchemaDraftPresentation = { selected: string; id: string; name: string; type: string; options: string; config: string; readOnly: boolean; schemaRevision: string; documentRevision: string };
function cachedSchema(controller: NotesWorkspaceController, cacheKey: string): SchemaDraftPresentation | undefined {
  const envelope = controller.getState().localDrafts[cacheKey];
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope) || !envelope.presentation || typeof envelope.presentation !== "object" || Array.isArray(envelope.presentation)) return undefined;
  const value = envelope.presentation;
  if (["selected", "id", "name", "type", "options", "config", "schemaRevision", "documentRevision"].some(key => typeof value[key] !== "string") || typeof value.readOnly !== "boolean") return undefined;
  return value as unknown as SchemaDraftPresentation;
}
function schemaCacheKey(databaseId: string, controller: NotesWorkspaceController): string { return JSON.stringify(["notes-schema", databaseId, controller.getState().snapshot?.target ?? null]); }
/** Each operation names its reviewed schema revision. No row values or unknown fields are replaced. */
export function NotesDatabaseSchema(props: NotesDatabaseSchemaProps) {
  const state = useSyncExternalStore(props.controller.subscribe, props.controller.getState, props.controller.getState);
  const key = JSON.stringify([props.databaseId, state.snapshot?.target ?? null]);
  return <DatabaseSchemaContext key={key} {...props} />;
}
function DatabaseSchemaContext(props: NotesDatabaseSchemaProps) {
  const { schema, controller, databaseId } = props;
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
  const cacheKey = schemaCacheKey(databaseId, controller);
  const [selected, setSelected] = useState<string | undefined>(() => cachedSchema(controller, cacheKey)?.selected), [remove, setRemove] = useState<string | undefined>();
  const [message, setMessage] = useState(""); const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const blocked = state.status !== "ready" || state.dirty || state.composing || state.pendingEditors;
  const supported = (kind: NotesCommand["kind"]): boolean => !blocked && state.snapshot?.capabilities.includes(kind) === true;
  const run = async (command: NotesCommand): Promise<void> => {
    if (!supported(command.kind)) return;
    try {
      const result = await controller.execute(command);
      if (!mounted.current) return;
      if (result.status === "committed") { setMessage("保存を確認しました"); setRemove(undefined); props.onCommitted?.(result); }
      else setMessage(result.status === "unknown" || result.status === "pending" ? "保存結果が不明です。再送せず結果を照会してください" : "保存できませんでした。定義を保持しています");
    } catch (error) { if (mounted.current) setMessage(error instanceof Error ? error.message : "変更できませんでした"); }
  };
  const reorder = (index: number, direction: -1 | 1): void => {
    const destination = index + direction;
    if (destination < 0 || destination >= schema.properties.length) return;
    const propertyIds = schema.properties.map(property => property.id);
    [propertyIds[index], propertyIds[destination]] = [propertyIds[destination]!, propertyIds[index]!];
    void run({ kind: "schema.reorder-properties", databaseId, propertyIds, expectedSchemaRevision: schema.revision });
  };
  return <section className="oe-notes-database-schema" aria-label="データベースの設定">
    <h3>プロパティ</h3>
    <ol>{schema.properties.map((property, index) => <li key={property.id}>
      <span>{property.name} · {isNotesDatabasePropertyKind(property.type) ? NOTES_DATABASE_PROPERTY_LABELS[property.type] : property.type}</span>
      <button type="button" disabled={!supported("schema.update-property") || !isNotesDatabasePropertyKind(property.type)} onClick={() => { setSelected(property.id); setRemove(undefined); }}>設定: {property.name}</button>
      <button type="button" aria-label={`${property.name}を上へ`} disabled={index === 0 || !supported("schema.reorder-properties")} onClick={() => reorder(index, -1)}>上へ</button>
      <button type="button" aria-label={`${property.name}を下へ`} disabled={index === schema.properties.length - 1 || !supported("schema.reorder-properties")} onClick={() => reorder(index, 1)}>下へ</button>
      <button type="button" disabled={!supported("schema.delete-property")} onClick={() => { setRemove(property.id); setSelected(undefined); }}>削除: {property.name}</button>
      {!isNotesDatabasePropertyKind(property.type) ? <p>未対応の定義は変更せず保持しています</p> : null}
      {remove === property.id ? <div role="group" aria-label={`${property.name}の削除確認`}><p>このプロパティの削除をホストへ要求します。データ保持の方針はホストが確認します。</p><button type="button" disabled={!supported("schema.delete-property")} onClick={() => void run({ kind: "schema.delete-property", databaseId, propertyId: property.id, expectedSchemaRevision: schema.revision })}>確認して削除</button><button type="button" disabled={blocked} onClick={() => setRemove(undefined)}>キャンセル</button></div> : null}
    </li>)}</ol>
    <button type="button" disabled={!supported("schema.create-property")} onClick={() => { setSelected("\u0000new"); setRemove(undefined); }}>プロパティを追加</button>
    {selected !== undefined ? <SchemaDraft key={`${databaseId}:${selected}`} {...props} selected={selected} definition={schema.properties.find(property => property.id === selected)} onCancel={() => setSelected(undefined)} /> : null}
    {state.status === "unknown" ? <button type="button" onClick={() => { const hadCache = !!controller.getState().localDrafts[cacheKey]; void controller.reconcile().then(result => { if (mounted.current && result.status === "committed" && hadCache && !controller.getState().localDrafts[cacheKey]) { setSelected(undefined); props.onCommitted?.(result); } }).catch(error => { if (mounted.current) setMessage(String(error)); }); }}>保存結果を照会</button> : null}
    <p role="status">{message}</p>
  </section>;
}
function SchemaDraft({ databaseId, schema, controller, definition, selected, onCommitted, onCancel }: NotesDatabaseSchemaProps & { definition?: NotesDatabasePropertyDefinition; selected: string; onCancel(): void }) {
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
  const cacheKey = schemaCacheKey(databaseId, controller);
  const initial = (): SchemaDraftPresentation => ({ selected, id: definition?.id ?? "", name: definition?.name ?? "", type: definition?.type ?? "text", options: JSON.stringify(definition?.options ?? [], null, 2), config: JSON.stringify(definition?.config ?? {}, null, 2), readOnly: definition?.readOnly ?? false, schemaRevision: schema.revision, documentRevision: state.snapshot?.revision ?? "" });
  const [draft, setDraft] = useState<SchemaDraftPresentation>(() => cachedSchema(controller, cacheKey) ?? initial());
  const { id, name, type, options, config, readOnly, schemaRevision: baseRevision } = draft;
  const [message, setMessage] = useState(""); const mounted = useRef(true), composing = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; if (composing.current) controller.setComposing(false); }; }, [controller]);
  const kind = definition ? "schema.update-property" : "schema.create-property", stale = baseRevision !== schema.revision || draft.documentRevision !== state.snapshot?.revision;
  const inputDisabled = state.status !== "ready" || state.dirty || state.snapshot?.capabilities.includes(kind) !== true;
  const disabled = inputDisabled || state.composing;
  const canCancel = !["loading", "saving", "unknown"].includes(state.status) && !state.composing;
  const buildCommand = (fields: SchemaDraftPresentation): NotesCommand => {
    const reviewed = parseNotesDatabasePropertyDefinition({ ...(definition ?? {}), id: fields.id, name: fields.name, type: fields.type, readOnly: fields.readOnly, options: JSON.parse(fields.options), config: JSON.parse(fields.config) });
    const patch: Record<string, JsonValue> = { name: reviewed.name, type: reviewed.type, readOnly: reviewed.readOnly ?? false, options: reviewed.options as unknown as JsonValue, config: reviewed.config! };
    return definition ? { kind: "schema.update-property", databaseId, propertyId: definition.id, fields: patch, expectedSchemaRevision: fields.schemaRevision } : { kind: "schema.create-property", databaseId, definition: { id: reviewed.id, ...patch }, expectedSchemaRevision: fields.schemaRevision };
  };
  const store = (next: SchemaDraftPresentation): void => {
    setDraft(next);
    let command: NotesCommand | undefined;
    try { command = buildCommand(next); }
    catch { /* Invalid typed input stays in presentation without an executable command. */ }
    controller.setLocalDraft(cacheKey, { baseRevision: next.documentRevision, ...(command ? { command: command as unknown as JsonValue } : {}), presentation: next as unknown as JsonValue });
  };
  const reset = (): void => { setDraft(initial()); controller.setLocalDraft(cacheKey, undefined); setMessage(""); };
  const cancel = (): void => { controller.setLocalDraft(cacheKey, undefined); onCancel(); };
  const submit = async (): Promise<void> => {
    if (disabled || stale) return;
    try {
      const command = buildCommand(draft);
      if (!definition && schema.properties.some(property => property.id === id)) throw new Error("このプロパティIDは使用されています");
      controller.setLocalDraft(cacheKey, { baseRevision: draft.documentRevision, command: command as unknown as JsonValue, presentation: draft as unknown as JsonValue });
      const result = await controller.execute(command, { localDraftId: cacheKey });
      if (!mounted.current) return;
      if (result.status === "committed") { setMessage("保存を確認しました"); onCommitted?.(result); if (!controller.getState().localDrafts[cacheKey]) onCancel(); }
      else setMessage(result.status === "unknown" || result.status === "pending" ? "保存結果が不明です。再送せず結果を照会してください" : "保存できませんでした。設定の入力を保持しています");
    } catch (error) { if (mounted.current) setMessage(error instanceof Error ? error.message : "設定を確認してください"); }
  };
  return <form aria-label="プロパティの定義" onCompositionStart={() => { composing.current = true; controller.setComposing(true); }} onCompositionEnd={() => { composing.current = false; controller.setComposing(false); }} onSubmit={event => { event.preventDefault(); void submit(); }} onKeyDown={event => { if (event.key === "Escape" && !event.nativeEvent.isComposing && event.keyCode !== 229 && canCancel) { event.stopPropagation(); cancel(); } }}>
    <label>ID<input aria-label="プロパティID" value={id} disabled={inputDisabled || !!definition} onChange={event => store({ ...draft, id: event.target.value })} /></label>
    <label>名前<input aria-label="プロパティ名" value={name} disabled={inputDisabled} onChange={event => store({ ...draft, name: event.target.value })} /></label>
    <label>種類<select aria-label="プロパティの種類" value={type} disabled={inputDisabled} onChange={event => store({ ...draft, type: event.target.value })}>{NOTES_DATABASE_PROPERTY_KINDS.map(kind => <option key={kind} value={kind}>{NOTES_DATABASE_PROPERTY_LABELS[kind]}</option>)}</select></label>
    <label>選択肢<textarea aria-label="選択肢のJSON" value={options} disabled={inputDisabled} onChange={event => store({ ...draft, options: event.target.value })} /></label>
    <p>選択肢はid・label・任意のcolorを指定します。IDは値の参照に使用します。</p>
    <label>形式・計算・関連・操作の設定<textarea aria-label="プロパティ設定のJSON" value={config} disabled={inputDisabled} onChange={event => store({ ...draft, config: event.target.value })} /></label>
    <p>numberFormat / currency / dateFormat / expression / databaseId / relationPropertyId / targetPropertyId / aggregation / actionId / label。計算と操作はホストで確認します。</p>
    <label><input type="checkbox" checked={readOnly} disabled={inputDisabled} onChange={event => store({ ...draft, readOnly: event.target.checked })} />読取専用</label>
    {stale ? <p role="status">別の設定変更を検出しました。入力を保持しています</p> : null}
    <button type="submit" disabled={disabled || stale}>確認して保存</button><button type="button" disabled={!canCancel} onClick={reset}>最新の設定に戻す</button><button type="button" disabled={!canCancel} onClick={cancel}>キャンセル</button>
    <p role="status">{message}</p>
  </form>;
}
