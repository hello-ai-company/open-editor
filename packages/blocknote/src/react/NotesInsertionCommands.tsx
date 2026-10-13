import { useEffect } from "react";
import { SuggestionMenuController, useBlockNoteEditor, type DefaultReactSuggestionItem } from "@blocknote/react";
import { filterSuggestionItems } from "@blocknote/core/extensions";
import { NOTES_INSERT_CATALOG, NOTES_STYLE_CATALOG, notesAvailableCatalog, notesCatalogUnavailable, type NotesEditorBridge, type NotesInsertKind, type NotesInsertOptions, type NotesStyleKind } from "./notesWorkspacePanels.js";
import { NotesIcon } from "./notesPresentation.js";
export const NOTES_INSERT_LABELS_EN: Record<NotesInsertKind, string> = { text: "Text", page: "Page", link: "Link", card: "Card", attachment: "Attachment", image: "Image", video: "Video", audio: "Audio", pdf: "PDF", unsplash: "Unsplash", code: "Code", equation: "TeX equation", mermaid: "Mermaid", whiteboard: "Whiteboard", htmlEmbed: "HTML widget", syncedBlock: "Synced block", collection: "Database", gallery: "Gallery", kanban: "Kanban", columns: "Columns", divider: "Divider", pageBreak: "Page break", tableInsert: "Table" };
/** One catalog projection for the slash menu, + picker and right inspector.
 * A listed schema entry is not an authorization grant; unavailable entries stay inert. */
export function notesInsertionCatalog(bridge: NotesEditorBridge, language: "en" | "ja" = "ja") {
  return NOTES_INSERT_CATALOG.map(item => ({
    ...item, label: language === "ja" ? item.label : NOTES_INSERT_LABELS_EN[item.kind],
    unavailable: notesCatalogUnavailable(item, bridge.supportedInsertActions, bridge.installedBlockTypes),
    aliases: [item.kind, item.label, NOTES_INSERT_LABELS_EN[item.kind], ...(item.kind === "columns" ? ["column", "カラム", "列"] : [])],
  }));
}
export function notesInsertionCommands(bridge: NotesEditorBridge, language: "en" | "ja" = "ja") {
  return notesInsertionCatalog(bridge, language).filter(item => !item.unavailable);
}
/** Recheck the same live gate immediately before any surface invokes the existing writer. */
export function notesRequestInsertion(bridge: NotesEditorBridge, kind: NotesInsertKind, signal: AbortSignal, options?: NotesInsertOptions): void | Promise<void> {
  if (signal.aborted || !bridge.editable || bridge.composing || bridge.commandsAvailable === false || !notesInsertionCommands(bridge).some(item => item.kind === kind)) throw new Error("Insertion unavailable");
  return (bridge.requestInsert ?? bridge.insert)(kind, signal, options);
}
export function NotesSlashMenuController({ bridge, language, onError, onReady, getPlusAnchor }: { bridge: NotesEditorBridge; language: "en" | "ja"; onError(message: string): void; onReady?(ready: boolean): void; getPlusAnchor?(): { blockId: string; placement: "after" } | undefined }) {
  const editor = useBlockNoteEditor<any, any, any>();
  useEffect(() => { onReady?.(true); return () => onReady?.(false); }, [onReady]);
  return <SuggestionMenuController triggerCharacter="/" shouldOpen={() => bridge.editable && !bridge.composing && bridge.commandsAvailable !== false} getItems={async query => {
    if (!bridge.editable || bridge.composing || bridge.commandsAvailable === false) return [];
    const plusAnchor = getPlusAnchor?.();
    const items: DefaultReactSuggestionItem[] = notesInsertionCommands(bridge, language).map(command => ({
      title: command.label, aliases: command.aliases, group: language === "ja" ? "挿入" : "Insert", icon: <NotesIcon name={command.kind} />,
      onItemClick: () => {
        if (!bridge.editable || bridge.composing || bridge.commandsAvailable === false) return;
        const block = plusAnchor ? editor.getBlock(plusAnchor.blockId) : editor.getTextCursorPosition().block;
        if (!block) return;
        const empty = block.type === "paragraph" && Array.isArray(block.content) && block.content.length === 0;
        const options = { anchor: plusAnchor ?? { blockId: block.id, placement: "after" as const }, ...(empty ? { replaceEmptyBlockId: block.id } : {}) };
        void Promise.resolve().then(() => notesRequestInsertion(bridge, command.kind, new AbortController().signal, options)).catch(error => {
          if (!(error instanceof Error && error.message === "Insertion cancelled")) onError(language === "ja" ? "挿入を完了できませんでした。本文は保持しています" : "Insertion could not be completed. Your text is retained.");
        });
      },
    }));
    const formats: Partial<Record<NotesStyleKind, string>> = { heading: "Heading", quote: "Quote", bullet: "Bullet list", numbered: "Numbered list", checklist: "Checklist", callout: "Callout" };
    for (const command of (plusAnchor && !Array.isArray(editor.getBlock(plusAnchor.blockId)?.content) ? [] : notesAvailableCatalog(NOTES_STYLE_CATALOG, bridge.supportedStyleActions, bridge.installedBlockTypes))) {
      if (!formats[command.kind]) continue;
      items.push({ title: language === "ja" ? command.label : formats[command.kind]!, aliases: [command.kind, command.label, formats[command.kind]!], group: language === "ja" ? "書式" : "Format", icon: <NotesIcon name={command.kind} />, onItemClick: () => { void Promise.resolve().then(() => bridge.format(command.kind, new AbortController().signal)).catch(() => onError(language === "ja" ? "書式を変更できませんでした" : "Formatting unavailable")); } });
    }
    return filterSuggestionItems(items, query);
  }} />;
}
