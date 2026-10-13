import { useEffect, useRef, useState } from "react";
import { isJsonValue, type JsonValue } from "@hello-ai-company/editor-core";
import type { NotesScope, NotesTarget } from "../notes/contracts.js";
import { NotesOverlayPortal } from "./NotesOverlayPortal.js";
import { useDialogFocusTrap } from "./useDialogFocusTrap.js";
import { notesIsComposing } from "./notesWorkspacePanels.js";

export type NotesDatabaseNavigationItem = { id: string; title: string };
export type NotesDatabaseNavigationPage = {
  scope: NotesScope; databaseId: string; revision: string;
  columns: readonly { id: string; title: string }[];
  rows: readonly { id: string; title: string; values: Readonly<Record<string, JsonValue>> }[];
  total?: number; nextCursor?: string;
};
export type NotesDatabaseNavigationHost = {
  /** Host authorizes the projection, cursor and target; private fields never enter UI. */
  read(request: { scope: NotesScope; databaseId: string; cursor?: string; signal: AbortSignal }): Promise<NotesDatabaseNavigationPage>;
};
export type NotesDatabaseExplorerProps = {
  scope: NotesScope; databases: readonly NotesDatabaseNavigationItem[];
  host?: NotesDatabaseNavigationHost; blocked?: boolean;
  onOpen(target: NotesTarget): Promise<boolean>;
};
export function NotesDatabaseExplorer(props: NotesDatabaseExplorerProps) {
  return <section className="oe-notes-database-explorer" aria-label="データベースの一覧"><h3>データベース</h3>{props.databases.map(database => <Database key={JSON.stringify([props.scope.actorId, props.scope.workspaceId, database.id])} {...props} database={database} />)}{!props.databases.length ? <p>データベースはありません</p> : null}</section>;
}
function valueText(value: JsonValue | undefined): string {
  if (value === undefined || value === null) return "—";
  const text = typeof value === "string" ? value : Array.isArray(value) ? value.map(item => typeof item === "string" ? item : JSON.stringify(item)).join(", ") : JSON.stringify(value);
  return text.length > 2048 ? text.slice(0, 2048) + "…" : text;
}
function Database(props: NotesDatabaseExplorerProps & { database: NotesDatabaseNavigationItem }) {
  const [expanded, setExpanded] = useState(false), [page, setPage] = useState<NotesDatabaseNavigationPage>(), [loading, setLoading] = useState(false), [message, setMessage] = useState("");
  const [preview, setPreview] = useState(false), flight = useRef<AbortController | undefined>(undefined), opening = useRef(false), mounted = useRef(true);
  const dialog = useRef<HTMLDivElement>(null), opener = useRef<HTMLButtonElement>(null);
  useDialogFocusTrap(preview, dialog);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; flight.current?.abort(); }; }, []);
  useEffect(() => { flight.current?.abort(); flight.current = undefined; setLoading(false); setPage(undefined); setPreview(false); }, [props.host]);
  const read = async (cursor?: string) => {
    if (flight.current || !props.host || props.blocked) return;
    const abort = new AbortController(), captured = page; flight.current = abort; setLoading(true); setMessage("");
    try {
      const next = await props.host.read({ scope: props.scope, databaseId: props.database.id, cursor, signal: abort.signal });
      if (!mounted.current || flight.current !== abort || abort.signal.aborted) return;
      if (next.scope.actorId !== props.scope.actorId || next.scope.workspaceId !== props.scope.workspaceId || next.databaseId !== props.database.id || typeof next.revision !== "string" || !next.revision || !Array.isArray(next.rows) || !Array.isArray(next.columns) || next.rows.length > 100 || next.columns.length > 256 || new Set(next.rows.map(row => row.id)).size !== next.rows.length || new Set(next.columns.map(column => column.id)).size !== next.columns.length || next.columns.some(column => typeof column.id !== "string" || !column.id || typeof column.title !== "string") || next.rows.some(row => typeof row.id !== "string" || !row.id || typeof row.title !== "string" || !row.values || Array.isArray(row.values) || typeof row.values !== "object" || !isJsonValue(row.values)) || next.nextCursor !== undefined && (typeof next.nextCursor !== "string" || !next.nextCursor || next.nextCursor.length > 4096) || next.total !== undefined && (!Number.isInteger(next.total) || next.total < next.rows.length)) throw new Error("Invalid database projection");
      if (cursor && captured?.revision !== next.revision) { setMessage("一覧が変更されました。再読み込みしてください"); return; }
      if (cursor && next.nextCursor === cursor) throw new Error("Repeated database cursor");
      const rows = cursor && captured ? [...captured.rows, ...next.rows.filter(row => !captured.rows.some(old => old.id === row.id))] : next.rows;
      if (next.total !== undefined && next.total < rows.length) throw new Error("Invalid total");
      setPage({ ...next, rows });
    } catch { if (mounted.current && !abort.signal.aborted) setMessage("行を読み込めませんでした。本文は保持しています"); }
    finally { if (flight.current === abort) { flight.current = undefined; if (mounted.current) setLoading(false); } }
  };
  const close = () => { setPreview(false); opener.current?.focus({ preventScroll: true }); };
  const open = (rowId: string) => {
    if (props.blocked || opening.current) return;
    opening.current = true;
    void props.onOpen({ kind: "row", databaseId: props.database.id, rowId }).then(success => { if (mounted.current) { if (success) close(); else setMessage("入力と保存状態を確認してから開いてください"); } }).catch(() => { if (mounted.current) setMessage("行を開けませんでした"); }).finally(() => { opening.current = false; });
  };
  return <div className="oe-notes-database-node"><header><button type="button" aria-expanded={expanded} disabled={props.blocked} onClick={() => { setExpanded(value => !value); if (!expanded && !page) void read(); }}>▦ {props.database.title}</button><button type="button" aria-label={props.database.title + "のプレビュー"} ref={opener} disabled={props.blocked || !props.host} onClick={() => { setPreview(true); if (!page) void read(); }}>プレビュー</button></header>
    {!props.host ? <p>行プロバイダーは接続されていません</p> : null}
    {expanded ? <div><small>読込済み {page?.rows.length ?? 0}件{page?.total === undefined ? " · 総件数は未取得" : ` / 全${page.total}件`}</small><ul>{page?.rows.map(row => <li key={row.id}><button type="button" disabled={props.blocked} onClick={() => open(row.id)}>{row.title || row.id}</button></li>)}</ul>{page && !page.rows.length && !loading ? <p>行はありません</p> : null}{page?.nextCursor ? <button type="button" disabled={loading || props.blocked} onClick={() => void read(page.nextCursor)}>続きを読み込む</button> : null}<button type="button" disabled={loading || props.blocked} onClick={() => void read()}>再読み込み</button></div> : null}
    {preview ? <NotesOverlayPortal anchor={opener.current} onDismiss={close}><div role="dialog" aria-modal="true" aria-label={props.database.title + "のプレビュー"} className="oe-notes-database-preview" tabIndex={-1} ref={dialog} onKeyDown={event => { if (event.key === "Escape" && !notesIsComposing(event)) { event.stopPropagation(); event.preventDefault(); close(); } }}><header><h3>{props.database.title}</h3><button type="button" onClick={close}>閉じる</button></header><p>許可された列と行の抜粋 · 最大8行・5列</p><div className="oe-notes-database-preview-scroll"><table><thead><tr><th>行</th>{page?.columns.slice(0, 5).map(column => <th key={column.id}>{column.title}</th>)}</tr></thead><tbody>{page?.rows.slice(0, 8).map(row => <tr key={row.id}><th><button type="button" disabled={props.blocked} onClick={() => open(row.id)}>{row.title || row.id}</button></th>{page.columns.slice(0, 5).map(column => <td key={column.id}>{valueText(row.values[column.id])}</td>)}</tr>)}</tbody></table></div>{page && !page.rows.length ? <p>行はありません</p> : null}{message ? <p role="status">{message}</p> : null}{loading ? <p role="status">読み込んでいます</p> : null}</div></NotesOverlayPortal> : null}
    {loading ? <p role="status">読み込んでいます</p> : null}{message ? <p role="status">{message}</p> : null}
  </div>;
}
