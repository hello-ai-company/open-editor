import { createDocumentGripIcon } from "./controlGlyphs.js";
import { documentGutterIdentity } from "./gutterIdentity.js";
import { createExtension } from "@blocknote/core";
import { SideMenuExtension } from "@blocknote/core/extensions";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { createEditorDocument, type EditorDocument } from "@hello-ai-company/editor-core";
import { fromBlockNote } from "../adapter/fromBlockNote.js";
import { toBlockNoteForSchema } from "../adapter/toBlockNote.js";
import type { BlockLike } from "../types.js";
import { DOCUMENT_COLUMN_TYPE, DOCUMENT_COLUMNS_TYPE, locateDocumentBlock, moveDocumentBlock, type DocumentBlockMove } from "./columns.js";

type MoveEditor = {
  document: BlockLike[]; isEditable: boolean; schema: { blockSchema: Record<string, unknown> };
  prosemirrorView?: { dom: HTMLElement };
  transact(work: () => void): unknown; removeBlocks(blocks: string[]): unknown;
  insertBlocks(blocks: unknown[], anchor: string, placement: "before" | "after"): unknown;
  updateBlock(id: string, update: { children: BlockLike[] }): unknown;
};
/** One public transaction. Unrelated widgets are not replaced or remounted. */
export function applyDocumentBlockMove(editor: MoveEditor, action: DocumentBlockMove): void {
  if (!editor.isEditable) throw Error("Document is read-only");
  const before = fromBlockNote(editor.document), source = locateDocumentBlock(before, action.blockId), next = moveDocumentBlock(before, action);
  // Standalone source editors may have component-owned raw input. Never
  // remount their subtree while it is open, even when no Notes journal exists.
  const affected = [source.block.type === DOCUMENT_COLUMN_TYPE ? source.parent!.id : action.blockId, ...(action.placement.startsWith("inside-") ? [action.anchorId] : [])];
  if (editor.prosemirrorView && [...editor.prosemirrorView.dom.querySelectorAll<HTMLElement>(".bn-block-outer[data-id]")].some(el => affected.includes(el.dataset.id!) && el.querySelector(".oe-html-widget-editor,[data-oe-width-draft=true]"))) throw Error("Finish or cancel source editing before moving this widget. Your input is retained.");
  if (JSON.stringify(next.blocks) === JSON.stringify(before.blocks)) return;
  const converted = toBlockNoteForSchema(createEditorDocument([source.block]), editor.schema);
  editor.transact(() => {
    if (source.block.type === DOCUMENT_COLUMN_TYPE) {
      const group = locateDocumentBlock(next, source.parent!.id).block;
      const encoded = toBlockNoteForSchema(createEditorDocument([group]), editor.schema)[0]!;
      editor.updateBlock(group.id, { children: encoded.children as BlockLike[] });
    } else {
      editor.removeBlocks([action.blockId]);
      if (action.placement === "inside-start" || action.placement === "inside-end") {
        const column = locateDocumentBlock(next, action.anchorId).block;
        const encoded = toBlockNoteForSchema(createEditorDocument([column]), editor.schema)[0]!;
        editor.updateBlock(column.id, { children: (encoded.children ?? []) as BlockLike[] });
      } else editor.insertBlocks(converted, action.anchorId, action.placement);
    }
  });
}

export function documentBlockKeyboardMove(blocks: readonly BlockLike[], id: string, key: string): DocumentBlockMove | undefined {
  const doc = fromBlockNote(blocks), source = locateDocumentBlock(doc, id);
  if (source.block.type === DOCUMENT_COLUMN_TYPE) {
    const delta = key === "ArrowLeft" || key === "ArrowUp" ? -1 : key === "ArrowRight" || key === "ArrowDown" ? 1 : 0, target = source.siblings[source.index + delta];
    return delta && target ? { blockId: id, anchorId: target.id, placement: delta < 0 ? "before" : "after" } : undefined;
  }
  if ((key === "ArrowLeft" || key === "ArrowRight") && source.parent?.type === DOCUMENT_COLUMN_TYPE) {
    const column = locateDocumentBlock(doc, source.parent.id), destination = column.siblings[column.index + (key === "ArrowLeft" ? -1 : 1)];
    return destination ? { blockId: id, anchorId: destination.id, placement: "inside-end" } : undefined;
  }
  const delta = key === "ArrowUp" ? -1 : key === "ArrowDown" ? 1 : 0, target = source.siblings[source.index + delta];
  return delta && target ? { blockId: id, anchorId: target.id, placement: delta < 0 ? "before" : "after" } : undefined;
}

