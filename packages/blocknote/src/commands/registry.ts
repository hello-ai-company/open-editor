import type { EditorProviders } from "@hello-ai-company/editor-core";
import type { DocumentIndex } from "../index/documentIndex.js";
import type { PowerSeams } from "../seams/types.js";
import {
  filterAndRankCommands,
  loadRecentCommandIds,
  rememberCommandId
} from "./match.js";
import { toPartialBlockCopy } from "./blockCopy.js";

export type EditorCommandId = string;

export type CommandGroup =
  | "basic"
  | "headings"
  | "lists"
  | "media"
  | "tables"
  | "power"
  | "document"
  | "collab"
  | "advanced"
  | "navigation";

export type CommandSurface = "slash" | "palette" | "toolbar" | "block-action";

export type EditorCommandContext = {
  editor: {
    insertBlocks: (
      blocks: Array<Record<string, unknown>>,
      reference: unknown,
      placement?: "before" | "after"
    ) => unknown;
    updateBlock: (block: unknown, update: Record<string, unknown>) => unknown;
    removeBlocks?: (blocks: unknown[]) => unknown;
    getTextCursorPosition: () => { block: unknown };
    setTextCursorPosition?: (block: unknown, placement?: "start" | "end") => void;
    focus?: () => void;
    getPrevBlock?: (block: unknown) => unknown;
    getNextBlock?: (block: unknown) => unknown;
    getParentBlock?: (block: unknown) => unknown;
    moveBlocksUp?: (blockIdentifier?: unknown) => void;
    moveBlocksDown?: (blockIdentifier?: unknown) => void;
    insertInlineContent?: (
      content: unknown,
      options?: { updateSelection?: boolean }
    ) => void;
    transact: <T>(fn: () => T) => T;
    document?: unknown;
    domElement?: HTMLElement | null;
  };
  documentId?: string;
  providers?: EditorProviders;
  seams?: PowerSeams;
  /** Shared per-editor document index for navigation / reference picking. */
  documentIndex?: DocumentIndex;
  /**
   * Host/React opens a block picker and returns a target block id.
   * Used by smart block references — must not default to the current block.
   */
  requestBlockPick?: (options?: {
    excludeIds?: readonly string[];
  }) => string | null | Promise<string | null>;
};

export type EditorCommand = {
  id: EditorCommandId;
  title: string;
  subtitle?: string;
  aliases?: string[];
  /** Extra search terms for palette/slash ranking */
  keywords?: string[];
  group: CommandGroup;
  shortcut?: string;
  surfaces: CommandSurface[];
  isAvailable?: (ctx: EditorCommandContext) => boolean;
  isEnabled?: (
    ctx: EditorCommandContext
  ) => boolean | { ok: false; reason: string };
  run: (ctx: EditorCommandContext) => void | Promise<void>;
};

export type SlashItem = {
  title: string;
  subtext?: string;
  aliases?: string[];
  group: string;
  badge?: string;
  onItemClick: () => void;
  commandId: string;
};

export type PaletteItem = {
  id: string;
  title: string;
  subtitle?: string;
  group: CommandGroup;
  shortcut?: string;
  disabledReason?: string;
  recent?: boolean;
};

export type CommandRegistry = {
  list: (
    surface: CommandSurface,
    ctx: EditorCommandContext,
    query?: string
  ) => EditorCommand[];
  get: (id: string) => EditorCommand | undefined;
  run: (id: string, ctx: EditorCommandContext) => Promise<void>;
  extend: (commands: EditorCommand[]) => CommandRegistry;
  toSlashItems: (ctx: EditorCommandContext, query?: string) => SlashItem[];
  toPaletteItems: (ctx: EditorCommandContext, query?: string) => PaletteItem[];
  getRecentIds: () => string[];
};

