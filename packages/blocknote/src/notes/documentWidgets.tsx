import { createReactBlockSpec } from "@blocknote/react";
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactElement } from "react";
import type { OpenEditorPowerFeature } from "../features/types.js";
import { copyLegacyNotesJson } from "../document/legacyNotes.js";
import { createHtmlWidgetPreview, parseHtmlWidgetSource, type HtmlWidgetSource } from "../document/htmlWidget.js";
import { createRevisionedNotesResourceEditor, type NotesResourceOutcome, type NotesResourceRecovery, type NotesResourceRequest, type NotesResourceResult } from "../workspace/revisionedNotesResource.js";

export const NOTES_DRAWING_TYPE = "oeNotesDrawing" as const;
export const NOTES_SYNCED_TYPE = "oeNotesSyncedBlock" as const;
export const NOTES_DRAWING_LIMITS = { characters: 750_000, strokes: 256, pointsPerStroke: 4096, points: 20_000 } as const;
export type NotesDrawingPoint = { x: number; y: number };
export type NotesDrawingTool = "pen" | "highlighter" | "line" | "rectangle" | "ellipse";
export type NotesDrawingStroke = { id: string; tool: NotesDrawingTool; color: string; width: number; points: NotesDrawingPoint[] };
export type NotesDrawingDocument = { version: 1; width: number; height: number; strokes: NotesDrawingStroke[] };
export type NotesDrawingPayload = { editable: true; original: string; document: NotesDrawingDocument } | { editable: false; original: string; reason: string };
const drawingTools: readonly NotesDrawingTool[] = ["pen", "highlighter", "line", "rectangle", "ellipse"];
const exact = (value: object, keys: readonly string[]): boolean => Object.keys(value).length === keys.length && Object.keys(value).every(key => keys.includes(key));
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const numberIn = (value: unknown, min: number, max: number): value is number => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
const identity = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 256;
export function createEmptyNotesDrawing(): string { return JSON.stringify({ version: 1, width: 960, height: 540, strokes: [] }); }
/** Unknown versions/fields and oversize payloads remain untouched and non-editable. No partial/truncated drawing is written. */
export function inspectNotesDrawingPayload(source: string): NotesDrawingPayload {
  try {
    if (typeof source !== "string" || source.length > NOTES_DRAWING_LIMITS.characters) throw new Error("Drawing exceeds the safe editing budget. Original payload is retained.");
    const parsed: unknown = JSON.parse(source);
    if (!record(parsed) || !exact(parsed, ["version", "width", "height", "strokes"]) || parsed.version !== 1 || !numberIn(parsed.width, 96, 2048) || !numberIn(parsed.height, 96, 2048) || !Array.isArray(parsed.strokes) || parsed.strokes.length > NOTES_DRAWING_LIMITS.strokes) throw new Error("Unsupported drawing payload. Original data is retained.");
    let pointCount = 0;
    const ids = new Set<string>();
    for (const stroke of parsed.strokes) {
      if (!record(stroke) || !exact(stroke, ["id", "tool", "color", "width", "points"]) || !identity(stroke.id) || ids.has(stroke.id) || !drawingTools.includes(stroke.tool as NotesDrawingTool) || typeof stroke.color !== "string" || !/^#[a-f0-9]{6}$/i.test(stroke.color) || !numberIn(stroke.width, 1, 32) || !Array.isArray(stroke.points) || stroke.points.length < 1 || stroke.points.length > NOTES_DRAWING_LIMITS.pointsPerStroke) throw new Error("Unsupported drawing stroke. Original data is retained.");
      ids.add(stroke.id); pointCount += stroke.points.length;
      if (pointCount > NOTES_DRAWING_LIMITS.points || (["line", "rectangle", "ellipse"].includes(String(stroke.tool)) && stroke.points.length !== 2)) throw new Error("Drawing exceeds its point budget. Original data is retained.");
      for (const point of stroke.points) if (!record(point) || !exact(point, ["x", "y"]) || !numberIn(point.x, 0, parsed.width) || !numberIn(point.y, 0, parsed.height)) throw new Error("Invalid drawing coordinates. Original data is retained.");
    }
    return { editable: true, original: source, document: parsed as unknown as NotesDrawingDocument };
  } catch (error) { return { editable: false, original: source, reason: error instanceof Error ? error.message : "Invalid drawing; original retained" }; }
}
export type NotesDrawingAction = { kind: "add"; stroke: NotesDrawingStroke } | { kind: "delete"; id: string } | { kind: "erase"; ids: readonly string[] } | { kind: "move"; id: string; dx: number; dy: number } | { kind: "clear"; confirmed: true };
export function changeNotesDrawing(source: string, action: NotesDrawingAction): string {
  const inspected = inspectNotesDrawingPayload(source);
  if (!inspected.editable) throw new Error(inspected.reason);
  const document = structuredClone(inspected.document);
  if (action.kind === "add") document.strokes.push(structuredClone(action.stroke));
  else if (action.kind === "clear") { if (action.confirmed !== true) throw new Error("Confirm clearing the drawing first"); document.strokes = []; }
  else if (action.kind === "erase") { if (!Array.isArray(action.ids) || action.ids.length > NOTES_DRAWING_LIMITS.strokes || new Set(action.ids).size !== action.ids.length || action.ids.some(id => !document.strokes.some(stroke => stroke.id === id))) throw new Error("Invalid eraser selection"); const ids = new Set(action.ids); document.strokes = document.strokes.filter(stroke => !ids.has(stroke.id)); }
  else {
    const index = document.strokes.findIndex(stroke => stroke.id === action.id);
    if (index < 0) throw new Error("The selected stroke no longer exists");
    if (action.kind === "delete") document.strokes.splice(index, 1);
    else if (action.kind === "move") {
      if (!Number.isFinite(action.dx) || !Number.isFinite(action.dy)) throw new Error("Invalid drawing movement");
      const stroke = document.strokes[index]!;
      const xs = stroke.points.map(point => point.x), ys = stroke.points.map(point => point.y);
      const dx = Math.max(-Math.min(...xs), Math.min(document.width - Math.max(...xs), action.dx));
      const dy = Math.max(-Math.min(...ys), Math.min(document.height - Math.max(...ys), action.dy));
      stroke.points = stroke.points.map(point => ({ x: point.x + dx, y: point.y + dy }));
    } else throw new Error("Unsupported drawing action");
  }
  const next = JSON.stringify(document), checked = inspectNotesDrawingPayload(next);
  if (!checked.editable) throw new Error(checked.reason);
  return next;
}
export type NotesDrawingHistory = {
  getSource(): string; canUndo(): boolean; canRedo(): boolean;
  apply(currentSource: string, action: NotesDrawingAction): string;
  undo(currentSource: string): string; redo(currentSource: string): string;
};
/** Exact original strings are kept for Undo; later human/host changes fence history rather than overwrite them. */
export function createNotesDrawingHistory(source: string): NotesDrawingHistory {
  let current = source, past: string[] = [], future: string[] = [];
  const compare = (actual: string): void => { if (actual !== current) throw new Error("Drawing changed elsewhere. Reopen to keep both edits."); };
  const trim = (): void => { while (past.length > 50 || past.reduce((size, value) => size + value.length, 0) > 8_000_000) past.shift(); };
  return {
    getSource: () => current, canUndo: () => past.length > 0, canRedo: () => future.length > 0,
    apply: (actual, action) => { compare(actual); const next = changeNotesDrawing(current, action); if (next !== current) { past.push(current); trim(); current = next; future = []; } return current; },
    undo: actual => { compare(actual); const prior = past.pop(); if (prior === undefined) return current; future.push(current); current = prior; return current; },
    redo: actual => { compare(actual); const next = future.pop(); if (next === undefined) return current; past.push(current); trim(); current = next; return current; }
  };
}
const bounds = (stroke: NotesDrawingStroke) => ({ minX: Math.min(...stroke.points.map(p => p.x)), maxX: Math.max(...stroke.points.map(p => p.x)), minY: Math.min(...stroke.points.map(p => p.y)), maxY: Math.max(...stroke.points.map(p => p.y)) });
function segmentDistance(point: NotesDrawingPoint, a: NotesDrawingPoint, b: NotesDrawingPoint): number {
  const length = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  const t = length ? Math.max(0, Math.min(1, ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / length)) : 0;
  return Math.hypot(point.x - a.x - t * (b.x - a.x), point.y - a.y - t * (b.y - a.y));
}
export function hitNotesDrawingStroke(document: NotesDrawingDocument, point: NotesDrawingPoint): string | undefined {
  for (const stroke of [...document.strokes].reverse()) {
    const b = bounds(stroke), tolerance = Math.max(8, stroke.width / 2 + 3);
    if (stroke.tool === "rectangle" || stroke.tool === "ellipse") {
      if (point.x >= b.minX - tolerance && point.x <= b.maxX + tolerance && point.y >= b.minY - tolerance && point.y <= b.maxY + tolerance) return stroke.id;
    } else if (stroke.points.some((p, i) => segmentDistance(point, p, stroke.points[i + 1] ?? p) <= tolerance)) return stroke.id;
  }
  return undefined;
}
function StrokeGraphic({ stroke }: { stroke: NotesDrawingStroke }): ReactElement {
  const b = bounds(stroke), style = { fill: "none", stroke: stroke.color, strokeWidth: stroke.width, opacity: stroke.tool === "highlighter" ? 0.35 : 1, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  if (stroke.tool === "rectangle") return <rect {...style} x={b.minX} y={b.minY} width={b.maxX - b.minX} height={b.maxY - b.minY} />;
  if (stroke.tool === "ellipse") return <ellipse {...style} cx={(b.minX + b.maxX) / 2} cy={(b.minY + b.maxY) / 2} rx={(b.maxX - b.minX) / 2} ry={(b.maxY - b.minY) / 2} />;
  if (stroke.points.length === 1) return <circle cx={stroke.points[0]!.x} cy={stroke.points[0]!.y} r={stroke.width / 2} fill={stroke.color} opacity={style.opacity} />;
  return <polyline {...style} points={stroke.points.map(point => `${point.x},${point.y}`).join(" ")} />;
}
/** Canvas export draws only validated vectors; no images, fonts, URLs or external renderer. */
export function paintNotesDrawing(context: CanvasRenderingContext2D, drawing: NotesDrawingDocument): void {
  const inspected = inspectNotesDrawingPayload(JSON.stringify(drawing)); if (!inspected.editable) throw new Error(inspected.reason);
  context.fillStyle = "#ffffff"; context.fillRect(0, 0, drawing.width, drawing.height);
  for (const stroke of drawing.strokes) {
    context.save(); context.strokeStyle = stroke.color; context.fillStyle = stroke.color; context.lineWidth = stroke.width; context.lineCap = "round"; context.lineJoin = "round"; context.globalAlpha = stroke.tool === "highlighter" ? 0.35 : 1; context.beginPath();
    const b = bounds(stroke);
    if (stroke.tool === "rectangle") context.rect(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY);
    else if (stroke.tool === "ellipse") context.ellipse((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, (b.maxX - b.minX) / 2, (b.maxY - b.minY) / 2, 0, 0, Math.PI * 2);
    else if (stroke.points.length === 1) { context.arc(stroke.points[0]!.x, stroke.points[0]!.y, stroke.width / 2, 0, Math.PI * 2); context.fill(); }
    else stroke.points.forEach((point, i) => { if (i === 0) context.moveTo(point.x, point.y); else context.lineTo(point.x, point.y); });
    context.stroke(); context.restore();
  }
}
export type NotesDrawingWidgetProps = { source: string; readOnly?: boolean; onChange(source: string, expectedSource: string): void; onExportPng?(blob: Blob): void };
const tools = ["select", "pen", "highlighter", "eraser", "line", "rectangle", "ellipse"] as const;
export function NotesDrawingWidget({ source, readOnly = false, onChange, onExportPng }: NotesDrawingWidgetProps): ReactElement {
  const inspected = inspectNotesDrawingPayload(source), history = useRef(createNotesDrawingHistory(source));
  const [tool, setTool] = useState<(typeof tools)[number]>("pen"), [color, setColor] = useState("#176b64"), [width, setWidth] = useState(4), [selected, setSelected] = useState<string>(), [preview, setPreview] = useState<NotesDrawingStroke>(), [erased, setErased] = useState<readonly string[]>([]), [error, setError] = useState(""), [clearOpen, setClearOpen] = useState(false), [, refresh] = useState(0);
  const gesture = useRef<{ pointer: number; base: string; start: NotesDrawingPoint; stroke?: NotesDrawingStroke; selected?: string; eraser?: string[]; overflow?: boolean } | undefined>(undefined);
  const clearButton = useRef<HTMLButtonElement>(null), canvasRef = useRef<SVGSVGElement>(null);
  useEffect(() => { if (history.current.getSource() !== source) { history.current = createNotesDrawingHistory(source); gesture.current = undefined; setPreview(undefined); setErased([]); setSelected(undefined); setError(""); } }, [source]);
  const run = (action: NotesDrawingAction | "undo" | "redo"): void => {
    if (readOnly) return;
    try { const next = action === "undo" ? history.current.undo(source) : action === "redo" ? history.current.redo(source) : history.current.apply(source, action); if (next !== source) onChange(next, source); setError(""); refresh(value => value + 1); }
    catch (reason) { history.current = createNotesDrawingHistory(source); setError(reason instanceof Error ? reason.message : "Drawing could not be saved"); }
  };
  if (!inspected.editable) return <section className="oe-notes-widget oe-notes-drawing" contentEditable={false}><strong>Whiteboard</strong><p role="status">{inspected.reason}</p><p>Editing is unavailable. The complete original drawing is preserved.</p></section>;
  const drawing = inspected.document, disabled = readOnly;
  const point = (event: { currentTarget: SVGSVGElement; clientX: number; clientY: number }): NotesDrawingPoint => { const rect = event.currentTarget.getBoundingClientRect(); return { x: Math.max(0, Math.min(drawing.width, (event.clientX - rect.left) / (rect.width || 1) * drawing.width)), y: Math.max(0, Math.min(drawing.height, (event.clientY - rect.top) / (rect.height || 1) * drawing.height)) }; };
  const exportPng = (): void => {
    try { const canvas = document.createElement("canvas"); canvas.width = drawing.width; canvas.height = drawing.height; const context = canvas.getContext("2d"); if (!context) throw new Error("PNG export is unavailable in this browser"); paintNotesDrawing(context, drawing); canvas.toBlob(blob => { if (!blob) { setError("PNG export failed"); return; } if (onExportPng) onExportPng(blob); else { const url = URL.createObjectURL(blob), anchor = document.createElement("a"); anchor.href = url; anchor.download = "openeditor-whiteboard.png"; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 0); } }, "image/png"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "PNG export failed"); }
  };
  return <section className="oe-notes-widget oe-notes-drawing" contentEditable={false} aria-label="Whiteboard" onKeyDown={event => {
    event.stopPropagation(); if (event.nativeEvent.isComposing) return;
    if (event.key === "Escape" && clearOpen) { event.preventDefault(); setClearOpen(false); clearButton.current?.focus(); return; }
    if (event.target !== event.currentTarget.querySelector("svg")) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); run(event.shiftKey ? "redo" : "undo"); }
    else if (selected && (event.key === "Delete" || event.key === "Backspace")) { event.preventDefault(); run({ kind: "delete", id: selected }); setSelected(undefined); }
    else if (selected && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) { event.preventDefault(); const step = event.shiftKey ? 10 : 1; run({ kind: "move", id: selected, dx: event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0, dy: event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0 }); }
    else if (event.key === "Escape") { gesture.current = undefined; setPreview(undefined); setErased([]); setSelected(undefined); }
  }}>
    <header><strong>Whiteboard</strong><span>{drawing.strokes.length} strokes</span></header>
    <div role="toolbar" aria-label="Drawing tools" style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {tools.map(value => <button key={value} type="button" disabled={disabled} aria-pressed={tool === value} onClick={() => { gesture.current = undefined; setPreview(undefined); setErased([]); setTool(value); }}>{value}</button>)}
      <label>Color<input type="color" aria-label="Stroke color" disabled={disabled} value={color} onChange={event => setColor(event.target.value)} /></label>
      <label>Width<input type="range" min="1" max="32" aria-label="Stroke width" disabled={disabled} value={width} onChange={event => setWidth(Number(event.target.value))} /></label>
      <label>Selected stroke<select aria-label="Selected stroke" value={selected ?? ""} onChange={event => { setSelected(event.target.value || undefined); setTool("select"); }}><option value="">None</option>{drawing.strokes.map((stroke, index) => <option key={stroke.id} value={stroke.id}>{index + 1}. {stroke.tool}</option>)}</select></label>
      <button type="button" disabled={disabled || !history.current.canUndo()} onClick={() => run("undo")}>Undo drawing</button><button type="button" disabled={disabled || !history.current.canRedo()} onClick={() => run("redo")}>Redo drawing</button>
      <button type="button" disabled={disabled || !selected} onClick={() => { if (selected) run({ kind: "delete", id: selected }); setSelected(undefined); }}>Delete selected stroke</button>
      <button ref={clearButton} type="button" disabled={disabled || drawing.strokes.length === 0} onClick={() => setClearOpen(true)}>Clear drawing</button><button type="button" onClick={exportPng}>Export PNG</button>
    </div>
    {clearOpen ? <div role="group" aria-label="Confirm clearing whiteboard"><p>Clear all strokes? Undo remains available.</p><button type="button" disabled={disabled} onClick={() => { run({ kind: "clear", confirmed: true }); setSelected(undefined); setClearOpen(false); canvasRef.current?.focus(); }}>Confirm clear</button><button type="button" onClick={() => { setClearOpen(false); clearButton.current?.focus(); }}>Cancel clear</button></div> : null}
    <svg ref={canvasRef} role="img" aria-label="Drawing canvas. Select a stroke to move it with arrow keys or delete it." tabIndex={0} viewBox={`0 0 ${drawing.width} ${drawing.height}`} preserveAspectRatio="none" style={{ display: "block", width: "100%", aspectRatio: `${drawing.width}/${drawing.height}`, background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 12, touchAction: "none", maxHeight: "60vh" }} onPointerDown={event => {
      if (disabled || event.button !== 0 || gesture.current) return; event.preventDefault(); event.currentTarget.focus(); const start = point(event), hit = hitNotesDrawingStroke(drawing, start);
      event.currentTarget.setPointerCapture?.(event.pointerId);
      if (tool === "eraser") { const ids = hit ? [hit] : []; gesture.current = { pointer: event.pointerId, base: source, start, eraser: ids }; setErased(ids); }
      else if (tool === "select") { setSelected(hit); gesture.current = { pointer: event.pointerId, base: source, start, selected: hit }; }
      else { const stroke: NotesDrawingStroke = { id: crypto.randomUUID(), tool, color, width, points: [start] }; if (["line", "rectangle", "ellipse"].includes(tool)) stroke.points.push(start); gesture.current = { pointer: event.pointerId, base: source, start, stroke }; setPreview(stroke); }
    }} onPointerMove={event => {
      const active = gesture.current; if (!active || active.pointer !== event.pointerId) return;
      if (active.eraser) { const hit = hitNotesDrawingStroke(drawing, point(event)); if (hit && !active.eraser.includes(hit)) { active.eraser.push(hit); setErased([...active.eraser]); } return; }
      if (!active.stroke) return;
      const end = point(event); if (["line", "rectangle", "ellipse"].includes(active.stroke.tool)) active.stroke.points[1] = end;
      else if (Math.hypot(end.x - active.stroke.points.at(-1)!.x, end.y - active.stroke.points.at(-1)!.y) >= 1) { if (active.stroke.points.length >= NOTES_DRAWING_LIMITS.pointsPerStroke) active.overflow = true; else active.stroke.points.push(end); }
      setPreview(structuredClone(active.stroke));
    }} onPointerUp={event => {
      const active = gesture.current; if (!active || active.pointer !== event.pointerId) return; gesture.current = undefined; setPreview(undefined); setErased([]); event.currentTarget.releasePointerCapture?.(event.pointerId);
      if (active.base !== source) { setError("Drawing changed while drawing; original data is retained"); return; }
      if (active.overflow) { setError("Stroke exceeds its point budget. The original drawing is retained."); return; }
      const end = point(event);
      if (active.stroke) { if (["line", "rectangle", "ellipse"].includes(active.stroke.tool)) active.stroke.points[1] = end; else if (end.x !== active.stroke.points.at(-1)!.x || end.y !== active.stroke.points.at(-1)!.y) { if (active.stroke.points.length >= NOTES_DRAWING_LIMITS.pointsPerStroke) { setError("Stroke exceeds its point budget; original retained"); return; } active.stroke.points.push(end); } run({ kind: "add", stroke: active.stroke }); }
      else if (active.eraser) { const hit = hitNotesDrawingStroke(drawing, end); if (hit && !active.eraser.includes(hit)) active.eraser.push(hit); if (active.eraser.length) run({ kind: "erase", ids: active.eraser }); }
      else if (active.selected && (end.x !== active.start.x || end.y !== active.start.y)) run({ kind: "move", id: active.selected, dx: end.x - active.start.x, dy: end.y - active.start.y });
    }} onPointerCancel={() => { gesture.current = undefined; setPreview(undefined); setErased([]); }} onLostPointerCapture={() => { gesture.current = undefined; setPreview(undefined); setErased([]); }}>
      {drawing.strokes.filter(stroke => !erased.includes(stroke.id)).map(stroke => <g key={stroke.id}><StrokeGraphic stroke={stroke} />{stroke.id === selected ? <rect x={bounds(stroke).minX - 4} y={bounds(stroke).minY - 4} width={bounds(stroke).maxX - bounds(stroke).minX + 8} height={bounds(stroke).maxY - bounds(stroke).minY + 8} fill="none" stroke="#1d4ed8" strokeWidth="2" strokeDasharray="5 3" /> : null}</g>)}{preview ? <StrokeGraphic stroke={preview} /> : null}
    </svg>
    <p>Select and drag to move. Arrow keys move a selected stroke; Delete removes it. Pointer cancellation keeps the saved drawing.</p>{error ? <p role="alert">{error}</p> : null}
  </section>;
}

