import { createReactBlockSpec } from "@blocknote/react";
import { interactiveBlockMeta } from "../document/widgetInteraction.js";
import type { ReactElement } from "react";
import type { OpenEditorPowerFeature } from "../features/types.js";
import { NotesLegacyLinkPresentation, NotesLegacyMediaPreview, type NotesLegacyPresentationOptions } from "../react/NotesLegacyPresentation.js";
import { NotesDrawingWidget } from "./documentWidgets.js";
import { legacyWhiteboardToDrawing, drawingToLegacyWhiteboard } from "./legacyEditing.js";

type Props = Record<string, string | number>;
type Editor = { isEditable: boolean; document: readonly { id: string; props: Props; children?: readonly unknown[] }[]; updateBlock(id: string, update: { props: Props }): unknown };
function current(editor: Editor, id: string): Props | undefined {
  const visit = (blocks: Editor["document"]): Props | undefined => { for (const item of blocks) { if (item.id === id) return item.props; if (item.children) { const found = visit(item.children as Editor["document"]); if (found) return found; } } return undefined; };
  return visit(editor.document);
}
function patch(editor: Editor, id: string, before: Props, next: Props): void {
  const latest = current(editor, id);
  if (!editor.isEditable || !latest || Object.keys(before).some(key => latest[key] !== before[key])) throw new Error("Legacy content changed or editing permission was revoked");
  editor.updateBlock(id, { props: next });
}
function Fields({ props, fields, styles, readOnly, onChange }: { props: Props; fields: readonly string[]; styles?: readonly string[]; readOnly: boolean; onChange(props: Props): void }): ReactElement {
  return <div className="oe-notes-legacy-fields" contentEditable={false} onKeyDown={event => event.stopPropagation()}>{fields.map(key => <label key={key}>{key}<input aria-label={`Legacy ${key}`} value={props[key] ?? ""} maxLength={4096} disabled={readOnly} onChange={event => onChange({ [key]: event.target.value })} /></label>)}{styles ? <label>Presentation<select aria-label="Legacy presentation" value={props.style ?? props.layout ?? "card"} disabled={readOnly} onChange={event => onChange({ ["style" in props ? "style" : "layout"]: event.target.value })}>{styles.map(style => <option key={style}>{style}</option>)}</select></label> : null}</div>;
}
/** Opt-in existing legacy blocks. No new source identities, automatic asset requests,
 * page navigation or remote shared/database authority are invented by these renderers. */
export function createLegacyNotesEditingFeature(options: NotesLegacyPresentationOptions = {}) {
  return { id: "notes-legacy-editing-v2", blockSpecs: {
    oeLegacyNotesDrawing: createReactBlockSpec({ type: "oeLegacyNotesDrawing", propSchema: { payload: { default: "[]" }, title: { default: "Whiteboard" }, width: { default: 640 }, height: { default: 360 } }, content: "none" }, { meta: interactiveBlockMeta, render: ({ block, editor }) => {
      const coordinateSpace = { width: block.props.width, height: block.props.height };
      let source: string;
      try { source = JSON.stringify(legacyWhiteboardToDrawing(block.props.payload, coordinateSpace)); } catch { return <p contentEditable={false} role="status">Original legacy drawing retained; unsupported format.</p>; }
      return <NotesDrawingWidget source={source} readOnly={!editor.isEditable} onChange={(next, expected) => {
        if (expected !== source) throw new Error("Legacy drawing changed");
        patch(editor as unknown as Editor, block.id, block.props, { payload: drawingToLegacyWhiteboard(next, coordinateSpace) });
      }} />;
    } })(),
    oeLegacyNotesLink: createReactBlockSpec({ type: "oeLegacyNotesLink", propSchema: { url: { default: "" }, title: { default: "" }, description: { default: "" }, style: { default: "card" }, imageURL: { default: "" }, imageAlt: { default: "" } }, content: "none" }, { meta: interactiveBlockMeta, render: ({ block, editor }) => <section className="oe-notes-widget" contentEditable={false}><NotesLegacyLinkPresentation {...block.props} blockId={block.id} options={options} /><Fields props={block.props} fields={["url", "title", "description", "imageURL", "imageAlt"]} styles={["text", "card", "article", "portrait"]} readOnly={!editor.isEditable} onChange={next => patch(editor as unknown as Editor, block.id, block.props, next)} /></section> })(),
    oeLegacyNotesPageLink: createReactBlockSpec({ type: "oeLegacyNotesPageLink", propSchema: { pageId: { default: "" }, title: { default: "" }, description: { default: "" }, style: { default: "card" }, imageURL: { default: "" }, imageAlt: { default: "" } }, content: "none" }, { meta: interactiveBlockMeta, render: ({ block, editor }) => <section className="oe-notes-widget" contentEditable={false}><NotesLegacyLinkPresentation {...block.props} blockId={block.id} url={undefined} options={options} /><Fields props={block.props} fields={["title", "description", "imageURL", "imageAlt"]} styles={["text", "card", "article", "portrait"]} readOnly={!editor.isEditable} onChange={next => patch(editor as unknown as Editor, block.id, block.props, next)} /></section> })(),
    oeLegacyNotesAsset: createReactBlockSpec({ type: "oeLegacyNotesAsset", propSchema: { url: { default: "" }, name: { default: "" }, mimeType: { default: "" }, kind: { default: "file" }, layout: { default: "card" }, caption: { default: "" } }, content: "none" }, { meta: interactiveBlockMeta, render: ({ block, editor }) => <section className="oe-notes-widget" contentEditable={false}><div className="oe-notes-legacy-asset" data-layout={block.props.layout}><strong>{block.props.name}</strong><small>{block.props.kind} · {block.props.mimeType}</small><NotesLegacyMediaPreview blockId={block.id} sourceURL={block.props.url} kind={block.props.kind} name={block.props.name} options={options} />{block.props.caption ? <p>{block.props.caption}</p> : null}</div><Fields props={block.props} fields={["name", "caption"]} styles={["compact", "card"]} readOnly={!editor.isEditable} onChange={next => patch(editor as unknown as Editor, block.id, block.props, next)} /></section> })()
  } } as const satisfies OpenEditorPowerFeature;
}
