import { CANVAS_THEME_PRESETS, type CanvasLayoutNode, type CanvasLayoutSpec, type CanvasLayoutValidationIssue, type CanvasRect, type CanvasThemePresetName } from "../index.js";
import {
  duplicateCanvasNode,
  moveCanvasNode,
  reorderCanvasNode,
  setCanvasNodeGap
} from "../layoutOperations.js";
import type { CanvasEditorViewState } from "./CanvasEditor.js";
import { nodeLabel, updateAbsoluteItemRect } from "./canvasEditorUtils.js";

type LayerItem = { node: CanvasLayoutNode; depth: number };

export type CanvasInspectorModel = {
  issues: readonly CanvasLayoutValidationIssue[];
  spec: CanvasLayoutSpec;
  view: CanvasEditorViewState;
  selectedNode: CanvasLayoutNode;
  selectedId: string;
  hidden: ReadonlySet<string>;
  locked: ReadonlySet<string>;
  directlyLocked: boolean;
  isLocked: boolean;
  isRoot: boolean;
  hiddenSelected: boolean;
  previewDestinationCandidates: readonly { node: CanvasLayoutNode }[];
  gapNodeId?: string;
  resolvedGap: number;
  absoluteRect?: CanvasRect;
  layerItems: readonly LayerItem[];
};

