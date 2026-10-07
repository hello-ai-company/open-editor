import { useEffect, useState, useSyncExternalStore } from "react";
import type { JsonValue } from "@hello-ai-company/editor-core";
import { parseNotesDatabasePropertyDefinition, type NotesDatabaseSchemaSnapshot } from "@hello-ai-company/editor-blocknote";
import { NotesDatabaseProperties, NotesDatabaseSchema, type NotesWorkspacePreset } from "@hello-ai-company/editor-blocknote/react";

export type SyntheticNotesRowToolsProps = {
  preset: NotesWorkspacePreset;
  readSchema(databaseId: string, signal: AbortSignal): Promise<NotesDatabaseSchemaSnapshot>;
};
type SchemaRead = { databaseId: string; documentRevision: string; status: "loading" | "ready" | "error"; schema?: NotesDatabaseSchemaSnapshot };
/** Synthetic demo composition uses the installed public UI. It does not create an asset/user
 * provider, execute a calculation or advertise persistence beyond the host's capabilities. */
export function SyntheticNotesRowTools({ preset, readSchema }: SyntheticNotesRowToolsProps) {
  const { controller, host } = preset;
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
  const snapshot = state.snapshot, target = snapshot?.target;
  const databaseId = target?.kind === "row" ? target.databaseId : undefined;
  const [refresh, setRefresh] = useState(0), [read, setRead] = useState<SchemaRead>();
  useEffect(() => host.subscribe?.(() => setRefresh(value => value + 1)), [host]);
  useEffect(() => {
    if (!databaseId || !snapshot || state.composing || state.pendingEditors || state.status !== "ready") return;
    const abort = new AbortController(); let live = true;
    const documentRevision = snapshot.revision;
    setRead(previous => ({ databaseId, documentRevision, status: "loading", ...(previous?.databaseId === databaseId && previous.schema ? { schema: previous.schema } : {}) }));
    void readSchema(databaseId, abort.signal).then(value => {
      if (!value || typeof value.revision !== "string" || !value.revision || value.revision.length > 512 || !Array.isArray(value.properties) || value.properties.length > 256) throw new Error("Invalid synthetic schema");
      const properties = value.properties.map(parseNotesDatabasePropertyDefinition);
      if (new Set(properties.map(property => property.id)).size !== properties.length) throw new Error("Duplicate synthetic property identity");
      if (live && !abort.signal.aborted) setRead({ databaseId, documentRevision, status: "ready", schema: { revision: value.revision, properties } });
    }).catch(() => { if (live && !abort.signal.aborted) setRead(previous => ({ databaseId, documentRevision, status: "error", ...(previous?.databaseId === databaseId && previous.schema ? { schema: previous.schema } : {}) })); });
    return () => { live = false; abort.abort(); };
  }, [databaseId, snapshot?.revision, readSchema, refresh, state.composing, state.pendingEditors, state.status]);
  if (!databaseId || !snapshot || target?.kind !== "row") return null;
  const values = snapshot.metadata.properties;
  const validValues = values && typeof values === "object" && !Array.isArray(values);
  const current = read?.databaseId === databaseId && read.documentRevision === snapshot.revision;
  // Preserve a mounted draft during IME/pending edits. The controller enforces its original
  // revision and the host revalidates the latest schema; subscription events never reset inputs.
  const ready = current && read.status === "ready" && read.schema;
  const held = read?.databaseId === databaseId && read.schema && (state.pendingEditors || state.composing);
  const schema = ready ? read.schema : held ? read.schema : undefined;
  return <section className="oe-synthetic-row-tools" aria-label="合成データベース行のプロパティ">
    <header><h2>行のプロパティ</h2><small>合成データ · 接続済みの操作だけ利用できます</small></header>
    <p>作成・更新の記録、ID、計算結果、集計結果は読み取り専用です。ファイル・ユーザー・関連・位置の選択ツールは、このデモでは未接続です。</p>
    {!validValues ? <p role="alert">行の正規プロパティ値を確認できません。本文と保管済みの入力は保持しています。</p> : null}
    {read?.databaseId === databaseId && read.status === "error" ? <p role="alert">プロパティ定義を読み込めませんでした。既存の下書きは保持しています。<button type="button" disabled={state.composing || state.pendingEditors || state.status !== "ready"} onClick={() => setRefresh(value => value + 1)}>定義を再読込み</button></p> : null}
    {!schema ? <p role="status">{read?.databaseId === databaseId && read.status === "error" ? "編集には定義の再確認が必要です" : "プロパティ定義を確認しています"}</p> : null}
    {schema && validValues ? <>
      <NotesDatabaseProperties databaseId={databaseId} rowId={target.rowId} definitions={schema.properties} values={values as Record<string, JsonValue>} controller={controller} />
      <details><summary>プロパティの設定</summary><NotesDatabaseSchema databaseId={databaseId} schema={schema} controller={controller} /></details>
    </> : null}
  </section>;
}
