/** @vitest-environment jsdom */
import { act, createElement, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEditorDocument } from "@hello-ai-company/editor-core";
import { HtmlWidget } from "../src/document/workspaceFeature.js";
import { EditorDraftLifecycleProvider, useEditorLocalDraft, type EditorLocalDraftLifecycle } from "../src/document/draftLifecycle.js";
import { createNotesWorkspaceController } from "../src/notes/controller.js";
import { notesHtmlSourceDraftKey, sameNotesHtmlSourceDraft, type NotesHtmlSourceDraft, type NotesHtmlSourceDraftJournal } from "../src/notes/htmlSourceDraft.js";
import type { NotesDocumentSnapshot, NotesWorkspaceHost } from "../src/notes/contracts.js";
const scope = { workspaceId: "ui-only", actorId: "human" }, target = { kind: "page", pageId: "a" } as const;
const source = { html: "<p>Canonical</p>", css: " p { }\n", javascript: "NeverExecute()\n" };
function fixture() {
  const records = new Map<string, NotesHtmlSourceDraft>();
  const journal: NotesHtmlSourceDraftJournal = { version: 1, compareAndSwap: true,
    list: vi.fn(async (s,t) => [...records.values()].filter(d => sameNotesHtmlSourceDraft(d.scope,s) && sameNotesHtmlSourceDraft(d.target,t)).map(d => structuredClone(d))),
    put: vi.fn(async (next,expected) => { const k=notesHtmlSourceDraftKey(next); if(!sameNotesHtmlSourceDraft(records.get(k),expected)) throw Error("CAS"); records.set(k,structuredClone(next)); }),
    remove: vi.fn(async expected => {const k=notesHtmlSourceDraftKey(expected); if(!sameNotesHtmlSourceDraft(records.get(k),expected))throw Error("CAS");records.delete(k);}) };
  const block = { id: "widget", type: "oeHtmlWidget", props: { title: "Widget", ...source } };
  const snapshot: NotesDocumentSnapshot = { scope,target,revision:"r1",contentRevision:"c1",document:createEditorDocument([block]),title:"Synthetic",metadata:{},capabilities:["document.save"],capabilitySemantics:{"document.save":"test-only"} };
  const host: NotesWorkspaceHost={ scope,sourceDraftJournal:journal,readDocument:vi.fn(async t=>({...snapshot,target:t})),beforeSubmit:vi.fn(async()=>undefined),commit:vi.fn<NotesWorkspaceHost["commit"]>(async r=>({status:"denied",operationId:r.operationId,target:r.target})),lookupOperation:vi.fn<NotesWorkspaceHost["lookupOperation"]>(async(t,operationId)=>({status:"not-found",terminal:true,target:t,operationId})) };
  const controller=createNotesWorkspaceController(host);
  const editor={document:[block],isEditable:true,schema:{blockSchema:{}},transact:(f:()=>void)=>f(),replaceBlocks:vi.fn(),getTextCursorPosition:()=>({block:{id:block.id}}),setTextCursorPosition:vi.fn(),updateBlock:vi.fn((id:string,next:{props:Record<string,string|number|boolean>})=>{if(id!==block.id)throw Error("wrong");block.props={...block.props,...next.props} as typeof block.props;controller.setDraft(createEditorDocument([block]));})};
  return {journal,records,block,controller,editor,host};
}
let container:HTMLDivElement,root:ReturnType<typeof createRoot>;
beforeEach(()=>{(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;container=document.createElement("div");document.body.append(container);root=createRoot(container);});
afterEach(()=>{act(()=>root.unmount());container.remove();(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=false;});
const mount=(f:ReturnType<typeof fixture>)=>act(()=>root.render(createElement(StrictMode,null,createElement(EditorDraftLifecycleProvider,{controller:f.controller,children:createElement(HtmlWidget,{block:f.block,editor:f.editor})}))));
const click=(label:string)=>{const b=[...container.querySelectorAll("button")].find(b=>b.textContent===label);if(!b)throw Error(`missing ${label}`);act(()=>b.click());};
const type=(text:string)=>act(()=>{const t=container.querySelector("textarea")!;Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value")!.set!.call(t,text);t.dispatchEvent(new Event("input",{bubbles:true}));});
const flush=async(f:ReturnType<typeof fixture>)=>act(async()=>{await f.controller.flushSourceDrafts!();});

describe("actual HTML draft UI with optional durable journal",()=>{
 it("source survives unmount and fresh controller recovery; no body update before Apply",async()=>{
  const f=fixture();await f.controller.open(target);mount(f);click("Edit source");type("<broken 日本語\n");click("CSS");type("broken{\n");click("JAVASCRIPT");type("doNotRun('日本語')\n");await flush(f);
  expect(f.editor.updateBlock).not.toHaveBeenCalled();expect([...f.records.values()][0]!.input).toEqual({html:"<broken 日本語\n",css:"broken{\n",javascript:"doNotRun('日本語')\n"});
  act(()=>root.render(null));f.controller.dispose();const controller=createNotesWorkspaceController(f.host);await controller.open(target);mount({...f,controller});expect(container.querySelector("textarea")!.value).toBe("doNotRun('日本語')\n");expect(container.querySelector("textarea")!.getAttribute("aria-label")).toBe("JAVASCRIPT source");expect(f.block.props.html).toBe(source.html);expect(f.host.commit).not.toHaveBeenCalled();
 });
 it("compositionend captures its DOM value even without onChange; Escape/Apply/Cancel during IME preserve raw",async()=>{
  const f=fixture();await f.controller.open(target);mount(f);click("Edit source");const t=container.querySelector("textarea")!;act(()=>t.dispatchEvent(new CompositionEvent("compositionstart",{bubbles:true})));type("未確定");click("Apply source");click("Cancel");expect(container.querySelector("textarea")).not.toBeNull();expect(f.editor.updateBlock).not.toHaveBeenCalled();
  act(()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value")!.set!.call(t,"変換確定直後");t.dispatchEvent(new CompositionEvent("compositionend",{bubbles:true}));});await flush(f);expect([...f.records.values()][0]!.input.html).toBe("変換確定直後");expect([...f.records.values()][0]!.composing).toBe(false);expect(f.controller.getState().composing).toBe(false);
 });
 it("failed explicit discard leaves editor open and exportable; successful retry closes and restores focus",async()=>{
  const f=fixture();await f.controller.open(target);mount(f);click("Edit source");type("Keep through cleanup failure");await flush(f);vi.mocked(f.journal.remove).mockRejectedValueOnce(Error("quota"));click("Cancel");await act(async()=>{await f.controller.flushSourceDrafts!();});expect(container.querySelector("textarea")!.value).toBe("Keep through cleanup failure");expect(container.textContent).toContain("could not be discarded");expect(f.records.size).toBe(1);
  // Retry confirms the previously requested exact removal. Repeating Cancel is safe.
  await act(async()=>{await f.controller.retrySourceDrafts!();});click("Cancel");await act(async()=>{await f.controller.flushSourceDrafts!();});expect(container.querySelector("textarea")).toBeNull();expect(document.activeElement?.textContent).toBe("Edit source");expect(f.block.props.html).toBe(source.html);
 });
 it("Apply changes only local body, retains applied backup after save denial",async()=>{
  const f=fixture();await f.controller.open(target);mount(f);click("Edit source");type("<p>Reviewed input</p>");await flush(f);click("Apply source");await flush(f);expect(f.editor.updateBlock).toHaveBeenCalledTimes(1);expect(container.querySelector("textarea")).toBeNull();expect(container.textContent).toContain("Applied locally");expect([...f.records.values()][0]!.stage).toBe("applied");expect(f.host.commit).not.toHaveBeenCalled();await act(async()=>{expect((await f.controller.save())?.status).toBe("denied");});expect(f.records.size).toBe(1);expect(f.controller.getState().draft!.blocks[0]!.props?.html).toBe("<p>Reviewed input</p>");
 });
 it("stale original revisions keep source UI and fail Apply even if markup is unchanged",async()=>{
  const f=fixture();await f.controller.open(target);mount(f);click("Edit source");type("Stale input");await flush(f);const prior=[...f.records.values()][0]!;f.records.clear();f.records.set(notesHtmlSourceDraftKey({...prior,revision:"old"}),{...prior,revision:"old"});act(()=>root.render(null));f.controller.dispose();const controller=createNotesWorkspaceController(f.host);await controller.open(target);mount({...f,controller});click("Apply source");expect(f.editor.updateBlock).not.toHaveBeenCalled();expect(container.textContent).toContain("original source revision changed");expect(container.querySelector("textarea")!.value).toBe("Stale input");
 });
 it("a delayed import cannot overwrite newer human typing or change the body",async()=>{
  const f=fixture();await f.controller.open(target);mount(f);click("Edit source");await flush(f);
  let release!:(value:string)=>void;const selected=new File(["unused"],"synthetic.html",{type:"text/html"});Object.defineProperty(selected,"text",{value:()=>new Promise<string>(resolve=>release=resolve)});const picker=container.querySelector('input[type="file"]')!;
  act(()=>{Object.defineProperty(picker,"files",{configurable:true,value:[selected]});picker.dispatchEvent(new Event("change",{bubbles:true}));});type("Newer human source retained");await flush(f);await act(async()=>{release("<p>Older delayed import</p>");await Promise.resolve();});
  expect(container.querySelector("textarea")!.value).toBe("Newer human source retained");expect([...f.records.values()][0]!.input.html).toBe("Newer human source retained");expect(f.editor.updateBlock).not.toHaveBeenCalled();expect(f.host.commit).not.toHaveBeenCalled();
 });
 it("old hook callbacks are fenced after A→B→A and after controller disposal",async()=>{
  const f=fixture();await f.controller.open(target);let handle!:EditorLocalDraftLifecycle;function Probe(){handle=useEditorLocalDraft("widget","html-widget-source");return null;}
  act(()=>root.render(createElement(EditorDraftLifecycleProvider,{controller:f.controller,children:createElement(Probe)})));const old=handle;
  await act(async()=>{await f.controller.open({kind:"page",pageId:"b"});await f.controller.open(target);});expect(()=>old.set({version:1,base:JSON.stringify(source),draft:source,part:"html"})).toThrow("target changed");expect(f.controller.getState().localDrafts).toEqual({});expect(f.records.size).toBe(0);
  f.controller.dispose();expect(()=>handle.set({version:1,base:JSON.stringify(source),draft:source,part:"html"})).toThrow();
 });
});
