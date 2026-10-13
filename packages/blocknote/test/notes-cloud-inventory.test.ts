import { describe, expect, it } from "vitest";
import { createOpenEditorPowerPreset } from "../src/features/compose.js";
import { createOpenEditorNotesPreset } from "../src/notes/preset.js";
import { createLegacyNotesEditingFeature } from "../src/notes/legacyEditingFeature.js";
import type { NotesWorkspaceHost } from "../src/notes/contracts.js";
const host: NotesWorkspaceHost = {scope:{actorId:"synthetic-inventory",workspaceId:"synthetic-inventory"},readDocument:async()=>{throw new Error("inventory must never read document")},beforeSubmit:async()=>{throw new Error("inventory must never write")},commit:async()=>{throw new Error("inventory must never write")},lookupOperation:async()=>{throw new Error("inventory must never query")}};
const known=["paragraph","heading","bulletListItem","numberedListItem","checkListItem","quote","toggleListItem","callout","codeBlock","divider","oePageBreak","status","table","databaseView","oeColumns","oeColumn","oeHtmlWidget","oeNotesDrawing","oeLegacyNotesDrawing","oeNotesSyncedBlock","pageCard","pageTransclusion","childPage","oeLegacyNotesPageLink","image","audio","video","file","oeLegacyNotesAsset","oeLegacyNotesLink","mathBlock","diagram","oeUnknownBlock"];
describe("cloud runtime schema coverage",()=>{
  it("enumerates Power21, Notes27, legacy31 and legacy31 types without providers",()=>{
    const power=createOpenEditorPowerPreset(),notes=createOpenEditorNotesPreset({host}),legacy=createOpenEditorNotesPreset({host,features:[createLegacyNotesEditingFeature()]});
    expect(Object.keys(power.schema.blockSchema)).toHaveLength(21);
    expect(Object.keys(notes.schema.blockSchema)).toHaveLength(27);
    expect(Object.keys(legacy.schema.blockSchema)).toHaveLength(31);
    expect(Object.keys(legacy.schema.blockSchema).sort()).toEqual(known.filter(type=>!["mathBlock","diagram"].includes(type)).sort());
    notes.dispose();legacy.dispose();
  });
});
