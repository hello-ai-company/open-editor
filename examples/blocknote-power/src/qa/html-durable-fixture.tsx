// Synthetic native source UI + atomic IndexedDB. No original stores, API or AI calls.
import {createRoot} from "react-dom/client";
import {useState, useSyncExternalStore} from "react";
import {BlockNoteView} from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import "@hello-ai-company/editor-blocknote/power.css";
import {createEditorDocument} from "@hello-ai-company/editor-core";
import {createNotesWorkspaceController,createOpenEditorNotesPreset,notesHtmlSourceDraftKey,parseNotesHtmlSourceDraft,sameNotesHtmlSourceDraft,type NotesHtmlSourceDraft,type NotesHtmlSourceDraftJournal,type NotesWorkspaceHost,type NotesDocumentSnapshot,type NotesTarget,type NotesRecovery,type NotesCommandResult,type NotesLayoutState} from "@hello-ai-company/editor-blocknote/notes";
import {NotesTabbedWorkspace,NotesBlockNoteDocument} from "@hello-ai-company/editor-blocknote/react";
const scope={actorId:"synthetic-html-human",workspaceId:"html27-only"},target={kind:"page",pageId:"source"} as const;
const original={html:"<p>Saved synthetic HTML</p>\n",css:"p {color: teal}\n",javascript:"window.UNAUTHORIZED_JS_EXECUTED=true;\n"};
const parent=createEditorDocument([{id:"protected",type:"paragraph",content:"Canonical body is separate from raw input"},{id:"html-widget",type:"oeHtmlWidget",props:{title:"Durable HTML",...original}}]);
const layout:NotesLayoutState={version:1,scope,tabs:[{id:"source",target,title:"Source",pinned:false},{id:"destination",target:{kind:"page",pageId:"destination"},title:"Destination",pinned:false}],activeTabId:"source",split:{axis:"horizontal",tabIds:[]},previewTabId:null};
type Store={revision:number;parent:typeof parent;raw:Record<string,NotesHtmlSourceDraft>;tickets:Record<string,NotesRecovery>;receipts:Record<string,NotesCommandResult>;events:{kind:string;operationId?:string}[]};
const initial=():Store=>({revision:1,parent:structuredClone(parent),raw:{},tickets:{},receipts:{},events:[]});
const db=await new Promise<IDBDatabase>((resolve,reject)=>{const q=indexedDB.open("openeditor-html27-synthetic-only",1);q.onupgradeneeded=()=>q.result.createObjectStore("fixture");q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
async function transaction<T>(write:boolean,work:(s:Store)=>T):Promise<T>{return new Promise((resolve,reject)=>{const tx=db.transaction("fixture",write?"readwrite":"readonly"),store=tx.objectStore("fixture"),q=store.get("state");let result:T;q.onsuccess=()=>{try{const s:Store=q.result??initial();result=work(s);if(write)store.put(s,"state");}catch(e){tx.abort();reject(e)}};tx.oncomplete=()=>resolve(structuredClone(result));tx.onabort=tx.onerror=()=>reject(tx.error??Error("synthetic transaction failed"));});}
await transaction(true,()=>undefined);
let fault="none",pauseRelease:(()=>void)|undefined;
const pause=async()=>{if(fault==="hold-put")await new Promise<void>(r=>pauseRelease=r)};
const journal:NotesHtmlSourceDraftJournal={version:1,compareAndSwap:true,
 list:async(s,t,signal)=>{signal.throwIfAborted();return transaction(false,store=>{if(fault==="foreign-list")return [{...Object.values(store.raw)[0]!,scope:{...scope,actorId:"foreign"}}];return Object.values(store.raw).filter(d=>sameNotesHtmlSourceDraft(d.scope,s)&&sameNotesHtmlSourceDraft(d.target,t));});},
 put:async(next,expected,signal)=>{await pause();signal.throwIfAborted();await transaction(true,s=>{if(fault==="raw-quota")throw Error("raw quota");const d=parseNotesHtmlSourceDraft(next),key=notesHtmlSourceDraftKey(d);if(!sameNotesHtmlSourceDraft(s.raw[key],expected))throw Error("raw CAS");s.raw[key]=d;s.events.push({kind:"raw-put"});});if(fault==="raw-lost-ack")throw Error("raw storage ACK lost");},
 remove:async(expected,signal)=>{signal.throwIfAborted();await transaction(true,s=>{if(fault==="cleanup-quota")throw Error("cleanup quota");const k=notesHtmlSourceDraftKey(expected);if(!sameNotesHtmlSourceDraft(s.raw[k],expected))throw Error("raw remove CAS");delete s.raw[k];s.events.push({kind:"raw-remove"});});}
};
const snapshot=(s:Store,t:NotesTarget=target):NotesDocumentSnapshot=>({scope,target:t,revision:"r"+s.revision,contentRevision:"c"+s.revision,document:s.parent,title:"Source",metadata:{},capabilities:["document.save"],capabilitySemantics:{"document.save":"test-only"}});
const host:NotesWorkspaceHost={scope,sourceDraftJournal:journal,
 readDocument:(t,signal)=>{signal.throwIfAborted();return transaction(false,s=>snapshot(s,t));},
 readWorkspace:async()=>({scope,revision:"catalog",pages:[{id:"source",title:"Source",parentId:null,position:0},{id:"destination",title:"Destination",parentId:null,position:1}],complete:true,nextCursor:null,hasMore:false}),
 beforeSubmit:ticket=>transaction(true,s=>{if(fault==="ticket-quota")throw Error("ticket quota");if(s.tickets[ticket.request.operationId]&&!sameNotesHtmlSourceDraft(s.tickets[ticket.request.operationId],ticket))throw Error("ticket identity");s.tickets[ticket.request.operationId]=ticket;s.events.push({kind:"ticket",operationId:ticket.request.operationId});}),
 commit:async request=>{
  const receipt=await transaction(true,s=>{s.events.push({kind:"commit",operationId:request.operationId});const existing=s.receipts[request.operationId];if(existing)return existing;
   let r:NotesCommandResult;if(fault==="body-denied")r={status:"denied",target:request.target,operationId:request.operationId};else if(request.expectedRevision!=="r"+s.revision)r={status:"conflict",target:request.target,operationId:request.operationId};else if(request.command.kind!=="document.save")throw Error("unsupported fixture write");else{s.parent=request.command.document;s.revision++;r={status:"committed",target:request.target,operationId:request.operationId,historyId:"history-"+s.revision,persistence:"test-only",snapshot:snapshot(s,request.target)};}s.receipts[request.operationId]=r;return r;
  });if(fault==="body-lost-ack")throw Error("body ACK lost");return receipt;
 },lookupOperation:(t,operationId)=>transaction(true,s=>{s.events.push({kind:"lookup",operationId});return s.receipts[operationId]??{status:"not-found",target:t,operationId,terminal:true};})
};
let peer:ReturnType<typeof createOpenEditorNotesPreset>|undefined;
let active:ReturnType<typeof createOpenEditorNotesPreset>|undefined;
const trial=new URLSearchParams(location.search);
const recovery=trial.has("recover")?await transaction(false,s=>Object.values(s.tickets)[0]):undefined;
const preset=createOpenEditorNotesPreset({host,recovery,config:{version:1,navigation:["tree"],documentPanels:["outline"],inspectorPanels:["insert"],appearance:"classic",locale:"en"}});
// Session owns its preset in tabbed mode. A direct native document is used only for two-reader CAS.
if(trial.has("direct")){await preset.controller.open(target);active=preset;}
function Direct(){const [second,setSecond]=useState(false);const state=useSyncExternalStore(preset.controller.subscribe,preset.controller.getState,preset.controller.getState);return <main><button onClick={()=>{peer=createOpenEditorNotesPreset({host});void peer.controller.open(target).then(()=>setSecond(true));}}>Open independent reader</button>{state.snapshot?<NotesBlockNoteDocument onBridge={()=>undefined} preset={preset} render={({editor,editable})=><BlockNoteView editor={editor as never} editable={editable}/>}/>:<p role="status">Checking the saved operation</p>}{second&&peer?<NotesBlockNoteDocument onBridge={()=>undefined} preset={peer} render={({editor,editable})=><BlockNoteView editor={editor as never} editable={editable}/>}/>:null}</main>}
function Tabbed(){return <NotesTabbedWorkspace host={host} initialLayout={layout} initialTarget={target} recoveries={recovery?[recovery]:undefined} config={preset.config} beforeResourceLeave={async({preset:p})=>Boolean(await p.controller.flushSourceDrafts?.())} renderModes={({preset:p,document})=>{active=p;return document;}} renderDocument={({editor,editable})=><BlockNoteView editor={editor as never} editable={editable}/>}/>}

function Debug(){const p=active??preset;const s=useSyncExternalStore(p.controller.subscribe,p.controller.getState,p.controller.getState);return <pre data-debug>{s.status}</pre>}
createRoot(document.getElementById("root")!).render(trial.has("direct")?<Direct/>:<Tabbed/>);
const fixture={scope,target,original,host,journal,read:()=>transaction(false,s=>s),reset:()=>transaction(true,s=>Object.assign(s,initial())),fault:(value:string)=>{fault=value;},release:()=>{fault="none";pauseRelease?.();pauseRelease=undefined;},holding:()=>Boolean(pauseRelease),state:()=>active?.controller.getState(),flush:()=>active?.controller.flushSourceDrafts?.(),retry:()=>active?.controller.retrySourceDrafts?.(),save:()=>active?.controller.save(),reconcile:()=>active?.controller.reconcile(),peerState:()=>peer?.controller.getState(),peerFlush:()=>peer?.controller.flushSourceDrafts?.(),controller:()=>active?.controller,bump:()=>transaction(true,s=>{s.revision++;}),unknownRaw:()=>transaction(true,s=>{const d=Object.values(s.raw)[0]!;d.revision="stale";delete s.raw[Object.keys(s.raw)[0]!];s.raw[notesHtmlSourceDraftKey(d)]=d;})};
(window as unknown as {htmlFixture:typeof fixture}).htmlFixture=fixture;
void Debug;void createNotesWorkspaceController;