export function CanvasInspector(props: {
  headingId: string;
  model: CanvasInspectorModel;
  onViewUpdate: (patch: Partial<CanvasEditorViewState>) => void;
  onSpecUpdate: (spec: CanvasLayoutSpec, changedTheme?: boolean) => void;
}) {
  const { headingId, model, onViewUpdate, onSpecUpdate } = props;
  const {
    issues, spec, view, selectedNode, selectedId, hidden, locked,
    directlyLocked, isLocked, isRoot, hiddenSelected,
    previewDestinationCandidates, gapNodeId, resolvedGap, absoluteRect, layerItems
  } = model;
  const allPresets = Object.keys(CANVAS_THEME_PRESETS) as CanvasThemePresetName[];
  const presetValue = typeof spec.theme === "string" ? spec.theme : "custom";

  return <aside className="oe-canvas__inspector" aria-label="Canvas inspector">
    {issues.length > 0 ? <p className="oe-canvas__notice" role="status">{issues.filter(({ code }) => code === "MISSING_BLOCK_REFERENCE").length} layout reference(s) point to content that is no longer available.</p> : null}
    <section className="oe-canvas__section" aria-labelledby={`${headingId}-theme-heading`}>
      <h3 id={`${headingId}-theme-heading`}>Theme</h3>
      <label className="oe-canvas__field">Canvas theme
        <select aria-label="Canvas theme" value={presetValue} onChange={(event) => {
          const selectedTheme = event.currentTarget.value as CanvasThemePresetName;
          onSpecUpdate({ ...spec, theme: selectedTheme }, true);
        }}>
          {presetValue === "custom" ? <option value="custom" disabled>Custom theme</option> : null}
          {allPresets.map((name) => <option value={name} key={name}>{name[0]!.toUpperCase() + name.slice(1)}</option>)}
        </select>
      </label>
    </section>
    <section className="oe-canvas__section" aria-labelledby={`${headingId}-selection-heading`}>
      <h3 id={`${headingId}-selection-heading`}>Selected layout</h3>
      <p className="oe-canvas__selected">{nodeLabel(selectedNode)}</p>
      <div className="oe-canvas__actions">
        <button type="button" onClick={() => { const next = reorderCanvasNode(spec, selectedNode.id, -1); if (next) onSpecUpdate(next); }} disabled={isLocked || isRoot}>Move up</button>
        <button type="button" onClick={() => { const next = reorderCanvasNode(spec, selectedNode.id, 1); if (next) onSpecUpdate(next); }} disabled={isLocked || isRoot}>Move down</button>
        <button type="button" onClick={() => { const next = duplicateCanvasNode(spec, selectedNode.id); if (next) onSpecUpdate(next); }} disabled={isLocked || isRoot}>Duplicate</button>
        <button type="button" onClick={() => onViewUpdate({ hiddenNodeIds: hiddenSelected ? view.hiddenNodeIds.filter((id) => id !== selectedNode.id) : [...view.hiddenNodeIds, selectedNode.id] })}>{hiddenSelected ? "Show" : "Hide"}</button>
        <button type="button" disabled={isLocked && !directlyLocked} onClick={() => onViewUpdate({ lockedNodeIds: directlyLocked ? view.lockedNodeIds.filter((id) => id !== selectedNode.id) : [...view.lockedNodeIds, selectedNode.id] })}>{directlyLocked ? "Unlock" : isLocked ? "Locked by parent" : "Lock"}</button>
      </div>
      <label className="oe-canvas__field">Move into
        <select aria-label="Move into layout group" value="" disabled={isLocked} onChange={(event) => {
          const target = event.currentTarget.value;
          const next = target ? moveCanvasNode(spec, selectedNode.id, target) : null;
          if (next) onSpecUpdate(next);
        }}>
          <option value="">Choose a group</option>
          {previewDestinationCandidates.map(({ node }) => <option value={node.id} key={node.id}>{nodeLabel(node)}</option>)}
        </select>
      </label>
    </section>
    <section className="oe-canvas__section" aria-labelledby={`${headingId}-alignment-heading`}>
      <h3 id={`${headingId}-alignment-heading`}>Alignment</h3>
      <div className="oe-canvas__alignments">
        {(["left", "center", "right", "stretch"] as const).map((alignment) => <button type="button" key={alignment} aria-label={`Align ${alignment}`} aria-pressed={(view.alignmentByNodeId[selectedNode.id] ?? "left") === alignment} disabled={isLocked} onClick={() => onViewUpdate({ alignmentByNodeId: { ...view.alignmentByNodeId, [selectedNode.id]: alignment } })}>{alignment === "left" ? "Left" : alignment === "center" ? "Center" : alignment === "right" ? "Right" : "Fill"}</button>)}
      </div>
    </section>
    <section className="oe-canvas__section" aria-labelledby={`${headingId}-spacing-heading`}>
      <h3 id={`${headingId}-spacing-heading`}>Spacing</h3>
      <label className="oe-canvas__field">Gap · {view.breakpoint}
        <input type="number" aria-label={`Gap ${view.breakpoint}`} min="0" max="256" step="4" value={resolvedGap} disabled={isLocked || !gapNodeId} onChange={(event) => {
          const next = setCanvasNodeGap(spec, gapNodeId ?? "", view.breakpoint, Number(event.currentTarget.value));
          if (next) onSpecUpdate(next);
        }} />
      </label>
    </section>
    {absoluteRect ? <section className="oe-canvas__section" aria-labelledby={`${headingId}-position-heading`}>
      <h3 id={`${headingId}-position-heading`}>Position &amp; size · {view.breakpoint}</h3>
      {(["x", "y", "width", "height"] as const).map((key) => <label className="oe-canvas__field" key={key}>{key === "x" ? "Position X" : key === "y" ? "Position Y" : key === "width" ? "Width" : "Height"}
        <input type="number" aria-label={`${key === "x" ? "Position X" : key === "y" ? "Position Y" : key === "width" ? "Width" : "Height"} ${view.breakpoint}`} min={key === "x" || key === "y" ? 0 : 1} max="100" step="1" value={absoluteRect[key]} disabled={isLocked} onChange={(event) => {
          const next = updateAbsoluteItemRect(spec, selectedNode.id, view.breakpoint, { ...absoluteRect, [key]: Number(event.currentTarget.value) });
          if (next) onSpecUpdate(next);
        }} />
      </label>)}
    </section> : null}
    <section className="oe-canvas__section" aria-labelledby={`${headingId}-layers-heading`}>
      <h3 id={`${headingId}-layers-heading`}>Layers</h3>
      <ul className="oe-canvas__layers">
        {layerItems.map(({ node, depth }) => <li key={node.id}><button type="button" aria-pressed={selectedId === node.id} aria-label={`Select ${nodeLabel(node)}${hidden.has(node.id) ? ", hidden" : ""}${locked.has(node.id) ? ", locked" : ""}`} onClick={() => onViewUpdate({ selectedNodeId: node.id })} style={{ paddingLeft: `${8 + depth * 14}px` }}>{nodeLabel(node)}{hidden.has(node.id) ? " · hidden" : ""}{locked.has(node.id) ? " · locked" : ""}</button></li>)}
      </ul>
    </section>
  </aside>;
}
