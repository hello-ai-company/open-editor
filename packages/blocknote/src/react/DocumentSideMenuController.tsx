import { notesIsComposing } from "./notesWorkspacePanels.js";
import { documentGutterIdentity } from "../document/gutterIdentity.js";
import { SideMenuController, SideMenu, AddBlockButton, DragHandleButton, DragHandleMenu, RemoveBlockItem, BlockColorsItem, TableRowHeaderItem, TableColumnHeaderItem, useDictionary, useBlockNoteEditor, useExtensionState, useExtension, type SideMenuProps } from "@blocknote/react";
import { useRef, useEffect, useContext, createContext, useSyncExternalStore, useCallback } from "react";
import { FormattingToolbarExtension, SideMenuExtension, SuggestionMenu } from "@blocknote/core/extensions";

import { NotesSelectionActionsContext } from "./NotesFormattingToolbar.js";

const SideMenuActionsContext = createContext<{ onAdd?(blockId: string): void; canAdd?: boolean }>({});
const noFormatting = () => false;
function ScopedDragHandleMenu() {
  const selection = useContext(NotesSelectionActionsContext), dict = useDictionary();
  return <DragHandleMenu><RemoveBlockItem>{dict.drag_handle.delete_menuitem}</RemoveBlockItem>{selection?.canFormatItem?.("blockColors") !== false ? <span data-notes-gutter-colors onClickCapture={event => { if (selection?.canFormatItem?.("blockColors") === false) { event.preventDefault(); event.stopPropagation(); } }} onKeyDownCapture={event => { if ((event.key === "Enter" || event.key === " ") && selection?.canFormatItem?.("blockColors") === false) { if (!notesIsComposing(event)) event.preventDefault(); event.stopPropagation(); } }}><BlockColorsItem>{dict.drag_handle.colors_menuitem}</BlockColorsItem></span> : null}<TableRowHeaderItem>{dict.drag_handle.header_row_menuitem}</TableRowHeaderItem><TableColumnHeaderItem>{dict.drag_handle.header_column_menuitem}</TableColumnHeaderItem></DragHandleMenu>;
}
function SpacedSideMenu(props: SideMenuProps) {
  const actions = useContext(SideMenuActionsContext);
  const editor = useBlockNoteEditor<any, any, any>();
  const menu = useExtension(SideMenuExtension), ownsHover = useRef(false);
  const selectionActions = useContext(NotesSelectionActionsContext);
  const formattingStore = editor.getExtension(FormattingToolbarExtension)?.store;
  const subscribeFormatting = useCallback((notify: () => void) => formattingStore?.subscribe(notify) ?? (() => {}), [formattingStore]);
  const formattingShown = useSyncExternalStore(subscribeFormatting, () => formattingStore?.state ?? false, noFormatting);
  // Both subscriptions and context belong to this editor. A text-selection bar
  // owns the transient gutter space; do not leave add/drag controls behind it.
  // An explicitly opened native menu owns its freeze until its close lifecycle.
  // A custom renderer without the integrated bar must also retain its gutter.
  const selectionOwnsGutter = !!selectionActions?.integrated && !selectionActions.suppressed && !!formattingShown && (!menu.menuFrozen || ownsHover.current);
  useEffect(() => {
    if (selectionOwnsGutter && ownsHover.current) { ownsHover.current = false; menu.unfreezeMenu(); }
  }, [selectionOwnsGutter, menu]);
  const visibleBlock = useExtensionState(SideMenuExtension, { selector: value => value?.show ? value.block : undefined }), retainedBlock = useRef(visibleBlock);
  if (visibleBlock) retainedBlock.current = visibleBlock;
  useEffect(() => () => { if (ownsHover.current) menu.unfreezeMenu(); }, [menu]);
  // Structural Columns already own a move grip and options. Rendering the
  // native structural add/drag pair here creates a second, ambiguous control set.
  if (selectionOwnsGutter || visibleBlock?.type === "oeColumns" || visibleBlock?.type === "oeColumn") return null;
  return <div className="oe-document-side-menu" data-oe-editor-gutter={documentGutterIdentity(editor)} onPointerEnter={() => { if (!menu.menuFrozen) { ownsHover.current = true; menu.freezeMenu(); } }} onPointerLeave={() => { if (ownsHover.current) { ownsHover.current = false; menu.unfreezeMenu(); } }} onPointerDownCapture={() => { ownsHover.current = false; }} onKeyDownCapture={event => { if (event.key === "Enter" || event.key === " ") ownsHover.current = false; }} ><SideMenu {...props}><span onClick={() => queueMicrotask(() => menu.unfreezeMenu())} onKeyDown={event => {
    if (!["Enter", " "].includes(event.key) || event.nativeEvent.isComposing) return;
    const block = retainedBlock.current && editor.getBlock(retainedBlock.current.id); if (!block || !editor.isEditable) return;
    event.preventDefault(); event.stopPropagation(); ownsHover.current = false;
    if (actions.onAdd) { actions.onAdd(block.id); menu.unfreezeMenu(); return; }
    const empty = Array.isArray(block.content) && !block.content.length, target = empty ? block : editor.insertBlocks([{ type: "paragraph" }], block, "after")[0]!;
    editor.setTextCursorPosition(target); editor.focus(); editor.getExtension(SuggestionMenu)?.openSuggestionMenu("/"); menu.unfreezeMenu();
  }}>{actions.onAdd ? <button className="bn-button oe-document-add-button" type="button" aria-label="Add block" disabled={actions.canAdd === false || !editor.isEditable} onMouseDown={event => event.preventDefault()} onClick={() => { const block = retainedBlock.current; if (block && editor.isEditable) actions.onAdd?.(block.id); menu.unfreezeMenu(); }}><span aria-hidden="true">+</span></button> : <AddBlockButton />}</span><span data-oe-move-id={visibleBlock?.id} data-oe-editor-gutter={documentGutterIdentity(editor)}><DragHandleButton dragHandleMenu={props.dragHandleMenu ?? ScopedDragHandleMenu} /></span></SideMenu></div>;
}
/** Native BlockNote add/options menu, with a quiet gap and a viewport-safe gutter.
 * Hosts using a custom BlockNoteView should disable its default sideMenu and mount
 * this public controller as its child. No SDK portal or body DOM is rewritten. */
