// @vitest-environment jsdom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {createEditorDocument} from '@hello-ai-company/editor-core';
import {createOpenEditorNotesPreset} from '../src/notes/preset.js';
import type {NotesCommandRequest,NotesCommandResult,NotesDocumentSnapshot,NotesWorkspaceHost} from '../src/notes/contracts.js';
import {NotesWorkspace} from '../src/react/NotesWorkspace.js';
import type {NotesSaveActionContext,NotesSaveActionResult} from '../src/react/notesSaveAction.js';
import {createNotesLinkInputComposition,notesNativeLinkCompositionSignal} from '../src/react/notesLinkPolicy.js';
const writerRenders=vi.hoisted(()=>({count:0}));
vi.mock('../src/react/NotesBlockNoteDocument.js',()=>({NotesBlockNoteDocument:()=>{writerRenders.count++;return <textarea aria-label="Synthetic writer"/>;}}));
let container:HTMLDivElement,root:Root;
const fieldCleanups:(()=>void)[]=[];
beforeEach(()=>{(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;container=document.createElement('div');document.body.append(container);root=createRoot(container);});
afterEach(()=>{act(()=>{for(const cleanup of fieldCleanups.splice(0))cleanup();root.unmount();});container.remove();delete (globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT;});
async function fixture(){
 const scope={actorId:'synthetic-save-actor',workspaceId:'synthetic-workspace'},target={kind:'page' as const,pageId:'synthetic-page'};
 let snapshot:NotesDocumentSnapshot={scope,target,revision:'r1',contentRevision:'c1',document:createEditorDocument([{id:'text',type:'paragraph',content:'Original'}]),title:'Synthetic',metadata:{},capabilities:['document.save'],capabilitySemantics:{'document.save':'test-only'}};
 let request:NotesCommandRequest|undefined,release!: (result:NotesCommandResult)=>void;
 const commit=vi.fn<NotesWorkspaceHost['commit']>(async r=>{request=r;return new Promise<NotesCommandResult>(resolve=>{release=resolve;});});
 const host:NotesWorkspaceHost={scope,readDocument:async()=>snapshot,beforeSubmit:async()=>{},commit,lookupOperation:async(t,operationId)=>({status:'unknown',target:t,operationId})};
 const preset=createOpenEditorNotesPreset({host,config:{version:1,locale:'ja',inspectorPanels:[],documentPanels:[]}});
 await preset.controller.open(target);preset.controller.setDraft(createEditorDocument([{id:'text',type:'paragraph',content:'Saved draft'}]));
 const contexts:NotesSaveActionContext[]=[],results:NotesSaveActionResult[]=[];
 const handler=vi.fn((ctx:NotesSaveActionContext)=>{contexts.push(ctx);return (r:NotesSaveActionResult)=>results.push(r);});
 await act(async()=>root.render(<NotesWorkspace preset={preset} onSaveAction={handler}/>));
 const toolbar=[...container.querySelectorAll('button')].find(x=>x.textContent==='保存')!,writer=container.querySelector('textarea')!;
 const start=async(source:'toolbar'|'ctrl'|'meta')=>{await act(async()=>{if(source==='toolbar'){toolbar.focus();toolbar.click();}else{writer.focus();writer.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,cancelable:true,key:'s',ctrlKey:source==='ctrl',metaKey:source==='meta'}));}});};
 const finish=async(status:'committed'|'rejected'|'unknown'='committed')=>{expect(request).toBeTruthy();const r=request!;if(status==='committed')snapshot={...snapshot,revision:'r2',contentRevision:'c2',document:r.command.kind==='document.save'?r.command.document:snapshot.document};await act(async()=>release(status==='committed'?{status,operationId:r.operationId,target,snapshot,historyId:'history',persistence:'test-only'}:{status,operationId:r.operationId,target}));};
 return {preset,contexts,results,handler,commit,toolbar,writer,start,finish};
}
function nativeField(f:Awaited<ReturnType<typeof fixture>>){
 const owner=document.createElement('div');owner.className='oe-notes-blocknote-document';
 owner.innerHTML='<div class="bn-link-toolbar"><div class="bn-popover-content bn-form-popover" role="dialog"><input aria-label="Native URL" name="url"></div></div>';
 container.querySelector('.oe-notes-workspace')!.append(owner);
 const input=owner.querySelector('input')!,signal=notesNativeLinkCompositionSignal(f.preset.controller);
 let identity='same-owner';
 const composition=createNotesLinkInputComposition(()=>owner,()=>identity,signal.notify),unregister=signal.register(()=>composition.composing);
 input.addEventListener('compositionstart',event=>composition.start(event.target));input.addEventListener('compositionend',event=>composition.end(event.target));input.addEventListener('blur',event=>composition.blur(event.target));
 const dispose=()=>{composition.clear();unregister();owner.remove();};fieldCleanups.push(dispose);
 const compose=(type:'compositionstart'|'compositionend')=>{input.focus();input.dispatchEvent(new CompositionEvent(type,{bubbles:true}));};
 const shortcut=(meta=false)=>{const event=new KeyboardEvent('keydown',{bubbles:true,cancelable:true,key:'s',ctrlKey:!meta,metaKey:meta});input.dispatchEvent(event);return event;};
 return {input,compose,shortcut,composition,dispose,changeIdentity:()=>{identity='different-owner';signal.notify();}};
}
it.each(['toolbar','ctrl','meta'] as const)('blocks %s Save during native field composition and recovers on end',async source=>{
 const f=await fixture(),field=nativeField(f),renders=writerRenders.count;
 await act(async()=>{field.compose('compositionstart');field.shortcut(source==='meta');});
 expect(f.preset.controller.getState().composing).toBe(false);expect(f.toolbar.disabled).toBe(true);expect(field.input.isConnected).toBe(true);expect(document.activeElement).toBe(field.input);
 expect(writerRenders.count).toBe(renders);
 await act(async()=>{f.toolbar.click();field.shortcut();field.shortcut(true);});expect(f.commit).not.toHaveBeenCalled();expect(f.handler).not.toHaveBeenCalled();
 act(()=>field.compose('compositionend'));expect(f.toolbar.disabled).toBe(false);await f.start(source);await f.finish();expect(f.commit).toHaveBeenCalledOnce();f.preset.dispose();
});
it.each(['blur','detach','identity','dispose'] as const)('releases the native field Save lock after %s',async reason=>{
 const f=await fixture(),field=nativeField(f);act(()=>field.compose('compositionstart'));expect(f.toolbar.disabled).toBe(true);
 await act(async()=>{if(reason==='blur')field.input.blur();if(reason==='detach')field.input.remove();if(reason==='identity')field.changeIdentity();if(reason==='dispose')field.dispose();});
 expect(f.toolbar.disabled).toBe(false);await f.start('ctrl');await f.finish();f.preset.dispose();
});
it('invalidates late Save presentation when native field composition begins',async()=>{
 const f=await fixture(),field=nativeField(f);await f.start('toolbar');act(()=>field.compose('compositionstart'));expect(f.contexts[0]!.signal.aborted).toBe(true);
 await f.finish();expect(f.results[0]!.isCurrent()).toBe(false);expect(field.input.isConnected).toBe(true);f.preset.dispose();
});
it('never revives settled Save presentation after newer native field composition ends',async()=>{
 const f=await fixture(),field=nativeField(f);await f.start('toolbar');await f.finish();expect(f.results[0]!.isCurrent()).toBe(true);
 const settled=f.preset.controller.getState();act(()=>field.compose('compositionstart'));expect(f.results[0]!.isCurrent()).toBe(false);
 act(()=>field.compose('compositionend'));expect(f.preset.controller.getState()).toBe(settled);expect(f.results[0]!.isCurrent()).toBe(false);f.preset.dispose();
});
it('rechecks the native field lock after a synchronous Save observer',async()=>{
 const f=await fixture(),field=nativeField(f);await act(async()=>root.render(<NotesWorkspace preset={f.preset} onSaveAction={()=>{field.compose('compositionstart');}}/>));
 await f.start('toolbar');expect(f.commit).not.toHaveBeenCalled();expect(f.preset.controller.getState().dirty).toBe(true);expect(f.toolbar.disabled).toBe(true);f.preset.dispose();
});
it.each(['toolbar','ctrl','meta'] as const)('exposes one immutable explicit lifecycle for %s',async source=>{const f=await fixture();await f.start(source);expect(f.contexts).toHaveLength(1);expect(f.results).toHaveLength(0);const ctx=f.contexts[0]!;expect(ctx.source).toBe(source==='toolbar'?'toolbar':'shortcut');expect(Object.isFrozen(ctx.identity)).toBe(true);expect(Object.isFrozen(ctx.identity.scope)).toBe(true);expect(ctx.trigger).toBe(source==='toolbar'?f.toolbar:f.writer);await f.finish();expect(f.results).toHaveLength(1);expect(f.results[0]!.isCurrent()).toBe(true);expect(f.commit).toHaveBeenCalledTimes(1);f.preset.dispose();});
it('does not observe controller autosaves or clean shortcuts',async()=>{const f=await fixture();let promise:Promise<unknown>;await act(async()=>{promise=f.preset.controller.save();});await f.finish();await promise!;expect(f.handler).not.toHaveBeenCalled();await f.start('ctrl');expect(f.handler).not.toHaveBeenCalled();f.preset.dispose();});
it('blocks shortcut while composing or repeated during save',async()=>{const f=await fixture();act(()=>f.preset.controller.setComposing(true));await f.start('ctrl');expect(f.commit).not.toHaveBeenCalled();act(()=>f.preset.controller.setComposing(false));await f.start('ctrl');await f.start('ctrl');expect(f.contexts).toHaveLength(1);await f.finish();f.preset.dispose();});
it.each(['typing','composition','unmount'] as const)('invalidates an owned response after %s',async interrupt=>{const f=await fixture();await f.start('toolbar');if(interrupt==='typing')act(()=>f.preset.controller.setDraft(createEditorDocument([{id:'text',type:'paragraph',content:'Newer'}])));if(interrupt==='composition')act(()=>f.preset.controller.setComposing(true));if(interrupt==='unmount')await act(async()=>root.render(null));await f.finish();expect(f.results[0]?.isCurrent()).toBe(false);f.preset.dispose();});
it.each(['rejected','unknown'] as const)('reports %s without losing the draft or inventing commit',async status=>{const f=await fixture();await f.start('toolbar');await f.finish(status);expect(f.results[0]!.outcome?.status).toBe(status);expect(f.preset.controller.getState().dirty).toBe(true);expect(f.preset.controller.getState().draft?.blocks[0]?.content).toBe('Saved draft');f.preset.dispose();});
it('isolates observer exceptions from persistence',async()=>{const f=await fixture();await act(async()=>root.render(<NotesWorkspace preset={f.preset} onSaveAction={()=>{throw Error('Presentation only');}}/>));await f.start('toolbar');await f.finish();expect(f.preset.controller.getState().dirty).toBe(false);f.preset.dispose();});

