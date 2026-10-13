import type { ReactNode } from "react";
import type { EditorDocument } from "@hello-ai-company/editor-core";

type Node = EditorDocument["blocks"][number];
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
/** Read-only, text-only projection. Never executes HTML, media URLs or widget payloads. */
export function readableBlockText(block: Node): string {
  const text = (value: unknown): string => {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.map(text).join("");
    if (!record(value)) return "";
    if (typeof value.text === "string") return value.text;
    if (value.type === "link") return text(value.content);
    if (Array.isArray(value.rows)) return (value.rows as unknown[]).map(row => record(row) && Array.isArray(row.cells) ? row.cells.map(cell => record(cell) && "content" in cell ? text(cell.content) : text(cell)).join(" | ") : "").join("\n");
    return "";
  };
  const value = text(block.content);
  if (value) return value;
  for (const key of ["text", "caption", "title", "titleHint", "name", "body"]) {
    const item = block.props?.[key];
    if (typeof item === "string" && item) return item;
  }
  return "";
}
export function ReadableDocument({ document, label, title }: { document: EditorDocument; label: string; title?: string }) {
  const render = (block: Node, depth: number): ReactNode => <li key={block.id} style={{ marginBlock: ".45rem", listStyle: "none" }}>
    <small>{block.type}{block.type === "checkListItem" ? (block.props?.checked ? " · ☑" : " · ☐") : ""}</small>
    {block.type === "callout" ? <div><strong>{String(block.props?.title ?? '')}</strong><small> · {String(block.props?.variant ?? 'info')}</small></div> : null}
    {block.type === "oeColumns" ? <small>Columns: {block.children?.length ?? 0} · gap {String(block.props?.gap ?? 16)}px</small> : null}
    {block.type === "oeColumn" ? <small>Relative width: {String(block.props?.width ?? 1)}</small> : null}
    <div style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{readableBlockText(block) || "［本文のないブロック。書式・参照・データはそのまま保持］"}</div>
    {block.children?.length && depth < 32 ? <ul style={{ paddingInlineStart: "1rem" }}>{block.children.map(child => render(child, depth + 1))}</ul> : null}
  </li>;
  return <section aria-label={label}><h4>{label}</h4>{title !== undefined ? <div aria-label={`${label}のタイトル`}><strong>タイトル</strong><p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{title === "" ? "［タイトルなし］" : title}</p></div> : null}{document.blocks.length ? <ul style={{ padding: 0 }}>{document.blocks.map(block => render(block, 0))}</ul> : <p>［本文なし］</p>}</section>;
}
export function ReadableDocumentComparison({ before, after, beforeTitle, afterTitle, beforeLabel = "保持している入力", afterLabel = "最新の保存内容" }: { before: EditorDocument; after: EditorDocument; beforeTitle?: string; afterTitle?: string; beforeLabel?: string; afterLabel?: string }) {
  return <div className="oe-notes-readable-comparison" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,18rem),1fr))", gap: "1rem" }}><ReadableDocument document={before} label={beforeLabel} title={beforeTitle} /><ReadableDocument document={after} label={afterLabel} title={afterTitle} /></div>;
}
/** Each choice copies the entire root, including all unknown fields and descendants. */
export function mergeComparedDocuments(local: EditorDocument, latest: EditorDocument, choices: Record<string, "local" | "latest">, order: "local" | "latest"): EditorDocument {
  const first = order === "local" ? local : latest, second = order === "local" ? latest : local;
  const ids = [...new Set([...first.blocks, ...second.blocks].map(block => block.id))];
  const left = new Map(local.blocks.map(block => [block.id, block])), right = new Map(latest.blocks.map(block => [block.id, block]));
  const blocks = ids.flatMap(id => {
    const chosen = (choices[id] === "latest" ? right : left).get(id);
    return chosen ? [structuredClone(chosen)] : [];
  });
  const seen = new Set<string>();
  const visit = (nodes: Node[]) => {for(const node of nodes){if(seen.has(node.id))throw Error("移動したブロックが両方に含まれています。親と子を同じ側から選び直してください。");seen.add(node.id);if(node.children)visit(node.children);}};
  visit(blocks);
  return { ...structuredClone(local), blocks };
}
