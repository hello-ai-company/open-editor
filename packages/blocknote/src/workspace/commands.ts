import type { EditorCommand } from "../commands/registry.js";
import {
  CHILD_PAGE_TYPE,
  DATABASE_VIEW_TYPE,
  PAGE_CARD_TYPE,
  PAGE_MENTION_TYPE,
  type DatabaseViewType
} from "./types.js";

function hasPagePicker(ctx: {
  requestPagePick?: unknown;
}): boolean {
  return typeof ctx.requestPagePick === "function";
}

function hasCreateChildPage(ctx: {
  providers?: { pages?: { createChildPage?: unknown } };
}): boolean {
  return typeof ctx.providers?.pages?.createChildPage === "function";
}

function hasDatabaseProvider(ctx: {
  providers?: { database?: { listRows?: unknown } };
}): boolean {
  return typeof ctx.providers?.database?.listRows === "function";
}

/**
 * Workspace content commands — register only when corresponding schema
 * primitives are included (schema ↔ command surface must agree).
 */
export function createWorkspaceContentCommands(): EditorCommand[] {
  return [
    {
      id: "page.insert-mention",
      title: "Page mention",
      subtitle: "Insert an inline @page reference",
      group: "navigation",
      aliases: ["mention page", "@page"],
      keywords: ["page", "mention", "link"],
      surfaces: ["slash", "palette"],
      isEnabled: (ctx) =>
        hasPagePicker(ctx)
          ? true
          : { ok: false, reason: "Page picker not available" },
      run: async (ctx) => {
        if (!ctx.requestPagePick) return;
        const cursor = ctx.editor.getTextCursorPosition();
        const picked = await ctx.requestPagePick();
        if (!picked) return;
        const pageId = typeof picked === "string" ? picked : picked.pageId;
        if (!pageId) return;

        const inline = {
          type: PAGE_MENTION_TYPE,
          props: { pageId }
        };
        ctx.editor.transact(() => {
          if (typeof ctx.editor.insertInlineContent === "function") {
            ctx.editor.insertInlineContent([inline]);
          } else {
            ctx.editor.insertBlocks(
              [{ type: "paragraph", content: [inline] }],
              cursor.block,
              "after"
            );
          }
        });
      }
    },
    {
      id: "page.insert-card",
      title: "Page card",
      subtitle: "Insert a card linking to an existing page",
      group: "navigation",
      aliases: ["page link", "link page"],
      keywords: ["page", "card"],
      surfaces: ["slash", "palette"],
      isEnabled: (ctx) =>
        hasPagePicker(ctx)
          ? true
          : { ok: false, reason: "Page picker not available" },
      run: async (ctx) => {
        if (!ctx.requestPagePick) return;
        const cursor = ctx.editor.getTextCursorPosition();
        const picked = await ctx.requestPagePick();
        if (!picked) return;
        const pageId = typeof picked === "string" ? picked : picked.pageId;
        const titleHint =
          typeof picked === "string" ? "" : (picked.title ?? "");
        if (!pageId) return;
        ctx.editor.transact(() => {
          ctx.editor.insertBlocks(
            [
              {
                type: PAGE_CARD_TYPE,
                props: { pageId, titleHint }
              }
            ],
            cursor.block,
            "after"
          );
        });
      }
    },
    {
      id: "page.create-child",
      title: "Create child page",
      subtitle: "Ask the host to create a child page, then insert a reference",
      group: "navigation",
      aliases: ["child page", "subpage"],
      keywords: ["child", "page", "create"],
      surfaces: ["slash", "palette"],
      isEnabled: (ctx) =>
        hasCreateChildPage(ctx)
          ? true
          : { ok: false, reason: "Child page creation not available" },
      run: async (ctx) => {
        const create = ctx.providers?.pages?.createChildPage;
        if (!create) return;
        const cursor = ctx.editor.getTextCursorPosition();
        const created = await create({
          parentPageId: ctx.documentId,
          title: "Untitled"
        });
        if (!created?.id) return;
        ctx.editor.transact(() => {
          ctx.editor.insertBlocks(
            [
              {
                type: CHILD_PAGE_TYPE,
                props: {
                  pageId: created.id,
                  titleHint: created.title ?? "Untitled"
                }
              }
            ],
            cursor.block,
            "after"
          );
        });
      }
    },
    {
      id: "database.insert-view",
      title: "Database view",
      subtitle: "Insert a provider-backed database view (config only)",
      group: "power",
      aliases: ["database", "table view"],
      keywords: ["database", "rows", "table"],
      surfaces: ["slash", "palette"],
      isEnabled: (ctx) =>
        hasDatabaseProvider(ctx)
          ? true
          : { ok: false, reason: "Database provider not available" },
      run: async (ctx) => {
        if (!hasDatabaseProvider(ctx)) return;
        const cursor = ctx.editor.getTextCursorPosition();
        let databaseId = "tasks";
        let viewId = "main-table";
        let viewType: DatabaseViewType = "table";
        let titleHint = "";

        if (ctx.requestDatabaseViewPick) {
          const picked = await ctx.requestDatabaseViewPick();
          if (!picked) return;
          databaseId = picked.databaseId;
          viewId = picked.viewId ?? viewId;
          viewType = (picked.viewType as DatabaseViewType) ?? viewType;
          titleHint = picked.titleHint ?? "";
        }

        ctx.editor.transact(() => {
          ctx.editor.insertBlocks(
            [
              {
                type: DATABASE_VIEW_TYPE,
                props: { databaseId, viewId, viewType, titleHint }
              }
            ],
            cursor.block,
            "after"
          );
        });
      }
    }
  ];
}
