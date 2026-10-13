import { createExtension } from "@blocknote/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

/** Non-inline controls own their input events. BlockNote's selectable:false
 * node-view handling keeps ProseMirror from selecting/focusing the outer block
 * when a pointer hits an SVG icon, canvas, summary or widget background.
 * Outer block handles remain responsible for whole-block drag and selection. */
export const interactiveBlockMeta = Object.freeze({ selectable: false as const });
const widgets = ".oe-agent-chat,.oe-notes-drawing,.oe-notes-shared,.oe-html-widget,.oe-document-columns-heading,.oe-document-column-heading,.oe-notes-legacy-fields,.oe-database-view,.oe-page-card,.oe-child-page,.oe-page-transclusion,.oe-status";
const WidgetInputGuard = createExtension(() => ({
  key: "openeditor-widget-input",
  prosemirrorPlugins: [new Plugin({
    key: new PluginKey("openeditor-widget-input"),
    props: { handleDOMEvents: Object.fromEntries(["mousedown", "click", "dblclick", "keydown", "keyup"].map(type => [type, (view: EditorView, event: Event): boolean => {
      const widget = event.target instanceof Element ? event.target.closest(widgets) : undefined;
      // Claim only ProseMirror's handling, without stopping DOM propagation or
      // preventing browser defaults. React/native controls still receive events.
      // Drag/drop and inline column content keep the editor's ordinary handling.
      return Boolean(widget && view.dom.contains(widget));
    }])) }
  })]
}));
/** Notes installs this boundary for host-defined widgets using shared components.
 * Standalone hosts can add it when their own block spec remains selectable. */
export function createInteractiveWidgetInputExtension() { return WidgetInputGuard(); }