export function createCommandRegistry(commands: EditorCommand[]): CommandRegistry {
  const byId = new Map<string, EditorCommand>();
  for (const command of commands) {
    if (byId.has(command.id)) {
      throw new Error(`Duplicate command id: ${command.id}`);
    }
    byId.set(command.id, command);
  }

  let recentIds = loadRecentCommandIds();

  const registry: CommandRegistry = {
    list(surface, ctx, query = "") {
      const filtered = [...byId.values()]
        .filter((command) => command.surfaces.includes(surface))
        .filter((command) => command.isAvailable?.(ctx) ?? true);
      return filterAndRankCommands(filtered, { query, recentIds });
    },
    get(id) {
      return byId.get(id);
    },
    async run(id, ctx) {
      const command = byId.get(id);
      if (!command) {
        throw new Error(`Unknown command id: ${id}`);
      }
      if (command.isAvailable && !command.isAvailable(ctx)) {
        throw new Error(`Command unavailable: ${id}`);
      }
      const enabled = command.isEnabled?.(ctx) ?? true;
      if (enabled !== true) {
        const reason = typeof enabled === "object" ? enabled.reason : "disabled";
        throw new Error(`Command disabled: ${id} (${reason})`);
      }
      await command.run(ctx);
      recentIds = rememberCommandId(id);
    },
    extend(extra) {
      return createCommandRegistry([...byId.values(), ...extra]);
    },
    toSlashItems(ctx, query = "") {
      return registry.list("slash", ctx, query).map((command) => ({
        title: command.title,
        subtext: command.subtitle,
        aliases: command.aliases,
        group: command.group,
        badge: command.shortcut,
        commandId: command.id,
        onItemClick: () => {
          void registry.run(command.id, ctx);
        }
      }));
    },
    toPaletteItems(ctx, query = "") {
      const recent = new Set(recentIds);
      return registry.list("palette", ctx, query).map((command) => {
        const enabled = command.isEnabled?.(ctx) ?? true;
        return {
          id: command.id,
          title: command.title,
          subtitle: command.subtitle,
          group: command.group,
          shortcut: command.shortcut,
          recent: recent.has(command.id),
          disabledReason:
            enabled === true
              ? undefined
              : typeof enabled === "object"
                ? enabled.reason
                : "Unavailable"
        };
      });
    },
    getRecentIds() {
      return [...recentIds];
    }
  };

  return registry;
}

function insertBlockCommand(
  id: string,
  title: string,
  group: CommandGroup,
  block: Record<string, unknown>,
  aliases?: string[],
  surfaces: CommandSurface[] = ["slash", "palette"],
  keywords?: string[]
): EditorCommand {
  return {
    id,
    title,
    group,
    aliases,
    keywords,
    surfaces,
    run: (ctx) => {
      const cursor = ctx.editor.getTextCursorPosition();
      ctx.editor.transact(() => {
        ctx.editor.insertBlocks([block], cursor.block, "after");
      });
    }
  };
}