export type NotesSharedBlockSnapshot = { sharedId: string; revision: string; body: string; writable: boolean; persistence: "local-only" | "remote-committed" | "test-only" };
export type NotesSharedBlockHost = {
  scope: { workspaceId: string; actorId: string };
  read(sharedId: string, signal: AbortSignal): Promise<NotesSharedBlockSnapshot>;
  /** Host atomically reauthorizes, CASes and patches only body, retaining all unknown fields and an idempotent receipt. */
  commit(request: NotesResourceRequest, signal: AbortSignal): Promise<NotesResourceResult>;
  lookupOperation(resourceId: string, operationId: string): Promise<NotesResourceResult>;
  beforeSubmit(recovery: NotesResourceRecovery, signal: AbortSignal): Promise<void>;
};
export type NotesSharedBlockState = { status: "empty" | "reading" | "ready" | "pending" | "unknown" | "error"; snapshot?: NotesSharedBlockSnapshot; draft: string; dirty: boolean; message: string };
export type NotesSharedBlockController = { subscribe(listener: () => void): () => void; getState(): NotesSharedBlockState; read(): Promise<void>; setDraft(body: string): void; discardDraft(): void; save(): Promise<NotesResourceOutcome>; reconcile(): Promise<NotesResourceResult>; cancel(): void; getRecovery(): NotesResourceRecovery | undefined; dispose(): void };
/** The controller must be kept by the host/preset beyond a widget mount while any recovery ticket exists. */
export function createNotesSharedBlockController(host: NotesSharedBlockHost, sharedId: string, options: { recovery?: NotesResourceRecovery; timeoutMs?: number; operationId?: () => string } = {}): NotesSharedBlockController {
  if (!identity(sharedId) || !identity(host.scope.workspaceId) || !identity(host.scope.actorId)) throw new Error("Invalid shared block scope");
  const scope = JSON.stringify(host.scope), resourceId = JSON.stringify(["shared", host.scope.workspaceId, host.scope.actorId, sharedId]);
  const assertScope = (): void => { if (JSON.stringify(host.scope) !== scope) throw new Error("Shared host scope changed; keep the original draft and recovery ticket"); };
  const editor = createRevisionedNotesResourceEditor({ commit: (request, signal) => { assertScope(); return host.commit(request, signal); }, lookupOperation: (resource, operation) => { assertScope(); return host.lookupOperation(resource, operation); } }, { resourceId, ...options, beforeSubmit: (ticket, signal) => { assertScope(); return host.beforeSubmit(ticket, signal); } });
  let state: NotesSharedBlockState = { status: options.recovery ? "unknown" : "empty", draft: "", dirty: false, message: "" }, reading: AbortController | undefined, generation = 0, disposed = false;
  const listeners = new Set<() => void>(); const notify = (): void => { for (const listener of listeners) { try { listener(); } catch { /* Rendering observers cannot change confirmed host outcomes. */ } } }; const update = (next: Partial<NotesSharedBlockState>): void => { if (!disposed) { state = { ...state, ...next }; notify(); } };
  const validBody = (body: unknown): body is string => typeof body === "string" && body.length <= 100_000;
  const apply = (result: NotesResourceOutcome): void => {
    if (result.status === "committed") {
      const value = result.snapshot.value;
      if (!record(value) || !validBody(value.body)) throw new Error("Invalid shared content receipt");
      update({ status: "ready", snapshot: { sharedId, revision: result.snapshot.revision, body: value.body, writable: state.snapshot?.writable ?? false, persistence: state.snapshot?.persistence ?? "local-only" }, draft: value.body, dirty: false, message: "Shared content save confirmed" });
    } else update({ status: result.status === "unknown" ? "unknown" : "ready", message: result.status === "unknown" ? "Save result unknown. Look up the receipt before any retry." : `Shared content ${result.status}; your draft is retained` });
  };
  return {
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, getState: () => state, getRecovery: editor.getRecovery,
    read: async () => {
      assertScope(); if (disposed || state.dirty || editor.getState().status !== "idle") throw new Error("Save or retain the current shared draft before reading");
      reading?.abort(); const current = ++generation, signal = new AbortController(); reading = signal; update({ status: "reading", message: "" });
      try { const snapshot = await host.read(sharedId, signal.signal); if (disposed || current !== generation || signal.signal.aborted) return; assertScope(); if (!snapshot || snapshot.sharedId !== sharedId || !identity(snapshot.revision) || !validBody(snapshot.body) || typeof snapshot.writable !== "boolean" || !["local-only", "remote-committed", "test-only"].includes(snapshot.persistence)) throw new Error("Invalid shared content snapshot"); update({ status: "ready", snapshot: structuredClone(snapshot), draft: snapshot.body, dirty: false }); }
      catch (error) { if (!disposed && current === generation && !signal.signal.aborted) update({ status: "error", message: error instanceof Error ? error.message : "Shared content unavailable" }); }
    },
    setDraft: body => { assertScope(); if (disposed || state.status !== "ready" || editor.getState().status !== "idle" || !state.snapshot?.writable) throw new Error("Shared content is not editable"); if (!validBody(body)) throw new Error("Shared content exceeds its editing budget; draft retained"); update({ draft: body, dirty: body !== state.snapshot.body }); },
    discardDraft: () => { if (disposed || state.status !== "ready" || editor.getState().status !== "idle" || !state.snapshot) throw new Error("A pending shared draft cannot be discarded"); update({ draft: state.snapshot.body, dirty: false, message: "Local draft discarded. Read latest before editing again." }); },
    save: async () => {
      assertScope(); if (disposed || state.status !== "ready" || !state.dirty || !state.snapshot?.writable || editor.getState().status !== "idle") throw new Error("Shared content cannot be saved now");
      update({ status: "pending", message: "" }); try { const result = await editor.commit(state.snapshot.revision, { kind: "patch", fields: { body: state.draft } }); apply(result); return result; }
      catch (error) { update({ status: editor.getState().status === "unknown" ? "unknown" : "error", message: error instanceof Error ? error.message : "Shared content save failed" }); throw error; }
    },
    reconcile: async () => { if (disposed || editor.getState().status !== "unknown") throw new Error("No shared content receipt to look up"); update({ status: "pending" }); const result = await editor.reconcile(); apply(result); return result; },
    cancel: () => { if (reading) { reading.abort(); generation++; if (state.status === "reading") update({ status: state.snapshot ? "ready" : "empty", message: "Read cancelled" }); } editor.cancel(); },
    dispose: () => { disposed = true; generation++; reading?.abort(); editor.cancel(); listeners.clear(); }
  };
}
export function NotesSharedBlockWidget({ controller, readOnly = false }: { controller: NotesSharedBlockController; readOnly?: boolean }): ReactElement {
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState), [composing, setComposing] = useState(false), [error, setError] = useState(""), [discardOpen, setDiscardOpen] = useState(false);
  const active = useRef(controller), mounted = useRef(true); active.current = controller;
  useEffect(() => { mounted.current = true; const current = controller; setError(""); setDiscardOpen(false); if (controller.getState().status === "empty") void controller.read().catch(error => { if (mounted.current && active.current === current) setError(String(error)); }); return () => { mounted.current = false; }; }, [controller]);
  const invoke = (work: () => Promise<unknown>): void => { const current = controller; setError(""); void work().catch(error => { if (mounted.current && active.current === current) setError(error instanceof Error ? error.message : "Shared content action failed"); }); };
  return <section className="oe-notes-widget oe-notes-shared" contentEditable={false} aria-label="Shared content" onKeyDown={event => { event.stopPropagation(); if (event.key === "Escape" && !event.nativeEvent.isComposing) controller.cancel(); }}><header><strong>Shared content</strong><span>{state.snapshot?.persistence === "remote-committed" ? "Host-backed shared content" : state.snapshot?.persistence === "test-only" ? "Synthetic shared fixture" : "Local only · no remote synchronization"}</span></header>
    <textarea aria-label="Shared block text" value={state.draft} maxLength={100_000} disabled={readOnly || state.status !== "ready" || !state.snapshot?.writable} onCompositionStart={() => setComposing(true)} onCompositionEnd={() => setComposing(false)} onChange={event => { if (readOnly) return; try { controller.setDraft(event.target.value); } catch (error) { setError(String(error)); } }} />
    <button type="button" disabled={readOnly || composing || state.status !== "ready" || !state.dirty || !state.snapshot?.writable} onClick={() => { if (!readOnly) invoke(controller.save); }}>Save shared content</button><button type="button" disabled={state.status !== "unknown"} onClick={() => invoke(controller.reconcile)}>Look up save result</button><button type="button" disabled={state.status !== "pending" && state.status !== "reading"} onClick={controller.cancel}>Cancel shared action</button><button type="button" disabled={composing || state.dirty || state.status === "pending" || state.status === "unknown" || state.status === "reading"} onClick={() => invoke(controller.read)}>Read latest shared content</button><button type="button" disabled={composing || state.status !== "ready" || !state.dirty} onClick={() => setDiscardOpen(true)}>Discard shared draft</button>{discardOpen ? <div role="group" aria-label="Confirm discarding shared draft"><p>Discard only this unsaved draft? Saved shared content stays unchanged.</p><button type="button" disabled={composing || state.status !== "ready"} onClick={() => { try { controller.discardDraft(); setDiscardOpen(false); } catch (error) { setError(String(error)); } }}>Confirm discard draft</button><button type="button" onClick={() => setDiscardOpen(false)}>Keep draft</button></div> : null}<p role="status">{state.message}</p>{error ? <p role="alert">{error}</p> : null}</section>;
}

