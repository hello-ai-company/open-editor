import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NotesPageIcon } from "../src/react/NotesPageIcon.js";
import { NOTES_LUCIDE_ICONS } from "../src/react/notesLucideIcons.js";
import { NotesLibrary } from "../src/react/NotesNavigation.js";

describe("compatible page icon rendering", () => {
  it("renders the canonical Lucide token with SVG while retaining unknown legacy values as escaped text", () => {
    expect(renderToStaticMarkup(createElement(NotesPageIcon, { value: "lucide:book-open" }))).toContain('data-page-icon="lucide:book-open"');
    expect(renderToStaticMarkup(createElement(NotesPageIcon, { value: "📚" }))).toContain("📚");
    const unknown = renderToStaticMarkup(createElement(NotesPageIcon, { value: '<img src=x onerror=alert(1)>' }));
    expect(unknown).not.toContain("<img"); expect(unknown).toContain("&lt;img");
    expect(renderToStaticMarkup(createElement(NotesPageIcon, { value: "lucide:future-icon" }))).toContain("lucide:future-icon");
  });
  it("ships a bounded static catalog with unique identities and no external resources", () => {
    expect(new Set(NOTES_LUCIDE_ICONS.map(icon => icon.id)).size).toBe(NOTES_LUCIDE_ICONS.length);
    expect(NOTES_LUCIDE_ICONS.filter(icon => icon.category !== "interface").length).toBeGreaterThan(90);
    for (const icon of NOTES_LUCIDE_ICONS) for (const [tag, attributes] of icon.nodes) {
      expect(["path", "circle", "rect", "line", "polyline", "polygon", "ellipse"]).toContain(tag);
      expect(Object.keys(attributes).some(key => key.startsWith("on") || ["href", "src"].includes(key))).toBe(false);
    }
  });
  it("keeps the chosen icon visible on a library card with a cover image", () => {
    const html = renderToStaticMarkup(createElement(NotesLibrary, {
      workspace: { scope: { actorId: "synthetic", workspaceId: "icons" }, revision: "w1", pages: [{ id: "page", title: "Covered page", parentId: null, position: 0, icon: "lucide:book-open", cover: "data:image/png;base64,AA==" }], complete: true, hasMore: false, nextCursor: null },
      getCapabilities: () => [], onOpen: async () => false, onCommand: async target => ({ status: "cancelled" as const, target, operationId: "none" })
    }));
    expect(html).toContain("<img"); expect(html).toContain('class="oe-notes-page-icon-badge"'); expect(html).toContain('data-page-icon="lucide:book-open"');
  });
});
