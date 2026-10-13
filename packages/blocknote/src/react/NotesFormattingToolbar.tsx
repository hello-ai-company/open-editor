import { closeHistory } from "@tiptap/pm/history";
import { createContext, useContext, useEffect, useMemo, type ReactNode, type ComponentProps } from "react";
import { BlockNoteContext, ComponentsContext, FormattingToolbarController, LinkToolbarController, getFormattingToolbarItems } from "@blocknote/react";
import { NOTES_NATIVE_TEXT_ALIGNMENT_ITEMS } from "./notesTextAlignmentPolicy.js";
import { notesIsComposing } from "./notesWorkspacePanels.js";

/** The transient bar owns no draft or composer. All actions share its one focus order. */
export const NotesSelectionActionsContext = createContext<{
  controls: ReactNode;
  id?: string;
  language: "ja" | "en";
  suppressed: boolean;
  integrated?: boolean;
  canFormat(): boolean;
  canFormatItem?(key: string): boolean;
  dismiss(): void;
} | null>(null);

export function notesSelectionToolbarButtons(root: HTMLElement): HTMLButtonElement[] {
  return [...root.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")].filter(button =>
    !button.closest('[role="menu"],[role="dialog"],[role="listbox"],.bn-color-picker-dropdown,.bn-link-edit-form,.bn-popover-content,[hidden],[inert],[aria-hidden="true"]') && !button.hidden);
}

/** Preserve the installed native button's action/focus/selection behavior while
 * making its per-block update loop one local Undo unit. Only alignment items use
 * this scoped visual-provider adapter; no DOM click redispatch is involved. */
function NativeTextAlignmentTransaction({ children }: { children: ReactNode }) {
  const components = useContext(ComponentsContext), editor = useContext(BlockNoteContext)?.editor;
  const transactional = useMemo(() => {
    const Button = components?.FormattingToolbar.Button;
    if (!components || !Button || !editor) return undefined;
    const AtomicButton = (props: ComponentProps<typeof Button>) => <Button {...props} onClick={event => {
      editor.prosemirrorView.dispatch(closeHistory(editor.prosemirrorState.tr));
      try { editor.transact(transaction => {
        const before = transaction.doc;
        props.onClick?.(event);
        // Native buttons may replace an already-equal node. Do not add an empty
        // Undo step for a repeated click (mixed selections still run in full).
        if (transaction.doc.eq(before)) transaction.setMeta("addToHistory", false);
      }); }
      finally { editor.prosemirrorView.dispatch(closeHistory(editor.prosemirrorState.tr)); }
    }} />;
    return { ...components, FormattingToolbar: { ...components.FormattingToolbar, Button: AtomicButton } };
  }, [components, editor]);
  return transactional ? <ComponentsContext.Provider value={transactional}>{children}</ComponentsContext.Provider> : children;
}

export function NotesFormattingToolbar() {
  const selection = useContext(NotesSelectionActionsContext);
  if (selection?.suppressed) return null;
  const ja = selection?.language !== "en";
  const items = getFormattingToolbarItems().filter(item => !["addCommentButton", "addTiptapCommentButton"].includes(String(item.key)) && selection?.canFormatItem?.(String(item.key)) !== false);
  return <div className="oe-notes-unified-selection" data-notes-unified-selection data-notes-selection-toolbar={selection?.id}
    onMouseDownCapture={event => {
      const target = event.target instanceof Element ? event.target.closest("button") : null;
      // Preserve the text range when clicking a toolbar action, but let nested
      // menus and inputs retain their own focus/keyboard behavior.
      if (target && notesSelectionToolbarButtons(event.currentTarget).includes(target)) event.preventDefault();
    }}
    onKeyDownCapture={event => {
      // Native link fields submit on Enter. Stop their handler during IME without
      // cancelling the browser's composition commit or removing the input.
      if (event.key === "Enter" && (notesIsComposing(event) || selection && !selection.canFormat())) {
        event.stopPropagation();
        if (!notesIsComposing(event)) event.preventDefault();
      }
    }}
    onSubmitCapture={event => { if (selection && !selection.canFormat()) { event.preventDefault(); event.stopPropagation(); } }}
    onClickCapture={event => {
      if (selection && !selection.canFormat()) { event.preventDefault(); event.stopPropagation(); }
    }}
    onKeyDown={event => {
      if (event.defaultPrevented || notesIsComposing(event) || !selection?.canFormat()) return;
      const buttons = notesSelectionToolbarButtons(event.currentTarget), index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      if (index < 0) return;
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); selection.dismiss(); return; }
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key) || event.altKey || event.ctrlKey || event.metaKey) return;
      event.preventDefault(); event.stopPropagation();
      const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next]?.focus({ preventScroll: true });
    }}>
    <div className="bn-toolbar bn-formatting-toolbar" role="toolbar" aria-disabled={selection ? !selection.canFormat() : undefined} aria-label={ja ? "選択文の書式と操作" : "Selection formatting and actions"} aria-description={ja ? "F8で移動、左右矢印で操作を選択、Escapeで本文へ戻る" : "F8 to focus, left/right arrows to choose an action, Escape to return to the document"}>
      {items.map(item => <span className={`oe-notes-format-item${item.key === "blockTypeSelect" ? " oe-notes-block-type" : ""}`} key={item.key} data-notes-native-item={String(item.key)} onClickCapture={event => { if (selection?.canFormatItem?.(String(item.key)) === false) { event.preventDefault(); event.stopPropagation(); } }} onKeyDownCapture={event => { if ((event.key === "Enter" || event.key === " ") && selection?.canFormatItem?.(String(item.key)) === false) { if (!notesIsComposing(event)) event.preventDefault(); event.stopPropagation(); } }} title={item.key === "blockTypeSelect" ? (ja ? "ブロックの種類" : "Block type") : undefined}>{(NOTES_NATIVE_TEXT_ALIGNMENT_ITEMS as readonly string[]).includes(String(item.key)) ? <NativeTextAlignmentTransaction>{item}</NativeTextAlignmentTransaction> : item}</span>)}
      {selection?.controls}
    </div>
  </div>;
}
// The native popover keeps cached toolbar HTML while it fades out. A closing
// selection/link bar should stop competing with the next bar immediately, while
// leaving the native opening animation, editor selection and nested forms intact.
export const notesToolbarCloseTransition = {
  useTransitionStylesProps: { duration: { open: 250, close: 0 }, close: { opacity: 0, visibility: "hidden" as const, pointerEvents: "none" as const } },
  useTransitionStatusProps: { duration: { open: 250, close: 0 } },
};

export function NotesLinkToolbarController() {
  return <LinkToolbarController floatingUIOptions={notesToolbarCloseTransition} />;
}

// Native formatting menus must win hit-testing over the ambient feedback dock
// (layer 50), while remaining below major overlays. Keep the native portal,
// placement, selection and focus behavior; only its whole floating layer moves.
const formattingFloatingOptions = {
  ...notesToolbarCloseTransition,
  elementProps: { className: "oe-notes-formatting-surface", style: { zIndex: 60 } },
};

export function NotesFormattingToolbarController({ onReady }: { onReady(ready: boolean): void }) {
  useEffect(() => { onReady(true); return () => onReady(false); }, [onReady]);
  return <FormattingToolbarController formattingToolbar={NotesFormattingToolbar} floatingUIOptions={formattingFloatingOptions} />;
}