type WidgetEditor = { document: readonly { id: string; props?: Record<string, unknown>; children?: readonly unknown[] }[]; isEditable: boolean; updateBlock(id: string, update: { props: Record<string, string> }): unknown };
function currentProps(editor: WidgetEditor, id: string): Record<string, unknown> | undefined { const find = (blocks: readonly { id: string; props?: Record<string, unknown>; children?: readonly unknown[] }[]): Record<string, unknown> | undefined => { for (const block of blocks) { if (block.id === id) return block.props; if (block.children) { const nested = find(block.children as typeof blocks); if (nested) return nested; } } return undefined; }; return find(editor.document); }
export function createNotesDrawingBlockSpec() {
  return createReactBlockSpec({ type: NOTES_DRAWING_TYPE, propSchema: { title: { default: "Whiteboard" }, payload: { default: createEmptyNotesDrawing() } }, content: "none" }, { render: ({ block, editor }) => <NotesDrawingWidget source={block.props.payload} readOnly={!editor.isEditable} onChange={(source, expected) => { const target = editor as unknown as WidgetEditor; if (!target.isEditable || currentProps(target, block.id)?.payload !== expected) throw new Error("Drawing changed or editing permission was revoked"); target.updateBlock(block.id, { props: { payload: source } }); }} /> })();
}
export function createNotesSyncedBlockSpec(options: { resolveSharedController?(sharedId: string): NotesSharedBlockController | undefined } = {}) {
  return createReactBlockSpec({ type: NOTES_SYNCED_TYPE, propSchema: { sharedId: { default: "" }, body: { default: "" } }, content: "none" }, { render: ({ block, editor }) => {
    const controller = options.resolveSharedController?.(block.props.sharedId);
    if (controller) return <NotesSharedBlockWidget key={block.props.sharedId} controller={controller} readOnly={!editor.isEditable} />;
    const bounded = block.props.body.length <= 100_000;
    return <section className="oe-notes-widget oe-notes-shared" contentEditable={false}><strong>Shared block · local only</strong><p>No shared host is connected. This text belongs to this document only.</p>{!bounded ? <p role="status">Original text exceeds the editing budget and is preserved unchanged.</p> : <textarea aria-label="Local shared block text" value={block.props.body} disabled={!editor.isEditable} maxLength={100_000} onChange={event => { const target = editor as unknown as WidgetEditor; if (!target.isEditable || currentProps(target, block.id)?.body !== block.props.body) return; target.updateBlock(block.id, { props: { body: event.target.value } }); }} />}</section>;
  } })();
}
export function createNotesDocumentWidgetsFeature(options: { resolveSharedController?(sharedId: string): NotesSharedBlockController | undefined } = {}) {
  return { id: "notes-document-widgets", blockSpecs: { [NOTES_DRAWING_TYPE]: createNotesDrawingBlockSpec(), [NOTES_SYNCED_TYPE]: createNotesSyncedBlockSpec(options) } } as const satisfies OpenEditorPowerFeature;
}

