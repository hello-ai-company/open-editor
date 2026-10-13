// Disposable, synthetic Notes Split with actual BlockNote clipboard handling.
import { createRoot } from "react-dom/client";
import { BlockNoteView } from "@blocknote/mantine";
import type { BlockNoteEditor } from "@blocknote/core";
import "@blocknote/mantine/style.css";
import "@hello-ai-company/editor-blocknote/power.css";
import { createEditorDocument } from "@hello-ai-company/editor-core";
import { createCodePowerFeature } from "@hello-ai-company/editor-blocknote/code";
import { NotesTabbedWorkspace } from "@hello-ai-company/editor-blocknote/react";
import type { NotesLayoutState, NotesWorkspaceHost } from "@hello-ai-company/editor-blocknote/notes";
const scope={actorId:"synthetic-clipboard",workspaceId:"isolated-clipboard"},editors=new Map<string,BlockNoteEditor<any,any,any>>();
const host:NotesWorkspaceHost={scope,
  readDocument:async target=>({scope,target,revision:"r1",contentRevision:"c1",document:createEditorDocument([{id:"body-"+(target.kind==="page"?target.pageId:"row"),type:"paragraph",content:"Synthetic clipboard document"},{id:"code",type:"codeBlock",props:{language:"javascript"},content:new URLSearchParams(location.search).has("seeded")?"const syntheticCode = 123;":""}]),title:target.kind==="page"?target.pageId:"Synthetic row",metadata:{},capabilities:["document.save"],capabilitySemantics:{"document.save":"test-only"}}),
  beforeSubmit:async()=>{throw Error("Fixture has no persistence");},commit:async request=>({status:"denied",operationId:request.operationId,target:request.target}),lookupOperation:async(target,operationId)=>({status:"unknown",target,operationId})};
const split=new URLSearchParams(location.search).get("split")!=="false";
const layout:NotesLayoutState={version:1,scope,tabs:[{id:"left",target:{kind:"page",pageId:"left"},title:"Left synthetic",pinned:false},{id:"right",target:{kind:"page",pageId:"right"},title:"Right synthetic",pinned:false}],activeTabId:"left",split:{axis:"horizontal",tabIds:split?["right"]:[]},previewTabId:null};
Object.assign(window,{clipboardFixture:{editors,read:()=>[...editors].map(([id,editor])=>({id,document:editor.document,selection:{from:editor.prosemirrorState.selection.from,to:editor.prosemirrorState.selection.to,text:editor.prosemirrorState.doc.textBetween(editor.prosemirrorState.selection.from,editor.prosemirrorState.selection.to)}}))}});
createRoot(document.getElementById("root")!).render(<><NotesTabbedWorkspace host={host} initialLayout={layout} features={new URLSearchParams(location.search).get("highlight")==="true"?[createCodePowerFeature()]:[]} config={{version:1,title:"Synthetic clipboard",appearance:"classic",locale:"en",navigation:[],documentPanels:["outline"],inspectorPanels:["insert","style","info"]}} renderDocument={context=>{editors.set(context.editor.document[0]!.id,context.editor);return <BlockNoteView editor={context.editor} editable theme="light"/>}}/><label style={{display:"block",padding:12}}>Synthetic paste receiver<textarea aria-label="Synthetic paste receiver" style={{width:"100%",minHeight:100}}/></label></>);
