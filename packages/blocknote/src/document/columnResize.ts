import { createExtension } from "@blocknote/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { closeHistory } from "@tiptap/pm/history";
import { documentColumnResizeWidths, type DocumentColumnsAction } from "./columns.js";

type Preview = Extract<DocumentColumnsAction, { type: "resize-pair" }>;
export const documentColumnResizeKey = new PluginKey<Preview | null>("openeditor-column-resize");

/** Owned overlay controls + public transactions/decorations; body DOM is read only. */
export const DocumentColumnResizing = (apply: (editor: any, action: DocumentColumnsAction) => void) => createExtension(({ editor }) => ({
  key: "openeditor-document-column-resize",
  prosemirrorPlugins: [new Plugin<Preview | null>({
    key: documentColumnResizeKey,
    state: { init: () => null, apply: (tr, value) => tr.docChanged ? null : tr.getMeta(documentColumnResizeKey) !== undefined ? tr.getMeta(documentColumnResizeKey) : value },
    view(view) {
      const doc = view.dom.ownerDocument, win = doc.defaultView!;
      const layer = doc.createElement("div"), status = doc.createElement("div");
      layer.className = "oe-column-resize-layer";
      status.className = "oe-block-move-status"; status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite");
      doc.body.append(layer, status);
      type Pair = { groupId: string; leftId: string; rightId: string; leftWidth: number; rightWidth: number; pixels: number; x: number; top: number; height: number };
      const buttons = new Map<string, HTMLButtonElement>(), pairs = new Map<string, Pair>();
      let frame = 0, destroyed = false;
      let drag: { pair: Pair; button: HTMLButtonElement; pointerId: number; startX: number; widths: [number, number]; moved: boolean; document: object } | undefined;
      const preview = (value: Preview | null) => { if (!destroyed) view.dispatch(view.state.tr.setMeta(documentColumnResizeKey, value).setMeta("addToHistory", false)); };
      const finish = (commit = false) => {
        const current = drag; drag = undefined;
        if (!current) return;
        if (current.button.hasPointerCapture(current.pointerId)) current.button.releasePointerCapture(current.pointerId);
        layer.classList.remove("oe-column-resize-active"); preview(null);
        if (!commit || !current.moved || current.document !== view.state.doc || !editor.isEditable) return;
        try { view.dispatch(closeHistory(view.state.tr)); apply(editor, { type: "resize-pair", groupId: current.pair.groupId, leftId: current.pair.leftId, rightId: current.pair.rightId, leftWidth: current.widths[0], rightWidth: current.widths[1] }); status.textContent = "Column widths changed. Undo restores both columns."; }
        catch (error) { status.textContent = error instanceof Error ? error.message : "Column resize cancelled. Input retained."; }
      };
      const refresh = () => {
        frame = 0; if (destroyed) return;
        if (drag && (drag.document !== view.state.doc || !editor.isEditable || view.composing)) finish();
        pairs.clear();
        const visible = new Set<string>(), viewport = view.dom.getBoundingClientRect();
        // Node positions come from public PM state; nodeDOM is read for geometry only.
        view.state.doc.descendants((node, position) => {
          if (node.type.name !== "blockContainer" || node.firstChild?.type.name !== "oeColumns") return;
          const group = node.lastChild; if (group?.type.name !== "blockGroup") return;
          const members: { id: string; width: number; rect: DOMRect }[] = [], groupPosition = position + 1 + node.firstChild.nodeSize;
          group.forEach((column, offset) => { const element = view.nodeDOM(groupPosition + 1 + offset); if (element instanceof win.HTMLElement) members.push({ id: String(column.attrs.id), width: Number(column.firstChild?.attrs.width ?? 1), rect: element.getBoundingClientRect() }); });
          for (let index = 0; index < members.length - 1; index++) {
            const a = members[index]!, b = members[index + 1]!;
            if (Math.abs(a.rect.top - b.rect.top) > 3 || a.rect.width < 1 || b.rect.width < 1 || b.rect.left < a.rect.right - 2) continue;
            const top = Math.max(0, viewport.top, a.rect.top + 4), bottom = Math.min(win.innerHeight, viewport.bottom, Math.max(a.rect.bottom, b.rect.bottom));
            if (bottom - top < 20 || !editor.isEditable) continue;
            const key = `${node.attrs.id}/${a.id}/${b.id}`, pair: Pair = { groupId: String(node.attrs.id), leftId: a.id, rightId: b.id, leftWidth: a.width, rightWidth: b.width, pixels: a.rect.width + b.rect.width, x: (a.rect.right + b.rect.left) / 2, top, height: bottom - top };
            pairs.set(key, pair); visible.add(key);
            let button = buttons.get(key);
            if (!button) {
              button = doc.createElement("button"); button.type = "button"; button.className = "oe-column-resize"; button.dataset.oeResizePair = key;
              button.setAttribute("role", "separator"); button.setAttribute("aria-orientation", "vertical"); button.title = "Drag to resize columns · Left / Right arrows · Shift for larger steps";
              button.addEventListener("pointerdown", event => {
                const saved = pairs.get(key), current = saved && { ...saved, leftWidth: Number(editor.getBlock(saved.leftId)?.props.width), rightWidth: Number(editor.getBlock(saved.rightId)?.props.width) }; if (!current || !editor.isEditable || event.button !== 0 || view.composing) return;
                const owner = [...view.dom.querySelectorAll<HTMLElement>(".bn-block-outer[data-id]")].find(el => el.dataset.id === current.groupId);
                if (owner?.querySelector("[data-oe-width-draft=true]")) { status.textContent = "Finish or cancel the retained width input before resizing."; return; }
                event.preventDefault(); event.stopPropagation();
                drag = { pair: current, button: button!, pointerId: event.pointerId, startX: event.clientX, widths: [current.leftWidth, current.rightWidth], moved: false, document: view.state.doc }; button!.setPointerCapture(event.pointerId);
              });
              button.addEventListener("pointermove", event => { if (!drag || drag.button !== button || drag.pointerId !== event.pointerId) return; const delta = event.clientX - drag.startX; if (!drag.moved && Math.abs(delta) < 5) return; drag.moved = true; drag.widths = documentColumnResizeWidths(drag.pair.leftWidth, drag.pair.rightWidth, drag.pair.pixels, delta); layer.classList.add("oe-column-resize-active"); preview({ type: "resize-pair", ...drag.pair, leftWidth: drag.widths[0], rightWidth: drag.widths[1] }); schedule(); });
              button.addEventListener("pointerup", event => { if (drag?.pointerId === event.pointerId) { event.preventDefault(); event.stopPropagation(); finish(true); } });
              button.addEventListener("pointercancel", () => finish()); button.addEventListener("lostpointercapture", () => finish());
              button.addEventListener("keydown", event => {
                if (event.key === "Escape") { event.preventDefault(); finish(); return; }
                if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                const saved = pairs.get(key), pair = saved && { ...saved, leftWidth: Number(editor.getBlock(saved.leftId)?.props.width), rightWidth: Number(editor.getBlock(saved.rightId)?.props.width) }; if (!pair || !editor.isEditable) return;
                event.preventDefault(); event.stopPropagation();
                const delta = event.key === "Home" ? -pair.pixels : event.key === "End" ? pair.pixels : pair.pixels * (event.shiftKey ? .1 : .01) * (event.key === "ArrowLeft" ? -1 : 1), widths = documentColumnResizeWidths(pair.leftWidth, pair.rightWidth, pair.pixels, delta);
                try { view.dispatch(closeHistory(view.state.tr)); apply(editor, { type: "resize-pair", ...pair, leftWidth: widths[0], rightWidth: widths[1] }); status.textContent = "Column widths changed."; } catch (error) { status.textContent = error instanceof Error ? error.message : "Column resize cancelled."; }
              });
              buttons.set(key, button); layer.append(button);
            }
            button.setAttribute("aria-label", `Resize columns ${index + 1} and ${index + 2}`);
            const min = documentColumnResizeWidths(a.width, b.width, pair.pixels, -pair.pixels)[0] / (a.width + b.width) * 100, max = documentColumnResizeWidths(a.width, b.width, pair.pixels, pair.pixels)[0] / (a.width + b.width) * 100;
            button.setAttribute("aria-valuemin", String(Math.round(min))); button.setAttribute("aria-valuemax", String(Math.round(max))); button.setAttribute("aria-valuenow", String(Math.round(a.width / (a.width + b.width) * 100)));
            Object.assign(button.style, { left: `${pair.x - 6}px`, top: `${top}px`, height: `${pair.height}px` }); button.hidden = false;
          }
        });
        for (const [key, button] of buttons) if (!visible.has(key)) { if (drag?.button === button) finish(); button.remove(); buttons.delete(key); }
      };
      const schedule = () => { if (!frame && !destroyed) frame = win.requestAnimationFrame(refresh); };
      const cancel = () => { finish(); schedule(); }, escape = (event: KeyboardEvent) => { if (drag && event.key === "Escape") { event.preventDefault(); finish(); } };
      win.addEventListener("resize", cancel); win.addEventListener("blur", cancel); win.addEventListener("scroll", cancel, true); doc.addEventListener("keydown", escape, true);
      const observer = typeof win.ResizeObserver === "function" ? new win.ResizeObserver(schedule) : undefined; observer?.observe(view.dom); schedule();
      return { update() { if (drag && drag.document !== view.state.doc) finish(); schedule(); }, destroy() { destroyed = true; if (frame) win.cancelAnimationFrame(frame); observer?.disconnect(); win.removeEventListener("resize", cancel); win.removeEventListener("blur", cancel); win.removeEventListener("scroll", cancel, true); doc.removeEventListener("keydown", escape, true); layer.remove(); status.remove(); drag = undefined; } };
    }
  })]
}))();
