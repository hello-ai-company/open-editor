import { describe, expect, it } from "vitest";
import { notesLinkValidator, notesInsertionLinkAllowed, notesSafeInsertionLink } from "../src/react/notesLinkPolicy.js";
import type { NotesInsertionHost } from "../src/react/NotesInsertDialog.js";
const scope = { actorId: "actor", workspaceId: "workspace" };
describe("live host link ingress policy", () => {
  it("uses the existing safe insertion URL subset for a restricted host without a custom validator", () => {
    const valid = notesLinkValidator(() => ({ scope, insertion: { scope, pickerInsertKinds: ["link"] } }));
    expect(valid("https://example.invalid")).toBe(true); expect(valid("javascript:alert(1)")).toBe(false);
  });
  it("preserves an explicit host URI validator", () => {
    const valid = notesLinkValidator(() => ({ scope }), href => href.startsWith("private:"));
    expect(valid("private:page")).toBe(true); expect(valid("https://example.invalid")).toBe(false);
  });
  it("blocks owner autolink and pasted link marks, rechecking revocation and foreign scope", () => {
    const insertion: NotesInsertionHost = { scope, pickerInsertKinds: ["link"] };
    const valid = notesLinkValidator(() => ({ scope, insertion }));
    expect(valid("https://example.invalid")).toBe(true); insertion.pickerInsertKinds = [];
    expect(valid("https://example.invalid")).toBe(false); insertion.pickerInsertKinds = ["link"]; insertion.scope = { ...scope, actorId: "foreign" };
    expect(valid("https://example.invalid")).toBe(false);
  });
  it("applies a custom host policy equally to picker and native ingress", () => {
    const insertion: NotesInsertionHost = { scope, pickerInsertKinds: ["link"], isValidLink: href => href === "https://example.invalid/allowed" };
    const policy = { scope, insertion }, native = notesLinkValidator(() => policy);
    for (const href of ["https://example.invalid/allowed", "https://example.invalid/other", "openeditor://page/unapproved", "mailto:owner@example.invalid"]) {
      expect(notesInsertionLinkAllowed(policy, href)).toBe(href.endsWith("/allowed"));
      expect(native(href)).toBe(href.endsWith("/allowed"));
    }
    insertion.isValidLink = () => { throw new Error("Host unavailable"); };
    expect(native("https://example.invalid/allowed")).toBe(false);
    expect(notesInsertionLinkAllowed(policy, "https://example.invalid/allowed")).toBe(false);
  });
  it("fails closed if the bound host disappears or changes owner", () => {
    let insertion: NotesInsertionHost | undefined = { scope, pickerInsertKinds: ["link"] };
    let currentScope = scope;
    const native = notesLinkValidator(() => ({ scope: currentScope, insertion }));
    insertion = undefined; expect(native("https://example.invalid")).toBe(false);
    currentScope = { ...scope, actorId: "other" }; insertion = { scope: currentScope, pickerInsertKinds: ["link"] };
    expect(native("https://example.invalid")).toBe(false);
  });
  it("binds custom-only restrictions to scope without requiring an insert-kind list", () => {
    const insertion: NotesInsertionHost = { scope, isValidLink: () => true };
    expect(notesInsertionLinkAllowed({ scope: { ...scope, workspaceId: "other" }, insertion }, "https://example.invalid")).toBe(false);
    expect(notesInsertionLinkAllowed({ scope, insertion }, "https://example.invalid")).toBe(true);
  });

  it.each([{ linkBlockTypes: ["paragraph"] }, { allowLinkHardBreaks: false }])("binds a picker validator under a context-only restriction %j", restriction => {
    let insertion: NotesInsertionHost | undefined = { scope: { ...scope }, ...restriction };
    let currentScope = { ...scope };
    const picker = notesLinkValidator(() => ({ scope: currentScope, insertion }), notesSafeInsertionLink);
    expect(picker("openeditor://page/authorized")).toBe(true);
    insertion = undefined; expect(picker("https://example.invalid")).toBe(false);
    currentScope = { ...scope, actorId: "foreign" }; insertion = { scope: currentScope, ...restriction };
    expect(picker("https://example.invalid")).toBe(false);
  });

});
