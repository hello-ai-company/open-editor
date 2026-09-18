import {
  createInlineContentSpec,
  type InlineContentSpec
} from "@blocknote/core";
import { DATABASE_RELATION_TYPE } from "./types.js";

/**
 * Inline reference to a host database row.
 * Persists { databaseId, rowId } only — never embeds destination row data.
 */
export function createDatabaseRelationInlineContentSpec(): InlineContentSpec<{
  type: typeof DATABASE_RELATION_TYPE;
  propSchema: {
    databaseId: { default: string };
    rowId: { default: string };
  };
  content: "none";
}> {
  return createInlineContentSpec(
    {
      type: DATABASE_RELATION_TYPE,
      propSchema: {
        databaseId: { default: "" },
        rowId: { default: "" }
      },
      content: "none"
    },
    {
      render(inlineContent) {
        const { databaseId, rowId } = inlineContent.props;
        const span = document.createElement("span");
        span.className = "oe-database-relation";
        span.dataset.databaseId = databaseId;
        span.dataset.rowId = rowId;
        span.setAttribute("contenteditable", "false");
        span.setAttribute("role", "note");
        span.textContent =
          databaseId && rowId ? `↗ ${databaseId}/${rowId}` : "↗ Missing row";
        return { dom: span };
      },
      parse(element) {
        if (
          element.tagName === "SPAN" &&
          element.classList.contains("oe-database-relation")
        ) {
          return {
            databaseId: element.getAttribute("data-database-id") ?? "",
            rowId: element.getAttribute("data-row-id") ?? ""
          };
        }
        return undefined;
      }
    }
  );
}
