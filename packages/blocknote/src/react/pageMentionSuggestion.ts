/**
 * @ page-mention suggestion items for BlockNote SuggestionMenuController.
 * Reuses the same search engine as WorkspacePagePicker.
 */
import type { EditorPageLink, PageProvider } from "@hello-ai-company/editor-core";
import { createPageSearchEngine } from "../workspace/pageSearch.js";
import { PAGE_MENTION_TYPE } from "../workspace/types.js";

export type PageMentionSuggestionEditor = {
  insertInlineContent?: (content: unknown[]) => void;
  insertBlocks?: (...args: never[]) => unknown;
  getTextCursorPosition?: () => { block: unknown };
  transact?: <T>(fn: () => T) => T;
};

export type PageMentionSuggestionItem = {
  title: string;
  subtext?: string;
  pageId: string;
  onItemClick: () => void;
};

export type CreatePageMentionSuggestionOptions = {
  provider?: Pick<PageProvider, "searchPages" | "listLinks">;
  /** Sync catalog fallback when provider search is unavailable. */
  getPages?: () => readonly EditorPageLink[];
  excludePageId?: string;
  editor: PageMentionSuggestionEditor;
  /** Optional prime into a page runtime store after selection. */
  onSelect?: (page: EditorPageLink) => void;
};

function insertPageMention(
  editor: PageMentionSuggestionEditor,
  pageId: string
): void {
  const inline = { type: PAGE_MENTION_TYPE, props: { pageId } };
  const run = () => {
    if (typeof editor.insertInlineContent === "function") {
      editor.insertInlineContent([inline]);
      return;
    }
    const cursor = editor.getTextCursorPosition?.();
    if (cursor && typeof editor.insertBlocks === "function") {
      editor.insertBlocks(
        [{ type: "paragraph", content: [inline] }] as never,
        cursor.block as never,
        "after" as never
      );
    }
  };
  if (typeof editor.transact === "function") {
    editor.transact(run);
  } else {
    run();
  }
}

/**
 * Factory for SuggestionMenuController getItems with triggerCharacter="@".
 */
export function createPageMentionSuggestionGetItems(
  options: CreatePageMentionSuggestionOptions
): (query: string) => Promise<PageMentionSuggestionItem[]> {
  const engine = createPageSearchEngine({
    provider: options.provider,
    debounceMs: 0
  });

  return async (query: string) => {
    let pages: EditorPageLink[] = [];
    if (options.provider?.searchPages || options.provider?.listLinks) {
      pages = await engine.searchNow({
        query,
        excludePageId: options.excludePageId,
        limit: 20
      });
    } else if (options.getPages) {
      const q = query.trim().toLowerCase();
      pages = options
        .getPages()
        .filter((page) => page.id !== options.excludePageId)
        .filter(
          (page) =>
            !q ||
            page.title.toLowerCase().includes(q) ||
            page.id.toLowerCase().includes(q)
        )
        .slice(0, 20);
    }

    return pages.map((page) => ({
      title: page.title || page.id,
      subtext: page.preview,
      pageId: page.id,
      onItemClick: () => {
        options.onSelect?.(page);
        insertPageMention(options.editor, page.id);
      }
    }));
  };
}

/** Insert a structured pageMention — shared by commands and @ suggestions. */
export function insertStructuredPageMention(
  editor: PageMentionSuggestionEditor,
  pageId: string
): void {
  if (!pageId) return;
  insertPageMention(editor, pageId);
}
