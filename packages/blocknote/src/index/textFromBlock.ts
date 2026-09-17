import type { EditorBlock, JsonValue } from "@hello-ai-company/editor-core";

/** Flatten inline/styled content into plain searchable text. */
export function textFromContent(content: JsonValue | undefined): string {
  if (content === undefined || content === null) return "";
  if (typeof content === "string") return content;
  if (typeof content === "number" || typeof content === "boolean") {
    return String(content);
  }
  if (Array.isArray(content)) {
    return content.map((item) => textFromContent(item)).join("");
  }
  if (typeof content === "object") {
    const record = content as Record<string, JsonValue>;
    if (typeof record.text === "string") return record.text;
    if (record.content !== undefined) return textFromContent(record.content);
    return Object.values(record)
      .map((value) => textFromContent(value))
      .filter(Boolean)
      .join(" ");
  }
  return "";
}

export function textFromBlock(block: EditorBlock): string {
  const fromContent = textFromContent(block.content);
  if (fromContent.trim()) return fromContent;
  const props = block.props ?? {};
  const candidates = ["title", "name", "label", "caption", "text", "code", "src"];
  for (const key of candidates) {
    const value = props[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
}

export function headingLevelFromBlock(block: EditorBlock): number | undefined {
  if (block.type !== "heading") return undefined;
  const level = block.props?.level;
  if (typeof level === "number" && level >= 1 && level <= 6) return level;
  return 1;
}
