// Synthetic Notes integration: real document bridge + draft lifecycle; no remote host.
import { useSyncExternalStore, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import "@hello-ai-company/editor-blocknote/power.css";
import { createEditorDocument } from "@hello-ai-company/editor-core";
import { createExtension, type BlockNoteEditor } from "@blocknote/core";
import { PageRuntimeAccessDeniedError } from "@hello-ai-company/editor-blocknote";
import { createOpenEditorNotesPreset, type NotesDocumentSnapshot, type NotesWorkspaceHost } from "@hello-ai-company/editor-blocknote/notes";
import { NotesWorkspace, NotesWorkspaceModes, type NotesWorkspacePreset } from "@hello-ai-company/editor-blocknote/react";
const scope = { workspaceId: "synthetic-widget-state", actorId: "fixture-only" }, target = { kind: "page", pageId: "source" } as const;
const initial = createEditorDocument([{ id: "body", type: "paragraph", content: "Synthetic source editing" }, { id: "html", type: "oeHtmlWidget", props: { html: "<p>Saved HTML</p>", css: "p{color:teal}", javascript: "savedNeverExecuted()" } }, ...["ready","missing","failure","loading","forbidden", ""].map(pageId => ({ id: "card-"+pageId, type: "pageCard", props: { pageId, titleHint: pageId ? "Stored "+pageId+" title" : "" } })), { id: "child-forbidden", type: "childPage", props: { pageId: "forbidden", titleHint: "Stored child title" } }]);
let saved = initial, revision = 1, writes = 0, editor: BlockNoteEditor<any, any, any> | undefined, rejected = 0, rejectNext = false;
const snapshot = (): NotesDocumentSnapshot => ({ scope, target, revision: "r"+revision, contentRevision: "c"+revision, document: saved, title: "Synthetic widget state", metadata: {}, capabilities: ["document.save"], capabilitySemantics: { "document.save": "test-only" } });
let resolveLoading: ((value: {id:string;title:string}) => void) | undefined;
let recoveredFailure = false;
const host: NotesWorkspaceHost = {
  scope, readDocument: async requested => ({ ...snapshot(), target: requested }), beforeSubmit: async () => undefined,
  commit: async request => { if(request.command.kind !== "document.save") return { status: "denied", target: request.target, operationId: request.operationId }; saved = request.command.document; revision++; writes++; localStorage.setItem("isolated-widget-state-body",JSON.stringify(saved)); return { status: "committed", target: request.target, operationId: request.operationId, persistence: "test-only", historyId: "synthetic-history-"+revision, snapshot: snapshot() }; },
  lookupOperation: async (target,operationId) => ({ status: "unknown",target,operationId }),
  ...(new URLSearchParams(location.search).get("pages") === "unbound" ? {} : { providers: { pages: { getPage: async (pageId: string) => { if(pageId === "missing") return null; if(pageId === "forbidden") throw new PageRuntimeAccessDeniedError(); if(pageId === "failure" && !recoveredFailure) throw Error("Synthetic fetch failed"); if(pageId === "loading") return await new Promise<{id:string;title:string}>(resolve => { resolveLoading=resolve; }); return {id:pageId,title:"Loaded "+pageId+" title"}; } } } })
};
const stored=localStorage.getItem("isolated-widget-state-body"); if(stored) saved=createEditorDocument((JSON.parse(stored) as typeof initial).blocks);
const Rejection=createExtension(({editor})=>({key:"synthetic-source-rejection",mount:()=>editor.onBeforeChange(({tr})=>{if(tr.docChanged&&rejectNext){rejectNext=false;rejected++;return false;}})}));
const preset=createOpenEditorNotesPreset({host,features:[{id:"synthetic-source-rejection",extensions:[Rejection()]}],config:{version:1,title:"Synthetic widget state",navigation:[],documentPanels:["outline"],inspectorPanels:[],locale:"en",appearance:"classic"}});
Object.assign(window,{widgetStateFixture:{get editor(){return editor},read:()=>preset.controller.getState(),saved:()=>saved,writes:()=>writes,rejected:()=>rejected,rejectNext:()=>{rejectNext=true},resolveLoading:()=>resolveLoading?.({id:"loading",title:"Loaded delayed title"}),recoverFailure:()=>{recoveredFailure=true;return preset.pageStore.load("failure")},pageStore:preset.pageStore}});
function Modes({context}:{context:{preset:NotesWorkspacePreset;document:ReactNode;documentTools?:ReactNode}}){const state=useSyncExternalStore(context.preset.controller.subscribe,context.preset.controller.getState,context.preset.controller.getState);if(!state.snapshot)return <>{context.document}</>;return <NotesWorkspaceModes classic beforeModeChange={async()=>{const current=context.preset.controller.getState();return current.dirty||current.pendingEditors||current.composing?false:current.snapshot?.contentRevision??false}} scope={scope} target={target} document={state.draft??state.snapshot.document} documentRevision={state.snapshot.contentRevision} title={state.snapshot.title} composing={state.composing} pendingEditors={state.pendingEditors} documentTools={context.documentTools}>{context.document}</NotesWorkspaceModes>;}
createRoot(document.getElementById("root")!).render(<NotesWorkspace preset={preset} initialTarget={target} renderModes={context=><Modes context={context}/>} renderDocument={context=>{editor=context.editor;return <BlockNoteView editor={context.editor} editable={context.editable} theme="light"/>;}}/>);
