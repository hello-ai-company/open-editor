import type { EditorProviders } from "@hello-ai-company/editor-core";
import type { PowerSeams } from "../seams/types.js";

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
  | "advanced";

export type CommandSurface = "slash" | "palette" | "toolbar";

export type EditorCommandContext = {
  editor: {
    insertBlocks: (
      blocks: Array<Record<string, unknown>>,
      reference: unknown,
      placement?: "before" | "after"
    ) => unknown;
    updateBlock: (block: unknown, update: Record<string, unknown>) => unknown;
    getTextCursorPosition: () => { block: unknown };
    transact: <T>(fn: () => T) => T;
    document?: unknown;
    domElement?: HTMLElement | null;
  };
  documentId?: string;
  providers?: EditorProviders;
  seams?: PowerSeams;
};

export type EditorCommand = {
  id: EditorCommandId;
  title: string;
  subtitle?: string;
  aliases?: string[];
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
};

const GROUP_ORDER: CommandGroup[] = [
  "basic",
  "headings",
  "lists",
  "tables",
  "media",
  "power",
  "collab",
  "document",
  "advanced"
];

function groupRank(group: CommandGroup): number {
  const index = GROUP_ORDER.indexOf(group);
  return index === -1 ? GROUP_ORDER.length : index;
}

function matchesQuery(command: EditorCommand, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (command.title.toLowerCase().includes(q)) return true;
  if (command.subtitle?.toLowerCase().includes(q)) return true;
  return Boolean(command.aliases?.some((alias) => alias.toLowerCase().includes(q)));
}

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
};

export function createCommandRegistry(commands: EditorCommand[]): CommandRegistry {
  const byId = new Map<string, EditorCommand>();
  for (const command of commands) {
    if (byId.has(command.id)) {
      throw new Error(`Duplicate command id: ${command.id}`);
    }
    byId.set(command.id, command);
  }

  const registry: CommandRegistry = {
    list(surface, ctx, query = "") {
      return [...byId.values()]
        .filter((command) => command.surfaces.includes(surface))
        .filter((command) => command.isAvailable?.(ctx) ?? true)
        .filter((command) => matchesQuery(command, query))
        .sort((a, b) => groupRank(a.group) - groupRank(b.group) || a.title.localeCompare(b.title));
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
      return registry.list("palette", ctx, query).map((command) => {
        const enabled = command.isEnabled?.(ctx) ?? true;
        return {
          id: command.id,
          title: command.title,
          subtitle: command.subtitle,
          group: command.group,
          shortcut: command.shortcut,
          disabledReason:
            enabled === true
              ? undefined
              : typeof enabled === "object"
                ? enabled.reason
                : "Unavailable"
        };
      });
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
  surfaces: CommandSurface[] = ["slash", "palette"]
): EditorCommand {
  return {
    id,
    title,
    group,
    aliases,
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
    }, ["text"]),
    insertBlockCommand("block.insert.heading1", "Heading 1", "headings", {
      type: "heading",
      props: { level: 1 }
    }, ["h1", "title"]),
    insertBlockCommand("block.insert.heading2", "Heading 2", "headings", {
      type: "heading",
      props: { level: 2 }
    }, ["h2"]),
    insertBlockCommand("block.insert.heading3", "Heading 3", "headings", {
      type: "heading",
      props: { level: 3 }
    }, ["h3"]),
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
      ["alert", "注意", "info"]
    ),
    insertBlockCommand(
      "block.insert.status",
      "Status",
      "power",
      { type: "status", props: { state: "todo" } },
      ["badge", "状態", "wip"]
    ),
    insertBlockCommand("block.insert.code", "Code block", "advanced", {
      type: "codeBlock"
    }, ["code"]),
    insertBlockCommand("block.insert.divider", "Divider", "basic", {
      type: "divider"
    }, ["hr", "line"], ["slash", "palette"]),
    {
      id: "media.insert-image",
      title: "Image",
      group: "media",
      aliases: ["picture", "photo"],
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
      surfaces: ["palette"],
      run: () => {
        // Host owns persistence; palette entry documents the seam.
      }
    }
  ];
}
