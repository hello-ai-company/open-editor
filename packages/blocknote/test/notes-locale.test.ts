import { describe, expect, it } from "vitest";
import { en, ja } from "@blocknote/core/locales";
import { notesEditorDictionary, createOpenEditorNotesPreset } from "../src/notes/preset.js";
import { createPowerEditorOptions } from "../src/schema/createOpenEditorBlockNoteSchema.js";
import type { NotesWorkspaceHost } from "../src/notes/contracts.js";
describe("Notes native locale", () => {
  it.each([undefined,"ja","ja-JP","JA-jp"])("uses native Japanese for %s", locale => { expect(notesEditorDictionary(locale)).toBe(ja); });
  it.each(["en","en-US","unknown"])("uses English fallback for %s", locale => { expect(notesEditorDictionary(locale)).toBe(en); });
  it("forwards an explicit custom dictionary without mutation", () => { const custom = {...en,formatting_toolbar:{...en.formatting_toolbar,bold:{...en.formatting_toolbar.bold,tooltip:"Host bold"}}}; expect(createPowerEditorOptions({dictionary:custom}).dictionary).toBe(custom); expect(en.formatting_toolbar.bold.tooltip).toBe("Bold"); });
  it("keeps explicit host translations in the standard Notes writer options", () => {
    const host = {scope:{actorId:"synthetic",workspaceId:"locale"}} as NotesWorkspaceHost;
    const custom = {...ja,formatting_toolbar:{...ja.formatting_toolbar,bold:{...ja.formatting_toolbar.bold,tooltip:"Host bold"}}};
    const preset=createOpenEditorNotesPreset({host,config:{version:1,locale:"ja"},dictionary:custom});
    expect(preset.editorOptions().dictionary).toBe(custom); expect(preset.editorOptions({dictionary:en}).dictionary).toBe(en); preset.dispose();
  });
  it("binds config to the preset while preserving a per-editor override", () => {
    const host = {scope:{actorId:"synthetic",workspaceId:"locale"}} as NotesWorkspaceHost;
    const preset = createOpenEditorNotesPreset({host,config:{version:1,locale:"ja-JP"}});
    expect(preset.editorOptions().dictionary).toBe(ja); expect(preset.editorOptions({dictionary:en}).dictionary).toBe(en); preset.dispose();
  });
});
