/** Ordinary text alignment is separate from table-cell and media alignment. */
export const NOTES_ORDINARY_TEXT_ALIGNMENT_TYPES = ["paragraph", "heading", "bulletListItem", "numberedListItem", "checkListItem", "quote", "callout"] as const;
export const NOTES_TEXT_ALIGNMENTS = ["left", "center", "right", "justify"] as const;
export type NotesTextAlignment = typeof NOTES_TEXT_ALIGNMENTS[number];
export function isOrdinaryTextAlignmentBlock(type: string): boolean {
  return (NOTES_ORDINARY_TEXT_ALIGNMENT_TYPES as readonly string[]).includes(type);
}
export function isNotesTextAlignment(value: unknown): value is NotesTextAlignment {
  return typeof value === "string" && (NOTES_TEXT_ALIGNMENTS as readonly string[]).includes(value);
}