export type NotesHtmlPreset = { id: string; revision: string; title: string; source: HtmlWidgetSource };
/** Generic storage callbacks stay in the host; no implicit localStorage namespace or shared browser account. */
export type NotesHtmlPresetStore = { list(signal: AbortSignal): Promise<readonly NotesHtmlPreset[]>; save(preset: { title: string; source: HtmlWidgetSource }, signal: AbortSignal): Promise<NotesHtmlPreset> };
export function NotesHtmlPresetPicker({ store, source, onApply }: { store: NotesHtmlPresetStore; source: HtmlWidgetSource; onApply(source: HtmlWidgetSource): void }): ReactElement {
  const [presets, setPresets] = useState<readonly NotesHtmlPreset[]>([]), [title, setTitle] = useState(""), [message, setMessage] = useState(""), [busy, setBusy] = useState(false); const generation = useRef(0), work = useRef<AbortController | undefined>(undefined);
  useEffect(() => { const id = ++generation.current, controller = new AbortController(); work.current = controller; setPresets([]); setTitle(""); setMessage(""); setBusy(true); void store.list(controller.signal).then(items => { if (id !== generation.current || controller.signal.aborted) return; if (items.length > 50) throw new Error("Preset list exceeds its budget"); setPresets(items.map(item => { if (!identity(item.id) || !identity(item.revision) || !identity(item.title)) throw new Error("Invalid preset"); return { ...item, source: parseHtmlWidgetSource(item.source) }; })); }).catch(error => { if (id === generation.current && !controller.signal.aborted) setMessage(String(error)); }).finally(() => { if (id === generation.current) setBusy(false); }); return () => { generation.current++; controller.abort(); work.current?.abort(); }; }, [store]);
  return <section className="oe-notes-widget" aria-label="HTML presets"><p>HTML/CSS preview only. JavaScript is retained as source and never executed.</p>{presets.map(preset => <button key={preset.id} type="button" disabled={busy} onClick={() => { try { onApply(parseHtmlWidgetSource(preset.source)); } catch (error) { setMessage(String(error)); } }}>{preset.title}</button>)}<label>Preset name<input aria-label="HTML preset name" maxLength={256} value={title} onChange={event => setTitle(event.target.value)} /></label><button type="button" disabled={busy || !title.trim()} onClick={() => { const id = ++generation.current, controller = new AbortController(); work.current = controller; setBusy(true); let captured: HtmlWidgetSource; try { captured = parseHtmlWidgetSource(source); } catch (error) { setMessage(String(error)); setBusy(false); return; } void store.save({ title: title.trim(), source: captured }, controller.signal).then(saved => { if (id !== generation.current || controller.signal.aborted) return; if (!identity(saved.id) || !identity(saved.revision) || !identity(saved.title)) throw new Error("Invalid saved preset"); setPresets(items => [{ ...saved, source: parseHtmlWidgetSource(saved.source) }, ...items.filter(item => item.id !== saved.id)].slice(0, 50)); setMessage("Preset save confirmed by host"); }).catch(error => { if (id === generation.current && !controller.signal.aborted) setMessage(String(error)); }).finally(() => { if (id === generation.current) setBusy(false); }); }}>Save HTML preset</button><button type="button" disabled={!busy} onClick={() => { generation.current++; work.current?.abort(); setBusy(false); setMessage("Preset action cancelled; host outcome may require verification"); }}>Cancel preset action</button><p role="status">{message}</p></section>;
}
export function renderNotesHtmlPresetPreview(source: unknown): string { return createHtmlWidgetPreview(parseHtmlWidgetSource(source)); }

