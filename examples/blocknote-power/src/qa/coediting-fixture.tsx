// Local synthetic response and memory canonical receipts. No provider, external API or user stores.
import { createRoot } from "react-dom/client";
import { useState, useSyncExternalStore } from "react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import "@hello-ai-company/editor-blocknote/power.css";
import { createEditorDocument } from "@hello-ai-company/editor-core";
import type { BlockNoteEditor } from "@blocknote/core";
import type { DocumentCoeditingPort, DocumentCoeditingProposal, DocumentCoeditingTicket, DocumentCoeditingIdentity } from "@hello-ai-company/editor-blocknote";
import { createOpenEditorNotesPreset, type NotesWorkspaceHost, type NotesDocumentSnapshot, type NotesCommandResult, type NotesCommandRequest, type NotesRecovery } from "@hello-ai-company/editor-blocknote/notes";
import { NotesBlockNoteDocument, type NotesEditorBridge } from "@hello-ai-company/editor-blocknote/react";
const scope = { actorId: "synthetic-coediting", workspaceId: "coediting31-only" };
const document = createEditorDocument([{ id: "first", type: "paragraph", content: [{ type: "text", text: "Alpha source tail", styles: { bold: true } }] }, { id: "second", type: "paragraph", content: "Human writing" }]);
let revision = 1, canonical = document, fault = "none", release: (() => void) | undefined;
const receipts = new Map<string, NotesCommandResult>(), requests: NotesCommandRequest[] = [], tickets: NotesRecovery[] = [], lookups: string[] = [];
const snapshot = (target: NotesDocumentSnapshot["target"]): NotesDocumentSnapshot => ({ scope, target, revision: "r" + revision, contentRevision: "c" + revision, title: "Synthetic document", document: structuredClone(canonical), metadata: {}, capabilities: ["document.save"], capabilitySemantics: { "document.save": "test-only" } });
const host: NotesWorkspaceHost = { scope, readDocument: async target => snapshot(target), beforeSubmit: async value => { tickets.push(structuredClone(value)); }, commit: async request => {
  requests.push(structuredClone(request)); if (fault === "hold") await new Promise<void>(resolve => { release = resolve; });
  let result: NotesCommandResult;
  if (fault === "conflict") result = { status: "conflict", target: request.target, operationId: request.operationId };
  else { if (request.command.kind !== "document.save" || request.expectedRevision !== "r" + revision) throw Error("Synthetic save scope"); canonical = request.command.document; revision++; result = { status: "committed", target: request.target, operationId: request.operationId, snapshot: snapshot(request.target), historyId: "h" + revision, persistence: "test-only" }; }
  receipts.set(request.operationId, result); if (fault === "lost-ack") throw Error("Synthetic lost ACK"); return result;
}, lookupOperation: async (target, operationId) => { lookups.push(operationId); return structuredClone(receipts.get(operationId) ?? { status: "not-found", target, operationId, terminal: true }); } };
const preset = createOpenEditorNotesPreset({ host, config: { version: 1, locale: "en", appearance: "classic" } });
await preset.controller.open({ kind: "page", pageId: "a" });
let port: DocumentCoeditingPort | undefined, editor: BlockNoteEditor<any, any, any>, bridge: NotesEditorBridge, pending: { port: DocumentCoeditingPort; ticket: DocumentCoeditingTicket } | undefined;
let offered: DocumentCoeditingProposal | undefined, lastOperation = "", lastResult: unknown;
const onReady = (value: DocumentCoeditingPort | undefined) => { port = value; };
const coediting = { paneId: "synthetic-pane", onReady, autoPolicy(identity: DocumentCoeditingIdentity) { const { revision: _r, contentRevision: _c, ...scopeIdentity } = identity; return { id: "synthetic-only-policy", version: "1", identity: scopeIdentity, action: "wording" as const, maxSourceChars: 200, maxOutputChars: 200 }; } };
Object.assign(window, { coeditingFixture: { preset, port: () => port, editor: () => editor, bridge: () => bridge, state: () => preset.controller.getState(), read: () => ({ canonical, requests, tickets, lookups, document: preset.controller.getState().draft, port: port?.read(), lastOperation, lastResult }), fault: (value: string) => { fault = value; }, release: () => { release?.(); release = undefined; },
  capture: async () => port?.capture({ blockId: "first", from: 6, to: 12 }), offer: async (ticket: DocumentCoeditingTicket, text: string) => { offered = await port?.offer(ticket, text); return offered; }, apply: (mode: "reviewed" | "auto-safe" = "reviewed") => { lastResult = offered && port?.apply(offered, mode === "reviewed" ? { mode } : { mode, policyId: "synthetic-only-policy", policyVersion: "1" }); if (lastResult && (lastResult as { applied: boolean }).applied) lastOperation = (lastResult as { operationId: string }).operationId; return lastResult; },
  undo: () => { lastResult = port?.undo(lastOperation); return lastResult; }, setPending: async () => { const ticket = await port?.capture({ blockId: "first", from: 6, to: 12 }); if (ticket && port) pending = { port, ticket }; }, deliver: async () => pending?.port.offer(pending.ticket, "Delayed wording"), retainedPort: () => port
} });
function App() {
  const state = useSyncExternalStore(preset.controller.subscribe, preset.controller.getState, preset.controller.getState), [message, setMessage] = useState(""), [generation, setGeneration] = useState(0);
  const act = async (work: () => unknown | Promise<unknown>) => { try { const result = await work(); setMessage(JSON.stringify(result ?? "No valid synthetic range")); } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Synthetic failure"); } setGeneration(value => value + 1); };
  return <main style={{ maxWidth: 880, margin: "28px auto", padding: 16 }}>
    <p>Local synthetic coediting · no real AI or external service</p>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      <button onClick={() => void act(async () => { const ticket = await port?.capture({ blockId: "first", from: 6, to: 12 }); offered = ticket ? await port?.offer(ticket, "Reworded") : undefined; return offered; })}>Synthetic suggestion</button>
      <button onClick={() => void act(() => { lastResult = offered && port?.apply(offered, { mode: "reviewed" }); if (lastResult && (lastResult as { applied: boolean }).applied) lastOperation = (lastResult as { operationId: string }).operationId; return lastResult; })}>Apply reviewed</button>
      <button onClick={() => void act(() => port?.undo(lastOperation))}>Undo agent change</button>
      <button onClick={() => void act(() => port?.stop())}>Stop</button><button onClick={() => void act(() => port?.resume())}>Resume</button>
      <button onClick={() => void act(() => preset.controller.save({ explicit: true }))}>Save synthetic</button>
      <button onClick={() => void act(() => preset.controller.reconcile())}>Check fixed operation</button>
      <button onClick={() => void act(async () => { const changed = await preset.controller.open({ kind: "page", pageId: state.snapshot?.target.kind === "page" && state.snapshot.target.pageId === "a" ? "b" : "a" }); if (changed) setGeneration(value => value + 1); return changed; })}>Switch document</button>
    </div>
    <p role="status">{state.status} · {state.dirty ? "Unsaved input retained" : "Exact synthetic save confirmed"}</p>
    <span style={{ float: "right", pointerEvents: "none", opacity: .4 }} aria-hidden="true">◌</span>
    <NotesBlockNoteDocument key={JSON.stringify(state.snapshot?.target)} preset={preset} coediting={coediting} onBridge={value => { bridge = value; }} render={value => { editor = value.editor; return <BlockNoteView editor={value.editor} editable={value.editable} sideMenu={false}>{value.sideMenu}</BlockNoteView>; }} />
    <textarea aria-label="Synthetic paste receiver" placeholder="Synthetic clipboard receiver" />
    <output style={{ display: "block", overflowWrap: "anywhere", fontSize: 12 }}>{message}</output><small>Local generation {generation}. Ghost text is excluded from saved content.</small>
  </main>;
}
createRoot(window.document.getElementById("root")!).render(<App />);
