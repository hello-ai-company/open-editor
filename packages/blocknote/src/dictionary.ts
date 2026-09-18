/**
 * Injectable English-default UI strings for OpenEditor-owned chrome.
 * Hosts may override per locale without a full i18n framework.
 */
export type OpenEditorDictionary = {
  outlineTitle: string;
  outlineEmpty: string;
  quickNavTitle: string;
  quickNavPlaceholder: string;
  quickNavEmpty: string;
  commandPaletteTitle: string;
  commandPalettePlaceholder: string;
  commandPaletteEmpty: string;
  recentCommands: string;
  blockReferenceMissing: string;
  blockReferenceUntitled: string;
  copyBlockId: string;
  copyBlockReference: string;
  duplicateBlock: string;
  deleteBlock: string;
  moveBlockUp: string;
  moveBlockDown: string;
  searchDocument: string;
  openCommands: string;
  toggleOutline: string;
};

export const defaultOpenEditorDictionary: OpenEditorDictionary = {
  outlineTitle: "Document",
  outlineEmpty: "No headings yet",
  quickNavTitle: "Go to block",
  quickNavPlaceholder: "Search headings and blocks…",
  quickNavEmpty: "No matching blocks",
  commandPaletteTitle: "Commands",
  commandPalettePlaceholder: "Type a command…",
  commandPaletteEmpty: "No matching commands",
  recentCommands: "Recent",
  blockReferenceMissing: "Missing block",
  blockReferenceUntitled: "Untitled",
  copyBlockId: "Copy block ID",
  copyBlockReference: "Copy block reference",
  duplicateBlock: "Duplicate",
  deleteBlock: "Delete",
  moveBlockUp: "Move up",
  moveBlockDown: "Move down",
  searchDocument: "Search",
  openCommands: "Commands",
  toggleOutline: "Outline"
};

export function createOpenEditorDictionary(
  overrides?: Partial<OpenEditorDictionary>
): OpenEditorDictionary {
  return { ...defaultOpenEditorDictionary, ...overrides };
}