export function createDefaultPowerCommands(): EditorCommand[] {
  return [
    insertBlockCommand("block.insert.paragraph", "Paragraph", "basic", {
      type: "paragraph"
    }, ["text"], ["slash", "palette"], ["body"]),
    insertBlockCommand("block.insert.heading1", "Heading 1", "headings", {
      type: "heading",
      props: { level: 1 }
    }, ["h1", "title"], ["slash", "palette"], ["heading"]),
    insertBlockCommand("block.insert.heading2", "Heading 2", "headings", {
      type: "heading",
      props: { level: 2 }
    }, ["h2"], ["slash", "palette"], ["heading"]),
    insertBlockCommand("block.insert.heading3", "Heading 3", "headings", {
      type: "heading",
      props: { level: 3 }
    }, ["h3"], ["slash", "palette"], ["heading"]),
    insertBlockCommand("block.insert.bullet", "Bullet list", "lists", {
      type: "bulletListItem"
    }, ["ul", "list"]),
    insertBlockCommand("block.insert.numbered", "Numbered list", "lists", {
      type: "numberedListItem"
    }, ["ol"]),
    insertBlockCommand("block.insert.check", "Check list", "lists", {
      type: "checkListItem"
    }, ["todo", "checkbox"]),
    insertBlockCommand("block.insert.table", "Table", "tables", {
      type: "table"
    }, ["grid"]),
    insertBlockCommand(
      "block.insert.callout",
      "Callout",
      "power",
      { type: "callout", props: { variant: "info" } },
      ["alert", "注意", "info"],
      ["slash", "palette"],
      ["callout", "note"]
    ),
    insertBlockCommand(
      "block.insert.status",
      "Status",
      "power",
      { type: "status", props: { state: "todo" } },
      ["badge", "状態", "wip"],
      ["slash", "palette"],
      ["status"]
    ),
    insertBlockCommand("block.insert.code", "Code block", "advanced", {
      type: "codeBlock"
    }, ["code"], ["slash", "palette"], ["syntax"]),
    insertBlockCommand("block.insert.divider", "Divider", "basic", {
      type: "divider"
    }, ["hr", "line"], ["slash", "palette"]),
    {
      id: "media.insert-image",
      title: "Image",
      group: "media",
      aliases: ["picture", "photo"],
      keywords: ["image", "media"],
      surfaces: ["slash", "palette"],
      isAvailable: (ctx) => Boolean(ctx.seams?.files?.upload || ctx.providers?.assets?.upload),
      run: (ctx) => {
        const cursor = ctx.editor.getTextCursorPosition();
        ctx.editor.transact(() => {
          ctx.editor.insertBlocks([{ type: "image" }], cursor.block, "after");
        });
      }
    },
    {
      id: "collab.add-comment",
      title: "Add comment",
      group: "collab",
      aliases: ["comment", "note"],
      keywords: ["annotation"],
      surfaces: ["slash", "palette"],
      isAvailable: (ctx) => Boolean(ctx.seams?.comments?.add || ctx.providers?.comments?.add),
      run: async (ctx) => {
        const comments = ctx.seams?.comments ?? ctx.providers?.comments;
        if (!comments?.add) return;
        const cursor = ctx.editor.getTextCursorPosition();
        const block = cursor.block as { id?: string };
        await comments.add(ctx.documentId ?? "local", block.id ?? "unknown", "Comment");
      }
    },
    {
      id: "document.copy-json",
      title: "Copy document JSON hint",
      subtitle: "Host should serialize EditorDocument on save",
      group: "document",
      keywords: ["export", "serialize"],
      surfaces: ["palette"],
      run: () => {
        // Host owns persistence; palette entry documents the seam.
      }
    },
    {
      id: "block.insert.reference",
      title: "Block reference",
      subtitle: "Insert a link to another block in this document",
      group: "navigation",
      aliases: ["ref", "link block", "mention block"],
      keywords: ["reference", "jump", "goto"],
      surfaces: ["slash", "palette"],
      isEnabled: (ctx) =>
        typeof ctx.requestBlockPick === "function" ||
        Boolean(ctx.documentIndex)
          ? true
          : {
              ok: false,
              reason: "Block picker / document index not available"
            },
      run: async (ctx) => {
        const cursor = ctx.editor.getTextCursorPosition();
        const currentId = (cursor.block as { id?: string }).id;
        const exclude = currentId ? [currentId] : [];

        let targetId: string | null = null;
        if (ctx.requestBlockPick) {
          targetId = await ctx.requestBlockPick({ excludeIds: exclude });
        } else if (ctx.documentIndex) {
          const hits = ctx.documentIndex.query({
            query: "",
            preferHeadings: true,
            limit: 50
          });
          targetId =
            hits.find((hit) => hit.blockId !== currentId)?.blockId ?? null;
        }

        if (!targetId || targetId === currentId) return;

        const inline = {
          type: "blockReference",
          props: { blockId: targetId }
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
    }
  ];
}

export function createBlockActionCommands(): EditorCommand[] {
  return [
    {
      id: "block.duplicate",
      title: "Duplicate",
      group: "document",
      keywords: ["clone", "copy block"],
      surfaces: ["block-action", "palette"],
      run: (ctx) => {
        const cursor = ctx.editor.getTextCursorPosition();
        const partial = toPartialBlockCopy(cursor.block);
        ctx.editor.transact(() => {
          ctx.editor.insertBlocks([partial], cursor.block, "after");
        });
      }
    },
    {
      id: "block.delete",
      title: "Delete",
      group: "document",
      keywords: ["remove"],
      surfaces: ["block-action", "palette"],
      isEnabled: (ctx) =>
        typeof ctx.editor.removeBlocks === "function"
          ? true
          : { ok: false, reason: "Editor cannot remove blocks" },
      run: (ctx) => {
        const cursor = ctx.editor.getTextCursorPosition();
        ctx.editor.removeBlocks?.([cursor.block]);
      }
    },
    {
      id: "block.move-up",
      title: "Move up",
      group: "document",
      surfaces: ["block-action", "palette"],
      isEnabled: (ctx) =>
        typeof ctx.editor.moveBlocksUp === "function"
          ? true
          : { ok: false, reason: "Editor cannot move blocks" },
      run: (ctx) => {
        const cursor = ctx.editor.getTextCursorPosition();
        ctx.editor.moveBlocksUp?.(cursor.block);
      }
    },
    {
      id: "block.move-down",
      title: "Move down",
      group: "document",
      surfaces: ["block-action", "palette"],
      isEnabled: (ctx) =>
        typeof ctx.editor.moveBlocksDown === "function"
          ? true
          : { ok: false, reason: "Editor cannot move blocks" },
      run: (ctx) => {
        const cursor = ctx.editor.getTextCursorPosition();
        ctx.editor.moveBlocksDown?.(cursor.block);
      }
    },
    {
      id: "block.copy-id",
      title: "Copy block ID",
      group: "document",
      keywords: ["id", "uuid"],
      surfaces: ["block-action", "palette"],
      run: async (ctx) => {
        const cursor = ctx.editor.getTextCursorPosition();
        const id = (cursor.block as { id?: string }).id ?? "";
        if (typeof navigator !== "undefined" && navigator.clipboard) {
          await navigator.clipboard.writeText(id);
        }
      }
    },
    {
      id: "block.copy-reference",
      title: "Copy block reference",
      group: "navigation",
      keywords: ["ref"],
      surfaces: ["block-action", "palette"],
      run: async (ctx) => {
        const cursor = ctx.editor.getTextCursorPosition();
        const id = (cursor.block as { id?: string }).id ?? "";
        const payload = JSON.stringify({
          type: "blockReference",
          props: { blockId: id }
        });
        if (typeof navigator !== "undefined" && navigator.clipboard) {
          await navigator.clipboard.writeText(payload);
        }
      }
    }
  ];
}
