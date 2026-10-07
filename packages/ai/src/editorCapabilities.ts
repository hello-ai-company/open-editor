import type { EditorDocument, JsonValue } from "@hello-ai-company/editor-core";
import { cloneJsonValue, requireExactKeys, requireRecord, requireString, requireStringArray, requireId } from "./validation.js";

export const AGENT_EDITOR_OPERATIONS = ["heading", "bulletListItem", "title", "placement", "link.add", "link.edit", "link.remove"] as const;
export type AgentEditorOperation = typeof AGENT_EDITOR_OPERATIONS[number];
/** Installed schema is informational. Only bound, permitted operations can be proposed or executed. */
export type AgentEditorCapabilities = {
  revision: string; featureIds: string[]; blockTypes: string[]; inlineTypes: string[]; styleTypes: string[]; commandIds: string[];
  operations: AgentEditorOperation[];
};
export function parseAgentEditorCapabilities(value: unknown): AgentEditorCapabilities {
  const r = requireRecord(cloneJsonValue(value, "capabilities"), "capabilities");
  requireExactKeys(r, ["revision", "featureIds", "blockTypes", "inlineTypes", "styleTypes", "commandIds", "operations"], "capabilities");
  requireString(r.revision, "capability revision", 256);
  for (const k of ["featureIds", "blockTypes", "inlineTypes", "styleTypes", "commandIds", "operations"]) {
    r[k] = requireStringArray(r[k], k, 256);
    if (new Set(r[k] as string[]).size !== (r[k] as string[]).length) throw new Error(`Duplicate ${k}`);
  }
  for (const op of r.operations as string[]) {
    if (!(AGENT_EDITOR_OPERATIONS as readonly string[]).includes(op)) throw new Error("Unbound editor operation");
    if (["heading", "bulletListItem"].includes(op) && !(r.blockTypes as string[]).includes(op)) throw new Error("Missing block capability");
    if (op.startsWith("link.") && !(r.inlineTypes as string[]).includes("link")) throw new Error("Missing inline capability");
  }
  return r as unknown as AgentEditorCapabilities;
}
export type AgentNoteAssistance = {
  capabilities: AgentEditorCapabilities;
  selection: { revision: string; blockIds: string[] };
  proposalsAllowed: boolean; autoLinks: boolean;
};
export function parseAgentNoteAssistance(value: unknown): AgentNoteAssistance {
  const r = requireRecord(cloneJsonValue(value, "assistance"), "assistance");
  requireExactKeys(r, ["capabilities", "selection", "proposalsAllowed", "autoLinks"], "assistance");
  r.capabilities = parseAgentEditorCapabilities(r.capabilities) as unknown as JsonValue;
  const selection = requireRecord(r.selection, "selection"); requireExactKeys(selection, ["revision", "blockIds"], "selection");
  requireString(selection.revision, "selection revision", 256); selection.blockIds = requireStringArray(selection.blockIds, "selection block IDs", 1000);
  for (const id of selection.blockIds as string[]) requireId(id, "selection block ID");
  if (new Set(selection.blockIds as string[]).size !== (selection.blockIds as string[]).length) throw new Error("Duplicate selection block ID");
  if (typeof r.proposalsAllowed !== "boolean" || typeof r.autoLinks !== "boolean") throw new Error("Explicit assistance permissions required");
  return r as unknown as AgentNoteAssistance;
}
export type AgentLinkEdit = { blockId: string; index: number; action: "add" | "edit" | "remove"; start?: number; end?: number; href?: string; label?: string };
export function parseAgentLinkEdits(value: unknown): AgentLinkEdit[] {
  if (!Array.isArray(value) || value.length > 32) throw new Error("Bounded link operations required");
  const seen = new Set<string>();
  return value.map(v => {
    const r = requireRecord(cloneJsonValue(v, "link"), "link"); requireExactKeys(r, ["blockId", "index", "action", "start", "end", "href", "label"], "link");
    requireId(r.blockId, "link block ID"); if (!Number.isInteger(r.index) || (r.index as number) < 0) throw new Error("Invalid inline index");
    const id = `${r.blockId}:${r.index}`; if (seen.has(id)) throw new Error("Overlapping link edits"); seen.add(id);
    if (!["add", "edit", "remove"].includes(r.action as string)) throw new Error("Unsupported link action");
    if (r.action === "add") { if (!Number.isInteger(r.start) || !Number.isInteger(r.end) || (r.start as number) < 0 || (r.end as number) <= (r.start as number) || r.label !== undefined) throw new Error("Invalid link range"); }
    else if (r.start !== undefined || r.end !== undefined) throw new Error("Unexpected link range");
    if (r.action === "remove" ? r.href !== undefined || r.label !== undefined : typeof r.href !== "string") throw new Error("Invalid link fields");
    if (r.href !== undefined) requireString(r.href, "link href", 2048);
    if (r.label !== undefined) requireString(r.label, "link label", 256);
    return r as unknown as AgentLinkEdit;
  });
}
/** No fetch, navigation, validation claim or tracking. Only absolute http(s) and scoped page IDs. */
export function safeAgentLink(value: string, pages: readonly { id: string }[]): string {
  requireString(value, "link", 2048);
  if (/[\u0000-\u0020\u007f\\]/.test(value)) throw new Error("Unsafe link characters");
  if (value.startsWith("oe-page:")) { const id = requireId(value.slice(8), "page link ID"); if (!pages.some(p => p.id === id)) throw new Error("Unknown internal page"); return value; }
  if (!/^https?:\/\//i.test(value)) throw new Error("Absolute HTTP URL required");
  const u = new URL(value);
  if (!["http:", "https:"].includes(u.protocol) || u.username || u.password || !u.hostname) throw new Error("Unsafe link scheme or credentials");
  return u.href;
}
type Page = { id: string; title: string; scope: string; sharing: string; editable: boolean };
/** Only known text/link inline shapes are touched; preserve styles, IDs, order and unknown fields. */
export function applyAgentLinkEdits(document: EditorDocument, edits: AgentLinkEdit[], pages: readonly Page[], own: Page): { document: EditorDocument; needsConfirmation: boolean } {
  const result = structuredClone(document); let needsConfirmation = false;
  const permitted = pages.filter(p => p.editable && p.scope === own.scope && p.sharing === own.sharing);
  const grounded = new Set<string>();
  const collect = (v: JsonValue | undefined) => {
    if (typeof v === "string") { for (const match of v.matchAll(/https?:\/\/[^\s<>"'）)]+/g)) { try { grounded.add(safeAgentLink(match[0], permitted)); } catch { /* unsafe context is never authority */ } } }
    else if (Array.isArray(v)) for (const x of v) collect(x);
    else if (v && typeof v === "object") { if (v.type === "text") collect(v.text); else if (v.type === "link") { if (typeof v.href === "string") { try { grounded.add(safeAgentLink(v.href, permitted)); } catch { /* leave original untouched */ } } collect(v.content); } }
  };
  for (const b of document.blocks) if (["paragraph", "heading", "bulletListItem", "numberedListItem"].includes(b.type) && !b.children?.length) collect(b.content);
  for (const edit of [...edits].sort((a, b) => b.index - a.index)) {
    const b = result.blocks.find(x => x.id === edit.blockId);
    if (!b || !["paragraph", "heading", "bulletListItem", "numberedListItem"].includes(b.type) || b.children?.length || !Array.isArray(b.content)) throw new Error("Opaque link target");
    const node = requireRecord(b.content[edit.index], "inline target");
    if (edit.action === "remove") {
      if (node.type !== "link" || typeof node.href !== "string" || !Array.isArray(node.content) || !node.content.every(x => x && typeof x === "object" && !Array.isArray(x) && x.type === "text" && typeof x.text === "string") || Object.keys(node).some(k => !["type", "href", "content"].includes(k))) throw new Error("Opaque link removal");
      b.content.splice(edit.index, 1, ...structuredClone(node.content) as JsonValue[]); needsConfirmation = true; continue;
    }
    const href = safeAgentLink(edit.href!, permitted), internal = href.startsWith("oe-page:") ? permitted.find(p => p.id === href.slice(8)) : undefined;
    if (!internal && !grounded.has(href)) throw new Error("Ungrounded URL");
    if (edit.action === "add") {
      if (node.type !== "text" || typeof node.text !== "string" || edit.end! > node.text.length) throw new Error("Invalid text range");
      const selected = node.text.slice(edit.start!, edit.end!);
      if (internal ? selected !== internal.title : safeAgentLink(selected, permitted) !== href) throw new Error("Link label is not grounded");
      const nodes: JsonValue[] = [];
      if (edit.start) nodes.push({ ...node, text: node.text.slice(0, edit.start) } as JsonValue);
      nodes.push({ type: "link", href, content: [{ ...node, text: selected } as JsonValue] });
      if (edit.end! < node.text.length) nodes.push({ ...node, text: node.text.slice(edit.end) } as JsonValue);
      b.content.splice(edit.index, 1, ...nodes);
      if (internal) needsConfirmation = true;
    } else {
      if (node.type !== "link" || typeof node.href !== "string" || !Array.isArray(node.content)) throw new Error("Invalid link edit");
      let old: string | undefined; try { old = safeAgentLink(node.href, permitted); } catch { /* correction still needs approval */ }
      if (old !== href || edit.label !== undefined) needsConfirmation = true;
      node.href = href;
      if (edit.label !== undefined) {
        if (!internal || edit.label !== internal.title || node.content.length !== 1) throw new Error("Ungrounded link label");
        const c = requireRecord(node.content[0], "link text"); if (c.type !== "text" || typeof c.text !== "string") throw new Error("Opaque link label");
        node.content = [{ ...c, text: edit.label }];
      }
    }
  }
  return { document: result, needsConfirmation };
}