it('preserves controller body-save semantics while retaining native widget drafts',async()=>{const f=await fixture();act(()=>f.preset.controller.setLocalDraft('local',{value:'pending'}));await f.start('ctrl');await f.finish();expect(f.commit).toHaveBeenCalledTimes(1);expect(f.preset.controller.getState().pendingEditors).toBe(true);expect(f.results[0]!.isCurrent()).toBe(false);f.preset.dispose();});
it('keeps Ctrl+S available for a reviewed unchanged manual merge',async()=>{const f=await fixture();let latest:NotesDocumentSnapshot|undefined;await act(async()=>{latest=await f.preset.controller.readLatest();});expect(latest).toBeTruthy();await act(async()=>{await f.preset.controller.acceptMergedDraft(latest!.revision,latest!.document,latest!.title);});expect(f.preset.controller.getState().dirty).toBe(false);expect(f.preset.controller.getState().manualSaveRequired).toBe(true);await f.start('ctrl');await f.finish();expect(f.commit).toHaveBeenCalledTimes(1);expect(f.preset.controller.getState().manualSaveRequired).toBe(false);f.preset.dispose();});

it('keeps rapid Save activations in one action before asynchronous source flushing enters saving',async()=>{const f=await fixture();let release!:()=>void;const real=f.preset.controller.save;const save=vi.spyOn(f.preset.controller,'save').mockImplementation(async options=>{await new Promise<void>(done=>{release=done;});return real(options);});await f.start('toolbar');expect(f.preset.controller.getState().status).toBe('ready');await f.start('ctrl');expect(save).toHaveBeenCalledTimes(1);expect(f.contexts).toHaveLength(1);expect(f.contexts[0]!.signal.aborted).toBe(false);await act(async()=>release());await f.finish();expect(f.results[0]!.isCurrent()).toBe(true);f.preset.dispose();});
it('does not let a rejected old controller overwrite replacement feedback',async()=>{const old=await fixture();await old.start('toolbar');const replacement=await fixture();expect(old.contexts[0]!.signal.aborted).toBe(true);await old.finish('rejected');expect(container.textContent).not.toContain('保存を確認できませんでした。入力を保持しています');expect(replacement.preset.controller.getState().dirty).toBe(true);await replacement.start('toolbar');await replacement.finish();expect(replacement.results[0]!.isCurrent()).toBe(true);old.preset.dispose();replacement.preset.dispose();});
it('releases presentation listeners if a start observer throws after registering cleanup',async()=>{const f=await fixture();const cleanup=vi.fn();await act(async()=>root.render(<NotesWorkspace preset={f.preset} onSaveAction={ctx=>{ctx.signal.addEventListener('abort',cleanup);throw Error('Presentation failed');}}/>));await f.start('toolbar');expect(cleanup).toHaveBeenCalledTimes(1);await f.finish();expect(f.preset.controller.getState().dirty).toBe(false);f.preset.dispose();});
