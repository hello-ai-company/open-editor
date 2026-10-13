/** @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createNotesLinkInputComposition } from "../src/react/notesLinkPolicy.js";

let workspace: HTMLDivElement, style: HTMLStyleElement;
beforeEach(() => {
  style = document.createElement("style");
  // Match the power.css import order, including the workspace's centered modal rule.
  style.textContent = readFileSync("src/power/notesWorkspace.css", "utf8") + readFileSync("src/power/notesClassic.css", "utf8") + readFileSync("src/power/notesDesign.css", "utf8");
  document.head.append(style);
  workspace = document.createElement("div"); workspace.className = "oe-notes-workspace oe-notes-classic"; document.body.append(workspace);
});
afterEach(() => { workspace.remove(); style.remove(); });

function popup(kind: "create" | "edit", restricted = true, fixed = false) {
  const root = document.createElement("div"); root.className = "oe-notes-blocknote-document";
  if (restricted) root.setAttribute("data-notes-restricted-links", "true");
  // These are the observed native CreateLinkButton and EditLinkButton ancestors.
  const parent = document.createElement(kind === "create" ? "span" : "div");
  parent.className = kind === "create" ? "oe-notes-format-item" : "bn-toolbar bn-link-toolbar mantine-Flex-root";
  if (kind === "create") parent.setAttribute("data-notes-native-item", "createLinkButton");
  const dialog = document.createElement("div");
  dialog.className = "mantine-Popover-dropdown bn-popover-content bn-form-popover"; dialog.setAttribute("role", "dialog");
  if (fixed) dialog.setAttribute("data-fixed", "true");
  dialog.style.cssText = "left:28px;top:51px;width:max-content;max-width:729px;max-height:452px";
  parent.append(dialog); root.append(parent); workspace.append(root);
  return { root, parent, dialog };
}

describe("restricted native link popover positioning", () => {
  it.each(["create", "edit"] as const)("restores the %s popover provider's coordinates without centering it again", kind => {
    const { dialog } = popup(kind), computed = getComputedStyle(dialog);
    expect(computed.position).toBe("absolute"); expect(computed.transform).toBe("none");
    expect(computed.left).toBe("28px"); expect(computed.top).toBe("51px");
    expect(computed.maxWidth).toBe("729px"); expect(computed.maxHeight).toBe("452px");
  });
  it.each(["create", "edit"] as const)("leaves unrestricted %s hosts unchanged", kind => {
    const { dialog } = popup(kind, false), computed = getComputedStyle(dialog);
    expect(computed.position).toBe("fixed"); expect(computed.transform).toBe("translate(-50%,-50%)");
  });
  it("does not override an explicitly fixed native popover strategy", () => {
    const { dialog } = popup("edit", true, true), computed = getComputedStyle(dialog);
    expect(computed.position).toBe("fixed"); expect(computed.transform).toBe("translate(-50%,-50%)");
  });
  it("leaves intended centered SDK dialogs and other native popovers unchanged", () => {
    const { root, parent, dialog } = popup("create");
    parent.setAttribute("data-notes-native-item", "textColorButton");
    const centered = document.createElement("div"); centered.className = "oe-notes-insert-dialog"; centered.setAttribute("role", "dialog"); root.append(centered);
    for (const target of [dialog, centered]) {
      expect(getComputedStyle(target).position).toBe("fixed");
      expect(getComputedStyle(target).transform).toBe("translate(-50%,-50%)");
    }
    expect(getComputedStyle(centered).left).toBe("50%"); expect(getComputedStyle(centered).top).toBe("50%");
  });
});

describe("restricted native link field icon reservation", () => {
  function field(dialog: HTMLElement) {
    const wrapper = document.createElement("div"); wrapper.className = "mantine-Input-wrapper"; wrapper.setAttribute("data-with-left-section", "true");
    const section = document.createElement("div"); section.className = "mantine-Input-section"; section.setAttribute("data-position", "left"); section.style.width = "28px";
    const input = document.createElement("input"); input.className = "mantine-Input-input mantine-TextInput-input";
    // The installed Mantine xs provider resolves this inherited variable to
    // 28px for a leading section. JSDOM retains the var expression rather than
    // resolving logical padding or layout, so assert its binding separately.
    input.style.setProperty("--input-padding-inline-start", "28px");
    wrapper.append(section, input); dialog.append(wrapper); return { input, section };
  }
  it.each(["create", "edit"] as const)("reserves the provider's leading icon space in the %s form", kind => {
    const { input, section } = field(popup(kind).dialog), computed = getComputedStyle(input);
    expect(computed.paddingInlineStart).toBe("var(--input-padding-inline-start)");
    expect(computed.getPropertyValue("--input-padding-inline-start")).toBe(getComputedStyle(section).width);
    expect(computed.paddingTop).toBe("6px"); expect(computed.paddingBottom).toBe("6px"); expect(computed.paddingRight).toBe("6px");
  });
  it.each(["create", "edit"] as const)("leaves the unrestricted %s form unchanged", kind => {
    const { input } = field(popup(kind, false).dialog), computed = getComputedStyle(input);
    expect(computed.padding).toBe("6px"); expect(computed.paddingInlineStart).toBe("");
  });
  it("does not change ordinary inputs, unrelated native menus, or explicit fixed providers", () => {
    const { root, parent, dialog } = popup("create"); parent.setAttribute("data-notes-native-item", "textColorButton");
    const ordinary = root.appendChild(document.createElement("input")), other = field(dialog).input, fixed = field(popup("edit", true, true).dialog).input;
    for (const input of [ordinary, other, fixed]) { expect(getComputedStyle(input).padding).toBe("6px"); expect(getComputedStyle(input).paddingInlineStart).toBe(""); }
  });
});

describe("native field composition lifetime", () => {
  function tracker() {
    const { root, dialog } = popup("edit"), input = document.createElement("input"); dialog.append(input);
    let identity = "owner/page/r1";
    const state = createNotesLinkInputComposition(() => root, () => identity);
    expect(state.start(input)).toBe(true); expect(state.composing).toBe(true);
    return { state, input, root, changeIdentity: () => { identity = "owner/other-page/r2"; } };
  }
  it("clears composition for detached popups before a new command", () => {
    const { state, input } = tracker(); input.remove(); expect(state.composing).toBe(false);
  });
  it("clears composition when the live writer identity changes", () => {
    const { state, changeIdentity } = tracker(); changeIdentity(); expect(state.composing).toBe(false);
  });
  it("clears composition on explicit writer disposal", () => {
    const { state } = tracker(); state.clear(); expect(state.composing).toBe(false);
  });
  it("does not treat another editor or ordinary input as a native link field", () => {
    const { state, root } = tracker(), ordinary = document.createElement("input"), foreign = popup("edit").dialog.appendChild(document.createElement("input"));
    root.append(ordinary); state.clear();
    expect(state.start(ordinary)).toBe(false); expect(state.start(foreign)).toBe(false); expect(state.composing).toBe(false);
  });
});
