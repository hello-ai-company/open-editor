import type { NotesInsertKind } from "./notesWorkspacePanels.js";

export const NOTES_TOOL_DRAG_MIME = "application/x-openeditor-notes-tool";
type ToolDrag = { version: 1; token: string; identity: string; kind: NotesInsertKind };
let active: ToolDrag | undefined;
const listeners = new Set<() => void>();
const notify = () => { for (const listener of listeners) listener(); };
export function subscribeNotesToolDrags(listener: () => void): () => void { listeners.add(listener); return () => { listeners.delete(listener); }; }
/** In-memory token prevents untrusted external/text drops from becoming editor commands. */
export function beginNotesToolDrag(identity: string, kind: NotesInsertKind): string {
  active = { version: 1, token: crypto.randomUUID(), identity, kind };
  notify();
  return JSON.stringify(active);
}
export function currentNotesToolDrag(identity: string): ToolDrag | undefined { return active?.identity === identity ? active : undefined; }
export function consumeNotesToolDrag(value: string, identity: string): NotesInsertKind | undefined {
  if (!active || active.identity !== identity || value !== JSON.stringify(active)) return undefined;
  const kind = active.kind; active = undefined; notify(); return kind;
}
export function endNotesToolDrag(value?: string): void { if (value === undefined || value === JSON.stringify(active)) { active = undefined; notify(); } }

export type NotesInsertionAnchor = { blockId: string; placement: "before" | "after" };
/** Direct block hit wins; whitespace resolves to the nearest block without using the old caret. */
export function notesDropAnchor(root: HTMLElement, target: EventTarget | null, x: number, y: number): NotesInsertionAnchor | undefined {
  let direct = target instanceof Element ? target.closest<HTMLElement>(".bn-block-outer[data-id]") : null;
  // Columns' structural children cannot accept arbitrary siblings. Resolve a
  // column's empty/header space to an actual block boundary inside that column.
  const isColumn = (node: Element): boolean => node.querySelector("[data-content-type]")?.getAttribute("data-content-type") === "oeColumn";
  if (direct && isColumn(direct)) {
    direct = [...direct.querySelectorAll<HTMLElement>(".bn-block-outer[data-id]")].filter(node => !isColumn(node)).sort((a, b) => {
      const distance = (node: HTMLElement) => { const r = node.getBoundingClientRect(); return Math.max(r.top - y, y - r.bottom, 0) * 2 + Math.max(r.left - x, x - r.right, 0); };
      return distance(a) - distance(b);
    })[0] ?? null;
  }
  const blocks = direct && root.contains(direct) ? [direct] : [...root.querySelectorAll<HTMLElement>(".bn-block-outer[data-id]")].filter(block => {
    const rect = block.getBoundingClientRect(); return rect.width > 0 && rect.height > 0;
  }).sort((a, b) => {
    const distance = (node: HTMLElement) => { const r = node.getBoundingClientRect(); return Math.max(r.top - y, y - r.bottom, 0) * 2 + Math.max(r.left - x, x - r.right, 0); };
    return distance(a) - distance(b);
  });
  const block = blocks[0], rect = block?.getBoundingClientRect(), blockId = block?.dataset.id;
  return rect && blockId ? { blockId, placement: y < rect.top + rect.height / 2 ? "before" : "after" } : undefined;
}
