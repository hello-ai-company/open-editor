export const PAGE_MENTION_TYPE = "pageMention" as const;
export const PAGE_CARD_TYPE = "pageCard" as const;
export const CHILD_PAGE_TYPE = "childPage" as const;
export const DATABASE_VIEW_TYPE = "databaseView" as const;
/** Structured reference to a host database row — never embeds row data. */
export const DATABASE_RELATION_TYPE = "databaseRelation" as const;

export const DATABASE_VIEW_TYPES = [
  "table",
  "board",
  "timeline",
  "gantt",
  "calendar",
  "list",
  "gallery",
  "chart",
  "feed",
  "map",
  "dashboard"
] as const;

export type DatabaseViewType = (typeof DATABASE_VIEW_TYPES)[number];

export function isDatabaseViewType(value: string): value is DatabaseViewType {
  return (DATABASE_VIEW_TYPES as readonly string[]).includes(value);
}
