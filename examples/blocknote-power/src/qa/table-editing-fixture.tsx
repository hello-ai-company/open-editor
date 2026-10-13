// Dedicated synthetic IndexedDB only. No API, real Notes store, account or AI calls.
import {createRoot} from "react-dom/client";
import {useState} from "react";
import {BlockNoteView} from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import "@hello-ai-company/editor-blocknote/power.css";
import {createEditorDocument, type JsonValue} from "@hello-ai-company/editor-core";
import {createNotesTableEditingRegistry, notesTableBindingKey, type NotesTableBinding, type NotesTableInputDraft, type NotesTableEditingHost, type NotesTableSnapshot, type NotesTableRow, type NotesTableReceipt, type NotesDocumentSnapshot, type NotesWorkspaceHost, type NotesLayoutState} from "@hello-ai-company/editor-blocknote/notes";
import {NotesTabbedWorkspace} from "@hello-ai-company/editor-blocknote/react";
import type {NotesResourceRecovery, NotesResourceRequest} from "@hello-ai-company/editor-blocknote";

const scope={actorId:"synthetic-table-actor",workspaceId:"synthetic-table26"}, target={kind:"page",pageId:"source"} as const;
const viewId=new URLSearchParams(location.search).get("view")||"main";
// Two-reader CAS acceptance uses separate private journals on a shared synthetic
// canonical database, like independent devices. Default shared journal is used
// for old-view restoration and same-session writer fencing.
const journalId=new URLSearchParams(location.search).get("journal")||"shared";
const layout:NotesLayoutState={version:1,scope,tabs:[{id:"source",target,title:"Source",pinned:false},{id:"destination",target:{kind:"page",pageId:"destination"},title:"Destination",pinned:false}],activeTabId:"source",split:{axis:"horizontal",tabIds:[]},previewTabId:null};
const parent=createEditorDocument([{id:"protected-text",type:"paragraph",content:"Synthetic document body stays exact"},{id:"db-block",type:"databaseView",props:{databaseId:"db",viewId,viewType:"table",titleHint:"Synthetic Database"}},...(new URLSearchParams(location.search).get('peer')==='true'?[{id:'db-peer',type:'databaseView',props:{databaseId:'db',viewId,viewType:'table',titleHint:'Synthetic peer table'}}]:[]),{id:"protected-html",type:"oeHtmlWidget",props:{html:"<p>Protected saved HTML</p>",css:"p{color:teal}",javascript:"neverRun()"}}]);
const clone=<T,>(v:T):T=>structuredClone(v), equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
type Store={version:number;schema:number;rows:NotesTableRow[];parent:typeof parent;raw:Record<string,NotesTableInputDraft>;tickets:Record<string,NotesResourceRecovery>;receipts:Record<string,NotesTableReceipt>;events:{kind:string;operationId?:string;request?:NotesResourceRequest}[]};
const initial=():Store=>({version:1,schema:1,parent:clone(parent),rows:[{id:"visible",title:"Visible",sortOrder:0,deleted:false,values:{title:"Visible",number:2,done:false,future:{opaque:["keep",7]},hiddenField:"exact unknown bytes"}},...Array.from({length:22},(_,i)=>({id:"hidden-"+i,title:"Hidden "+i,sortOrder:i+1,deleted:false,values:{title:"Hidden "+i,number:i+9,unknown:{retain:true,index:i}}}))],raw:{},tickets:{},receipts:{},events:[]});
const dbPromise=new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open("openeditor-table26-synthetic",1);request.onupgradeneeded=()=>request.result.createObjectStore("fixture");request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
async function transact<T>(write:boolean,work:(value:Store)=>T):Promise<T>{
 const db=await dbPromise;return new Promise((resolve,reject)=>{const tx=db.transaction("fixture",write?"readwrite":"readonly"),store=tx.objectStore("fixture"),read=store.get("state");let result:T;
 read.onsuccess=()=>{try{const state:Store=read.result??initial();result=work(state);if(write)store.put(state,"state");}catch(error){tx.abort();reject(error);}};
 tx.oncomplete=()=>resolve(clone(result));tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error??new Error("Synthetic transaction aborted"));
 });
}
await transact(true,()=>undefined);
let fault="none", registry:ReturnType<typeof createNotesTableEditingRegistry>;
let releaseCommit:(()=>void)|undefined;
const rawKey=(d:NotesTableInputDraft)=>journalId+":"+notesTableBindingKey(d.binding)+JSON.stringify([d.mode,d.rowKey,d.propertyId??null]);
const privateRaw=(s:Store)=>Object.entries(s.raw).filter(([key])=>key.startsWith(journalId+":")).map(([,draft])=>draft);
const snapshot=(s:Store):NotesTableSnapshot=>({scope,parentTarget:target,databaseId:"db",revision:"r"+s.version,schema:{revision:"s"+s.schema,properties:[{id:"title",name:"Title",type:"text"},{id:"number",name:"Amount",type:"number"},{id:"done",name:"Done",type:"checkbox"},{id:"future",name:"Future",type:"future-native",config:{raw:"keep"}},{id:"formula",name:"Computed",type:"formula",readOnly:true}]},capabilities:["row.create","row.patch"]});
const owned=(b:NotesTableBinding)=>equal(b.scope,scope)&&equal(b.parentTarget,target)&&b.databaseId==="db";
const tableHost:NotesTableEditingHost={version:1,scope,journal:{version:1,compareAndSwap:true,
 read:b=>transact(false,s=>privateRaw(s).filter(d=>notesTableBindingKey(d.binding)===notesTableBindingKey(b))),
 list:(sc,t)=>transact(false,s=>privateRaw(s).filter(d=>equal(d.binding.scope,sc)&&equal(d.binding.parentTarget,t))),
 put:(d,expected)=>transact(true,s=>{if(!owned(d.binding)||fault==="raw-storage"||!equal(s.raw[rawKey(d)],expected))throw Error("Synthetic raw storage/CAS failure");s.raw[rawKey(d)]=clone(d);}),
 remove:d=>transact(true,s=>{if(!owned(d.binding)||fault==="cleanup-storage"||!equal(s.raw[rawKey(d)],d))throw Error("Synthetic exact raw removal failed");delete s.raw[rawKey(d)];})},
 resolvePort:async binding=>{
  if(!owned(binding))return undefined;const captured=clone(binding);
  const proof=(previousRevision?:string,historyId?:string)=>({scope,parentTarget:target,databaseId:"db",...(previousRevision?{previousRevision}:{}),...(historyId?{historyId}:{})});
  const checked=async(receipt:NotesTableReceipt)=>{if(fault==="foreign-receipt")return {...receipt,proof:{...receipt.proof,scope:{...scope,actorId:"foreign"}}};if(receipt.status==="committed")await transact(true,s=>{delete s.tickets[receipt.operationId];});return receipt;};
  return {binding:captured,resourceId:"notes-db-edit:db",read:()=>transact(false,s=>snapshot(s)),rows:(cursor)=>transact(false,s=>{
   const q=captured.query,rows=s.rows.filter(r=>r.deleted===q.trashed&&r.title.toLowerCase().includes(q.query.toLowerCase())).sort((a,b)=>(q.sortBy==="title"?a.title.localeCompare(b.title):a.sortOrder-b.sortOrder)*(q.direction==="asc"?1:-1));
   const offset=cursor?Number(cursor.split(":")[1]):0;if(cursor!==undefined&&cursor!=="r"+s.version+":"+offset)throw Error("Stale cursor");
   return {binding:fault==="rows-foreign"?{...captured,query:{...q,query:"foreign"}}:captured,revision:"r"+s.version,rows:rows.slice(offset,offset+q.limit),total:rows.length,nextCursor:offset+q.limit<rows.length?"r"+s.version+":"+(offset+q.limit):null};
  }),beforeSubmit:ticket=>transact(true,s=>{if(fault==="ticket-storage"||!Object.values(s.raw).some(d=>equal(d.submitted,ticket))||s.tickets[ticket.request.operationId]&&!equal(s.tickets[ticket.request.operationId],ticket))throw Error("Synthetic ticket persistence failed");s.tickets[ticket.request.operationId]=clone(ticket);s.events.push({kind:"ticket",operationId:ticket.request.operationId});}),
  beforeLookup:ticket=>transact(true,s=>{if(s.tickets[ticket.request.operationId]&&!equal(s.tickets[ticket.request.operationId],ticket))throw Error("Ticket mismatch");s.tickets[ticket.request.operationId]=clone(ticket);}),
  releaseTerminal:ticket=>transact(true,s=>{if(!["denied","conflict"].includes(s.receipts[ticket.request.operationId]?.status))throw Error("No verified terminal result");delete s.tickets[ticket.request.operationId];}),
  provider:{commit:async(request)=>{
   if(fault==="hold-commit")await new Promise<void>(resolve=>{releaseCommit=resolve;});
   const receipt=await transact(true,s=>{
    if(!equal(s.tickets[request.operationId]?.request,request)||!Object.values(s.raw).some(d=>equal(d.submitted?.request,request)))throw Error("Missing durable input/ticket before transport");
    s.events.push({kind:"commit",operationId:request.operationId,request:clone(request)});
    if(s.receipts[request.operationId])throw Error("No duplicate send permitted");
    let receipt:NotesTableReceipt;
    if(request.expectedRevision!=="r"+s.version||fault==="denied")receipt={status:fault==="denied"?"denied":"conflict",resourceId:request.resourceId,operationId:request.operationId,proof:proof()};
    else{
     if(request.change.kind!=="patch"||Object.keys(request.change.fields).join()!=="command")throw Error("Unexpected wire fields");
     const command=request.change.fields.command as {kind:"row.create"|"row.patch";rowKey:string;fields:Record<string,JsonValue>};
     if(Object.keys(command).sort().join()!=="fields,kind,rowKey")throw Error("Unexpected schema wire field");
     const row=command.kind==="row.create"?{id:command.rowKey,title:"",deleted:false,sortOrder:s.rows.length,values:{}}:s.rows.find(r=>r.id===command.rowKey);
     if(!row||command.kind==="row.create"&&s.rows.some(r=>r.id===row.id))throw Error("Invalid reviewed row");
     Object.assign(row.values,clone(command.fields));if(typeof row.values.title==="string")row.title=row.values.title;
     if(command.kind==="row.create")s.rows.push(row);s.version++;
     receipt={status:"committed",resourceId:request.resourceId,operationId:request.operationId,snapshot:{revision:"r"+s.version,value:{...snapshot(s),command} as unknown as JsonValue},proof:proof(request.expectedRevision,"synthetic-history-"+request.operationId)};
    }
    s.receipts[request.operationId]=clone(receipt);return receipt;
   });
   if(fault==="lost-ack")throw Error("Synthetic lost acknowledgement after atomic commit");return checked(receipt);
  },lookupOperation:async(resourceId,operationId)=>{
   const receipt=await transact(true,s=>{s.events.push({kind:"lookup",operationId});if(fault==="lookup-failure")throw Error("Synthetic lookup unavailable");return s.receipts[operationId]??{status:"denied",resourceId,operationId,proof:proof()};});return checked(receipt);
  }} };
 }
};
const bodySnapshot=async(requested:NotesDocumentSnapshot["target"]):Promise<NotesDocumentSnapshot>=>transact(false,s=>({scope,target:requested,revision:"body-r"+s.version,contentRevision:"body-c1",document:requested.kind==="page"&&requested.pageId==="source"?parent:createEditorDocument([{id:"destination",type:"paragraph",content:"Synthetic destination"}]),title:requested.kind==="page"?requested.pageId:requested.rowId,metadata:{},capabilities:[],capabilitySemantics:{}}));
const host:NotesWorkspaceHost={scope,readDocument:bodySnapshot,beforeSubmit:async()=>{throw Error("Body writes outside synthetic table acceptance");},commit:async request=>({status:"denied",target:request.target,operationId:request.operationId}),lookupOperation:async(requested,operationId)=>({status:"unknown",target:requested,operationId}),providers:{database:{
 getDatabase:async id=>({id,title:"Synthetic Database",propertyDefinitions:[]}),
 listRows:async()=>transact(false,s=>({databaseId:"db",rows:s.rows.map(r=>({title:r.title})),items:s.rows.map(r=>({rowKey:r.id,sortOrder:r.sortOrder,row:{title:r.title}})),schema:{title:"string"},config:{},pagination:{limit:20,total:s.rows.length,hasMore:false,nextCursor:null}}))
}}};
function App(){const [generation,setGeneration]=useState(0);if(!registry)registry=createNotesTableEditingRegistry(tableHost);
 Object.assign(window,{tableFixture:{read:()=>transact(false,s=>s),registry,fault:(value:string)=>{fault=value;},holding:()=>Boolean(releaseCommit),release:()=>{releaseCommit?.();releaseCommit=undefined;},binding:(query="",view=viewId):NotesTableBinding=>({scope,parentTarget:target,databaseId:"db",viewId:view,query:{query,trashed:false,sortBy:"position",direction:"asc",limit:20}}),bumpSchema:()=>transact(true,s=>{s.schema++;s.version++;}),bumpRevision:()=>transact(true,s=>{s.version++;}),reset:async()=>{registry.dispose();await transact(true,s=>Object.assign(s,initial()));registry=undefined as unknown as typeof registry;fault="none";setGeneration(generation+1);}}});
 return <><div style={{padding:8,fontFamily:"sans-serif"}} role="note">Synthetic IndexedDB fixture — no real Notes or AI requests</div><NotesTabbedWorkspace key={generation} host={host} tableEditing={registry} initialLayout={layout} beforeResourceLeave={async()=>true} config={{version:1,title:"Synthetic table acceptance",navigation:[],documentPanels:[],inspectorPanels:[],locale:"en",appearance:"classic"}} renderDocument={context=><BlockNoteView editor={context.editor} editable={context.editable} theme="light"/>}/></>;
}
createRoot(document.getElementById("root")!).render(<App/>);
