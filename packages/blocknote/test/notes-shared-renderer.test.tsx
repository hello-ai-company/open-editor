/** @vitest-environment jsdom */
import {act,createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
import {NotesSharedBlockWidget,createNotesSharedBlockController,type NotesSharedEditorContext} from '../src/notes/documentWidgets.js';
it('renders host rich content in its scoped controller and fences composition and invalid input',async()=>{
 const state=globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean},prior=state.IS_REACT_ACT_ENVIRONMENT;state.IS_REACT_ACT_ENVIRONMENT=true;
 const commit=vi.fn(async()=>{throw Error('No accidental write');}),controller=createNotesSharedBlockController({scope:{actorId:'a',workspaceId:'w'},read:async()=>({sharedId:'s',revision:'r',body:'original',writable:true,persistence:'remote-committed'}),beforeSubmit:async()=>{},commit,lookupOperation:async()=>{throw Error('unused');}},'s');
 await controller.read();controller.setDraft('rich document');let context!:NotesSharedEditorContext;
 controller.renderEditor=c=>{context=c;return createElement('div',{'data-rich-source':'true'},'Rich source');};
 const mount=document.createElement('div');document.body.append(mount);const root=createRoot(mount);
 const save=()=>Array.from(mount.querySelectorAll('button')).find(b=>b.textContent==='Save shared content')!;
 try{
  await act(async()=>root.render(createElement(NotesSharedBlockWidget,{controller})));
  expect(mount.querySelector('[data-rich-source]')).not.toBeNull();expect(mount.querySelector('textarea')).toBeNull();expect(context.readOnly).toBe(false);expect(save().disabled).toBe(false);
  act(()=>context.onComposingChange(true));expect(save().disabled).toBe(true);act(()=>save().click());expect(commit).not.toHaveBeenCalled();
  act(()=>{context.onComposingChange(false);context.onBlockedChange(true);});expect(save().disabled).toBe(true);act(()=>save().click());expect(commit).not.toHaveBeenCalled();
  await act(async()=>root.render(createElement(NotesSharedBlockWidget,{controller,readOnly:true})));expect(context.readOnly).toBe(true);expect(save().disabled).toBe(true);
 }finally{act(()=>root.unmount());controller.dispose();mount.remove();state.IS_REACT_ACT_ENVIRONMENT=prior;}
});