/** Explicit handles own pointer gestures, never widget backgrounds or controls.
 * The move is scoped to one mounted editor; no HTML/JSON/external drop is trusted. */
export const DocumentBlockMovement = createExtension(({ editor }) => ({
  key: "openeditor-document-block-movement",
  prosemirrorPlugins: [new Plugin({
    key: new PluginKey("openeditor-document-block-movement"),
    view(view) {
      const document = view.dom.ownerDocument, win = document.defaultView!;
      const handle = document.createElement("button"), groupHandle = document.createElement("button"), marker = document.createElement("div"), status = document.createElement("div");
      handle.type = "button"; handle.className = "oe-block-move-handle oe-block-move-floating"; handle.append(createDocumentGripIcon(document)); handle.hidden = true;
      handle.setAttribute("aria-label", "Move block. Use Alt and arrow keys"); handle.title = "Drag to move · Alt + arrows";
      groupHandle.type = "button"; groupHandle.className = "oe-block-move-handle oe-block-move-floating"; groupHandle.append(createDocumentGripIcon(document)); groupHandle.hidden = true; groupHandle.tabIndex = -1;
      // The semantic keyboard control stays beside its Columns heading. This
      // pointer proxy escapes container-query stacking contexts and vendor portals.
      groupHandle.setAttribute("aria-hidden", "true"); groupHandle.title = "Drag Columns · Alt + arrows";
      marker.className = "oe-block-move-marker"; marker.hidden = true; marker.setAttribute("aria-hidden", "true");
      status.className = "oe-block-move-status"; status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite");
      document.body.append(handle, groupHandle, marker, status);
      let active: { id: string; pointerId: number; button: HTMLElement; x: number; y: number; original: string; document: EditorDocument; moved: boolean; action?: DocumentBlockMove } | undefined;
      let lastX = 0, lastY = 0, frame = 0, destroyed = false, explicitHandle = false;
      const sideMenu = editor.getExtension(SideMenuExtension);
      const controls = () => [...view.dom.querySelectorAll<HTMLElement>(".oe-document-columns-menu>summary,.oe-document-columns-menu[open]>.oe-document-columns-menu-panel")];
      const overControl = () => controls().some(el => { const r = el.getBoundingClientRect(); return r.width && r.height && lastX >= r.left && lastX <= r.right && lastY >= r.top && lastY <= r.bottom; });
      const unlistenSideMenu = sideMenu?.store.subscribe(({ currentVal }) => { if (currentVal?.show && overControl()) sideMenu.hideMenuIfNotFrozen(); else if (currentVal?.show && !explicitHandle) handle.hidden = true; });
      const asEditor = editor as unknown as MoveEditor;
      const block = (id: string) => [...view.dom.querySelectorAll<HTMLElement>(".bn-block-outer[data-id]")].find(el => el.dataset.id === id);
      const eligible = (target: EventTarget | null): HTMLElement | undefined => {
        if (!(target instanceof win.Element)) return;
        const button = target.closest<HTMLElement>("[data-oe-move-id]");
        if (button?.dataset.oeEditorGutter && target.closest("button") !== button.querySelector('button[aria-haspopup="menu"]')) return;
        return button && (button === handle || button === groupHandle || view.dom.contains(button) || button.dataset.oeEditorGutter === documentGutterIdentity(editor)) ? button : undefined;
      };
      const announce = (text: string) => { status.textContent = text; };
      let suppressClickUntil = 0;
      const click = (event: MouseEvent) => { if (Date.now() < suppressClickUntil && eligible(event.target)) { event.preventDefault(); event.stopImmediatePropagation(); } };
      const focusButton = (button: HTMLElement) => {
        // The pointer proxy is hidden from assistive technology. Keep keyboard
        // focus on its semantic Columns control, including click/cancel paths.
        const semantic = button === groupHandle ? [...view.dom.querySelectorAll<HTMLElement>("[data-oe-move-id]")].find(el => el.dataset.oeMoveId === button.dataset.oeMoveId) : button;
        (semantic?.querySelector<HTMLElement>("button") ?? semantic)?.focus({ preventScroll: true });
      };
      const restoreHandle = (id: string) => { win.requestAnimationFrame(() => { if (destroyed) return; const exact = [...view.dom.querySelectorAll<HTMLElement>("[data-oe-move-id]")].find(button => button.dataset.oeMoveId === id); if (exact) { const menu = exact.closest<HTMLDetailsElement>(".oe-document-column-heading details"); if (menu) menu.open = true; exact.focus({ preventScroll: true }); } else { const el = block(id); if (el) { show(el, true); handle.focus({ preventScroll: true }); } } }); };
      const show = (el: HTMLElement, explicit = false) => {
        const id = el.dataset.id, value = id && editor.getBlock(id); if (!id || !value || value.type === DOCUMENT_COLUMN_TYPE || value.type === DOCUMENT_COLUMNS_TYPE || !editor.isEditable) return;
        if (!explicit) { if (document.activeElement !== handle) handle.hidden = true; return; }
        sideMenu?.hideMenuIfNotFrozen();
        // Keep the vendor's block-options grip reachable. This grip occupies
        // the adjacent insertion slot rather than covering that menu button.
        if (el.closest("[data-oe-document-columns]") && !explicit) { if (document.activeElement !== handle) handle.hidden = true; return; }
        if (explicit) explicitHandle = true;
        const r = el.getBoundingClientRect(); let left = Math.max(2, r.left - 60), top = Math.max(2, r.top);
        const gutter = [...document.querySelectorAll<HTMLElement>(".oe-document-side-menu")].find(el => el.dataset.oeEditorGutter === documentGutterIdentity(editor))?.getBoundingClientRect();
        if (gutter?.width) { if (r.left < 110) { if (!explicit) { handle.hidden = true; return; } left = Math.max(8, r.left); top = Math.max(8, r.top - 34); } else left = Math.max(8, r.left - 114); }
        // A first column paragraph shares its gutter with group options. Keep
        // both controls independently reachable rather than covering either one.
        if (controls().some(control => { const c = control.getBoundingClientRect(); return c.width && c.height && left < c.right && left + 28 > c.left && top < c.bottom && top + 28 > c.top; })) top += 30;
        handle.dataset.oeMoveId = id; handle.style.left = left + "px"; handle.style.top = top + "px"; handle.hidden = false;
      };
      const hover = (event: PointerEvent) => { if (active || !editor.isEditable || event.target === handle || event.target === groupHandle) return; const el = event.target instanceof win.Element ? event.target.closest<HTMLElement>(".bn-block-outer[data-id]") : null;
        const candidate = el?.closest<HTMLElement>("[data-oe-document-columns]");
        const group = candidate && (el === candidate || event.target instanceof win.Element && event.target.closest(".oe-document-columns-heading")) ? candidate : null;
        if (group && view.dom.contains(group)) { const button = [...group.querySelectorAll<HTMLElement>("[data-oe-move-id]")].find(b => b.dataset.oeMoveId === group.dataset.id); if (button) { const r = button.getBoundingClientRect(); groupHandle.dataset.oeMoveId = group.dataset.id; groupHandle.style.left = Math.max(2, r.left) + "px"; groupHandle.style.top = Math.max(2, r.top) + "px"; groupHandle.hidden = false; } } else if (document.activeElement !== groupHandle) groupHandle.hidden = true;
        if (group && view.dom.contains(group)) handle.hidden = true; else if (el && view.dom.contains(el)) show(el); else if (!(event.target instanceof win.Element && event.target.closest("[data-oe-move-id]")) && document.activeElement !== handle) handle.hidden = true;
      };
      const resolve = (id: string, x: number, y: number): { action: DocumentBlockMove; rect: DOMRect; vertical?: boolean; inside?: boolean } | undefined => {
        const hit = document.elementFromPoint(x, y), outer = hit?.closest<HTMLElement>(".bn-block-outer[data-id]"); if (!outer || !view.dom.contains(outer)) return;
        const doc = active!.document, source = locateDocumentBlock(doc, id), columnDOM = outer.closest<HTMLElement>(".bn-block-outer:has(> .bn-block > .bn-react-node-view-renderer > [data-content-type=oeColumn])");
        if (source.block.type === DOCUMENT_COLUMN_TYPE) {
          if (!columnDOM?.dataset.id || columnDOM.dataset.id === id) return;
          const target = locateDocumentBlock(doc, columnDOM.dataset.id); if (target.parent?.id !== source.parent?.id) return;
          const r = columnDOM.getBoundingClientRect(), own = block(id)?.getBoundingClientRect(); if (!own) return;
          const horizontal = Math.abs(own.top - r.top) < Math.min(own.height, r.height) / 2;
          const placement = horizontal ? x < r.left + r.width / 2 ? "before" : "after" : y < r.top + r.height / 2 ? "before" : "after";
          return { action: { blockId: id, anchorId: target.block.id, placement }, rect: r, vertical: horizontal };
        }
        const target = locateDocumentBlock(doc, outer.dataset.id!); let action: DocumentBlockMove;
        if (target.block.type === DOCUMENT_COLUMN_TYPE) action = { blockId: id, anchorId: target.block.id, placement: y < outer.getBoundingClientRect().top + outer.getBoundingClientRect().height / 2 ? "inside-start" : "inside-end" };
        else if (target.block.type === DOCUMENT_COLUMNS_TYPE) action = { blockId: id, anchorId: target.block.id, placement: y < outer.getBoundingClientRect().top + outer.getBoundingClientRect().height / 2 ? "before" : "after" };
        else action = { blockId: id, anchorId: target.block.id, placement: y < outer.getBoundingClientRect().top + outer.getBoundingClientRect().height / 2 ? "before" : "after" };
        const contains = (b: EditorDocument["blocks"][number]): boolean => b.id === target.block.id || Boolean(b.children?.some(contains));
        if (contains(source.block) || target.parent?.type === DOCUMENT_COLUMNS_TYPE && !action.placement.startsWith("inside-")) return;
        return { action, rect: outer.getBoundingClientRect(), inside: action.placement.startsWith("inside-") };
      };
      const feedback = () => {
        if (!active?.moved) return; active.action = undefined; marker.hidden = true;
        try { const target = resolve(active.id, lastX, lastY); if (!target) return; const { action, rect: r } = target; active.action = action; marker.hidden = false;
          marker.dataset.kind = target.inside ? "inside" : target.vertical ? "column" : "block";
          Object.assign(marker.style, { left: (target.vertical ? action.placement === "before" ? r.left : r.right : r.left) + "px", top: (target.inside ? r.top : target.vertical ? r.top : action.placement === "before" ? r.top : r.bottom) + "px", width: (target.vertical ? 3 : r.width) + "px", height: (target.inside || target.vertical ? r.height : 3) + "px" });
        } catch { /* Invalid/cyclic targets never become editor transactions. */ }
      };
      const scroll = () => {
        if (!active?.moved || destroyed) return; const hit = document.elementFromPoint(lastX, lastY); let parent = hit instanceof win.HTMLElement ? hit : undefined;
        while (parent && parent !== document.body && !(parent.scrollHeight > parent.clientHeight && /auto|scroll/.test(win.getComputedStyle(parent).overflowY))) parent = parent.parentElement ?? undefined;
        const r = parent && parent !== document.body ? parent.getBoundingClientRect() : { top: 0, bottom: win.innerHeight };
        const dy = lastY < r.top + 36 ? -12 : lastY > r.bottom - 36 ? 12 : 0; if (dy) { if (parent && parent !== document.body) parent.scrollTop += dy; else win.scrollBy(0, dy); feedback(); } frame = win.requestAnimationFrame(scroll);
      };
      const finish = (commit: boolean) => { const captured = active; active = undefined; marker.hidden = true; win.cancelAnimationFrame(frame); document.body.classList.remove("oe-block-moving");
        if (!captured) return; if (captured.moved) suppressClickUntil = Date.now() + 400; try { captured.button.releasePointerCapture(captured.pointerId); } catch { /* Pointer may already be released. */ }
        if (commit && captured.moved && captured.action) { try { if (JSON.stringify(fromBlockNote(editor.document).blocks) !== captured.original) throw Error("The document changed while moving. Try again."); applyDocumentBlockMove(asEditor, captured.action); announce("Block moved. Undo restores its previous position."); } catch (reason) { announce(reason instanceof Error ? reason.message : "Block move cancelled"); } }
        else if (captured.moved) announce("Block move cancelled");
        // The wrapper captures drag gestures; a click still opens its native block menu.
        if (!captured.moved && commit && captured.button.dataset.oeEditorGutter === documentGutterIdentity(editor)) captured.button.querySelector<HTMLButtonElement>("button")?.click();
        if (captured.moved && commit) restoreHandle(captured.id); else focusButton(captured.button);
      };
      const down = (event: PointerEvent) => { const button = eligible(event.target); if (!button || !editor.isEditable || event.button !== 0 || active) return; const id = button.dataset.oeMoveId; if (!id || !editor.getBlock(id)) return;
        event.preventDefault(); event.stopPropagation(); focusButton(button); const captured = fromBlockNote(editor.document); active = { id, button, pointerId: event.pointerId, x: event.clientX, y: event.clientY, original: JSON.stringify(captured.blocks), document: captured, moved: false }; lastX = event.clientX; lastY = event.clientY; button.setPointerCapture(event.pointerId);
      };
      const move = (event: PointerEvent) => { lastX = event.clientX; lastY = event.clientY; if (!active) { if (overControl()) { sideMenu?.hideMenuIfNotFrozen(); handle.hidden = true; } return; } if (active.pointerId !== event.pointerId) return; event.preventDefault();
        if (!active.moved && Math.hypot(lastX - active.x, lastY - active.y) >= 5) { active.moved = true; const menu = active.button.closest<HTMLDetailsElement>(".oe-document-column-heading details"); if (menu) menu.open = false; document.body.classList.add("oe-block-moving"); announce("Move to the insertion line. Escape cancels."); frame = win.requestAnimationFrame(scroll); } feedback();
      };
      const up = (event: PointerEvent) => { if (active?.pointerId === event.pointerId) { event.preventDefault(); finish(true); } };
      const cancel = () => finish(false);
      const key = (event: KeyboardEvent) => {
        if (event.isComposing) return;
        if (active && event.key === "Escape") { event.preventDefault(); event.stopPropagation(); cancel(); return; }
        const button = eligible(event.target);
        if (button && editor.isEditable && !view.composing && (event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "z") { event.preventDefault(); event.stopPropagation(); if (event.shiftKey) editor.redo(); else editor.undo(); return; }
        if (button && event.altKey && event.key.startsWith("Arrow")) { event.preventDefault(); event.stopPropagation(); try { const id = button.dataset.oeMoveId!, action = documentBlockKeyboardMove(editor.document, id, event.key); if (action) { applyDocumentBlockMove(asEditor, action); announce("Block moved. Undo restores its previous position."); restoreHandle(id); } } catch (reason) { announce(reason instanceof Error ? reason.message : "Move unavailable"); } }
        else if (!button && event.altKey && event.shiftKey && (event.code === "KeyM" || event.key.toLowerCase() === "m") && event.target instanceof win.Element && view.dom.contains(event.target) && !event.target.closest("input,textarea,select,[contenteditable=false]")) {
          // Native click selection can precede the editor's selectionchange.
          // Read the current scoped DOM selection rather than an old first-block caret.
          const native = document.getSelection()?.anchorNode, anchor = native instanceof win.Element ? native : native?.parentElement;
          const selected = anchor && view.dom.contains(anchor) ? anchor.closest<HTMLElement>(".bn-block-outer[data-id]") : undefined;
          const el = event.target.closest<HTMLElement>(".bn-block-outer[data-id]") ?? selected ?? block(editor.getTextCursorPosition().block.id);
          if (el) { event.preventDefault(); show(el, true); handle.focus(); }
        }
      };
      const drag = (event: DragEvent) => { if (eligible(event.target)) event.preventDefault(); };
      const focus = (event: FocusEvent) => { if (explicitHandle && event.target !== handle) { explicitHandle = false; if (!active) handle.hidden = true; } };
      document.addEventListener("focusin", focus); document.addEventListener("click", click, true);
      document.addEventListener("pointerover", hover); document.addEventListener("pointerdown", down, true); document.addEventListener("pointermove", move, true); document.addEventListener("pointerup", up, true); document.addEventListener("pointercancel", cancel, true); document.addEventListener("keydown", key, true); document.addEventListener("dragstart", drag, true);
      win.addEventListener("blur", cancel);
      return { update() { if (!active) { if (!explicitHandle || !handle.dataset.oeMoveId || !editor.getBlock(handle.dataset.oeMoveId)) handle.hidden = true; groupHandle.hidden = true; } }, destroy() { destroyed = true; cancel(); unlistenSideMenu?.(); document.removeEventListener("click", click, true); document.removeEventListener("focusin", focus); document.removeEventListener("pointerover", hover); document.removeEventListener("pointerdown", down, true); document.removeEventListener("pointermove", move, true); document.removeEventListener("pointerup", up, true); document.removeEventListener("pointercancel", cancel, true); document.removeEventListener("keydown", key, true); document.removeEventListener("dragstart", drag, true); win.removeEventListener("blur", cancel); handle.remove(); groupHandle.remove(); marker.remove(); status.remove(); } };
    }
  })]
}));