export type NotesBlockTemplate = { id: string; revision: string; title: string; block: unknown };
/** A template instantiation changes structural IDs only; page/shared/source references and unknown fields survive. */
export function instantiateNotesBlockTemplate(block: unknown, newId: () => string = () => crypto.randomUUID()): unknown {
  const copied = copyLegacyNotesJson(block); let count = 0; const ids = new Set<string>();
  const visit = (value: unknown, depth: number): void => { if (depth > 16 || !record(value) || typeof value.type !== "string" || ++count > 500) throw new Error("Template structure exceeds its budget"); const id = newId(); if (!identity(id) || ids.has(id)) throw new Error("Template IDs must be unique"); ids.add(id); value.id = id; if (value.children !== undefined) { if (!Array.isArray(value.children)) throw new Error("Invalid template children"); value.children.forEach(child => visit(child, depth + 1)); } }; visit(copied, 0); return copied;
}
export function NotesBlockTemplatePicker({ templates, currentBlock, onSave, onInsert, readOnly = false }: { templates: readonly NotesBlockTemplate[]; currentBlock?: unknown; onSave(title: string, block: unknown): Promise<void>; onInsert(block: unknown): void; readOnly?: boolean }): ReactElement {
  const [title, setTitle] = useState(""), [busy, setBusy] = useState(false), [message, setMessage] = useState(""); const mounted = useRef(true), epoch = useRef(0);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; epoch.current++; }; }, []);
  useEffect(() => { epoch.current++; setMessage(""); }, [currentBlock]);
  const style: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 4 };
  return <section className="oe-notes-widget" aria-label="Block templates"><div style={style}>{templates.slice(0, 50).map(template => <button key={template.id} type="button" disabled={busy || readOnly} onClick={() => { try { onInsert(instantiateNotesBlockTemplate(template.block)); } catch (error) { setMessage(String(error)); } }}>{template.title}</button>)}</div><label>Template name<input aria-label="Block template name" maxLength={256} value={title} onChange={event => setTitle(event.target.value)} /></label><button type="button" disabled={busy || readOnly || currentBlock === undefined || !title.trim()} onClick={() => { const generation = ++epoch.current; let block: unknown; try { block = copyLegacyNotesJson(currentBlock); instantiateNotesBlockTemplate(block); } catch (error) { setMessage(String(error)); return; } setBusy(true); void onSave(title.trim(), block).then(() => { if (mounted.current && generation === epoch.current) setMessage("Template save confirmed by host"); }).catch(error => { if (mounted.current && generation === epoch.current) setMessage(String(error)); }).finally(() => { if (mounted.current) setBusy(false); }); }}>Save selected block template</button><p role="status">{message}</p></section>;
}