export function DocumentSideMenuController({ onAdd, canAdd }: { onAdd?(blockId: string): void; canAdd?: boolean } = {}) {
  const editor = useBlockNoteEditor<any, any, any>();
  const state = useExtensionState(SideMenuExtension, { selector: value => value?.block });
  useEffect(() => {
    const menu = editor.getExtension(SideMenuExtension), dom = editor.prosemirrorView.dom, doc = dom.ownerDocument;
    if (!menu) return;
    let targetId: string | undefined;
    const track = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || menu.menuFrozen) return;
      const element = event.target.closest<HTMLElement>(".bn-block-outer[data-id]");
      if (element && dom.contains(element) && !event.target.closest(".oe-document-columns-heading,.oe-document-column-heading,.oe-html-widget-editor")) { targetId = element.dataset.id; return; }
      const target = targetId && [...dom.querySelectorAll<HTMLElement>(".bn-block-outer[data-id]")].find(el => el.dataset.id === targetId), row = target && target.getBoundingClientRect();
      const gutter = [...doc.querySelectorAll<HTMLElement>(".oe-document-side-menu")].find(el => el.dataset.oeEditorGutter === documentGutterIdentity(editor))?.getBoundingClientRect();
      const corridor = row && gutter && event.clientX >= gutter.left - 4 && event.clientX <= row.right && event.clientY >= Math.min(row.top, gutter.top) && event.clientY <= Math.max(row.bottom, gutter.bottom);
      if (!corridor) targetId = undefined;
    };
    doc.addEventListener("pointermove", track, true);
    const unsubscribe = menu.store.subscribe(({ currentVal }) => {
      if (!currentVal?.show || !targetId || currentVal.block.id === targetId || !editor.isEditable) return;
      const target = editor.getBlock(targetId), element = [...dom.querySelectorAll<HTMLElement>(".bn-block-outer[data-id]")].find(el => el.dataset.id === targetId);
      if (target && element) menu.store.setState({ ...currentVal, block: target, referencePos: element.getBoundingClientRect() });
    });
    return () => { doc.removeEventListener("pointermove", track, true); unsubscribe(); };
  }, [editor]);
  const block = state;
  const vertical = block?.type === "heading" ? ({ 1: 39, 2: 27, 3: 18.5 } as Record<number, number>)[Number(block.props.level)] ?? 0 : block && editor.schema.blockSpecs[block.type]?.implementation.meta?.fileBlockAccept && !block.props.url ? 12 : block?.type === "file" ? 4 : block?.type === "audio" || block?.type === "table" ? 15 : 0;
  return <SideMenuActionsContext.Provider value={{ onAdd, canAdd }}><SideMenuController sideMenu={SpacedSideMenu} floatingUIOptions={{ useFloatingOptions: { middleware: [{ name: "openeditor-gutter", fn: async ({ x, y, rects, elements, platform, strategy }) => {
    // Floating UI uses its offset parent's coordinates. Owned controls use viewport
    // rectangles; convert with the public platform before comparing either space.
    const convert = platform.convertOffsetParentRelativeRectToViewportRelativeRect;
    if (!convert || !platform.getOffsetParent) return { x: Math.max(8, x - 14), y: y + vertical };
    const offsetParent = await platform.getOffsetParent(elements.floating);
    const [origin, reference, proposed] = await Promise.all([
      convert({ elements, offsetParent, strategy, rect: { x: 0, y: 0, width: 1, height: 1 } }),
      convert({ elements, offsetParent, strategy, rect: rects.reference }),
      convert({ elements, offsetParent, strategy, rect: { ...rects.floating, x: x - 14, y: y + vertical } })
    ]);
    const nextX = Math.max(8, proposed.x);
    // When no left gutter exists, use the space above this row instead of its text.
    let nextY = nextX + proposed.width <= reference.x - 4 ? proposed.y : Math.max(8, reference.y - proposed.height - 6);
    const controls = [...editor.prosemirrorView.dom.querySelectorAll<HTMLElement>(".oe-document-columns-menu>summary,[data-oe-move-id]")].map(control => control.getBoundingClientRect()).filter(r => r.width && r.height);
    const collision = (r: DOMRect) => nextX < r.right && nextX + proposed.width > r.left && nextY < r.bottom && nextY + proposed.height > r.top;
    // Re-check after moving below a control: a later row can share this gutter.
    for (let pass = 0; pass <= controls.length; pass++) { const hits = controls.filter(collision); if (!hits.length) break; nextY = Math.max(...hits.map(r => r.bottom)) + 4; }
    return { x: (nextX - origin.x) / origin.width, y: (nextY - origin.y) / origin.height };
  } }] } }} /></SideMenuActionsContext.Provider>;
}
