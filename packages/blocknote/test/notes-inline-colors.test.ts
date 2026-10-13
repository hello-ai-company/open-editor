/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from "vitest";
import { BlockNoteEditor } from "@blocknote/core";
import { readFileSync } from "node:fs";
import { TextSelection } from "@tiptap/pm/state";
import { serializeEditorDocument } from "@hello-ai-company/editor-core";
import { createOpenEditorPowerPreset } from "../src/features/compose.js";
import { fromBlockNote } from "../src/adapter/fromBlockNote.js";
import { toBlockNoteForSchema } from "../src/adapter/toBlockNote.js";
import { importLegacyNotesBlocks, exportLegacyNotesBlocks } from "../src/document/legacyNotes.js";
const dispose:(()=>void)[]=[];
afterEach(()=>{dispose.splice(0).forEach(fn=>fn());});
import {createNotesInlineColorPolicy,notesInlineColorSelectionAllowed} from "../src/react/notesInlineColorPolicy.js";
const tokens=['default','gray','brown','red','orange','yellow','green','blue','purple','pink'];
function setup(inline:any[]=[{type:'text',text:'Colors 日本語 é😀',styles:{bold:true,italic:true}}]) {
 const raw=[{id:'p',type:'paragraph',inlineContent:inline,future:{retain:true}},{id:'other',type:'paragraph',inlineContent:[{type:'text',text:'Unchanged',styles:{}}]}];
 const imported=importLegacyNotesBlocks(raw),options=createOpenEditorPowerPreset().editorOptions();
 const editor=BlockNoteEditor.create({...options,initialContent:toBlockNoteForSchema(imported.document,options.schema) as never});
 const root=document.createElement('div');document.body.append(root);editor.mount(root);
 dispose.push(()=>{editor.unmount();editor._tiptapEditor.destroy();root.remove();});
 const serialized=()=>serializeEditorDocument(fromBlockNote(editor.document));
 const select=()=>{let pos=-1,size=0;editor.prosemirrorState.doc.descendants((node,p)=>{if(node.isText&&pos<0){pos=p;size=node.nodeSize;}});editor.prosemirrorView.dispatch(editor.prosemirrorState.tr.setSelection(TextSelection.create(editor.prosemirrorState.doc,pos,pos+size)));};
 return {editor,root,raw,imported,serialized,select};
}
describe('native fixed inline foreground and background',()=>{
 it.each(tokens)('saves both %s tokens through the actual legacy adapter',token=>{
  const f=setup([{type:'link',href:'https://example.invalid/colors',content:[{type:'text',text:'Link 日本語',styles:{bold:true,textColor:token,backgroundColor:token}}]}]);
  expect(exportLegacyNotesBlocks(fromBlockNote(f.editor.document),f.imported.archive,f.raw)).toEqual(f.raw);
 });
 it.each(['textColor','backgroundColor'] as const)('add/change/default/remove %s each have exact canonical native Undo/redo',key=>{
  const f=setup();f.select();let previous=f.serialized();
  for(const color of ['red','blue','default']){
   if(color==='default')f.editor.removeStyles({[key]:color});else f.editor.addStyles({[key]:color});
   const changed=f.serialized();expect(changed).not.toBe(previous);
   expect(f.editor.undo()).toBe(true);expect(f.serialized()).toBe(previous);
   expect(f.editor.redo()).toBe(true);expect(f.serialized()).toBe(changed);previous=changed;
  }
 });
 it('probes colored hard break import/export raw semantics',()=>{
  const f=setup([{type:'text',text:'a\nb',styles:{textColor:'red',backgroundColor:'yellow',bold:true}}]);
  expect(exportLegacyNotesBlocks(fromBlockNote(f.editor.document),f.imported.archive,f.raw)).toEqual(f.raw);
 });
});

describe('scoped native linked foreground rendering',()=>{
 function styledLink(styles:Record<string,string|boolean>,restricted=true){
  const style=document.createElement('style');
  style.textContent='a[data-inline-content-type=link]{color:rgb(0,0,238);text-decoration:underline}'+readFileSync('src/power/notesDesign.css','utf8');
  document.head.append(style);dispose.push(()=>style.remove());
  const f=setup([{type:'link',href:'https://example.invalid/colors',content:[{type:'text',text:'Link 日本語',styles}]}]);
  // Core mount uses the supplied root as .bn-editor. Production's owner wrapper
  // is a separate ancestor supplied by NotesBlockNoteDocument/BlockNoteView.
  const owner=document.createElement('div');owner.className='oe-notes-blocknote-document';
  if(restricted)owner.setAttribute('data-notes-restricted-colors','');
  document.body.append(owner);owner.append(f.root);dispose.push(()=>owner.remove());
  const anchor=f.root.querySelector<HTMLAnchorElement>('a[data-inline-content-type=link]')!;
  expect(anchor).not.toBeNull();return {...f,owner,anchor};
 }
 it.each(tokens.filter(token=>token!=='default'))('binds %s through native nested marks without modifying link semantics',token=>{
  const f=styledLink({textColor:token,backgroundColor:'pink',italic:true,underline:true}),before=f.serialized();
  expect(f.anchor.closest('[data-style-type=textColor]')?.getAttribute('data-value')).toBe(token);
  // JSDOM exposes the inheritance binding; actual painted RGB is a separate native-browser check.
  expect(getComputedStyle(f.anchor).color).toBe('inherit');
  expect(getComputedStyle(f.anchor).textDecoration).toBe('underline');
  expect(f.anchor.getAttribute('href')).toBe('https://example.invalid/colors');
  expect(f.anchor.target).toBe('_blank');expect(f.anchor.rel).toBe('noopener noreferrer nofollow');
  expect(f.serialized()).toBe(before);
  expect(exportLegacyNotesBlocks(fromBlockNote(f.editor.document),f.imported.archive,f.raw)).toEqual(f.raw);
 });
 it.each([
  ['plain',{},true],['explicit default',{textColor:'default'},true],
  ['background-only',{backgroundColor:'pink'},true],['unrestricted',{textColor:'red'},false],
 ] as const)('leaves %s links in their ordinary style',(_name,styles,restricted)=>{
  const f=styledLink(styles,restricted);expect(getComputedStyle(f.anchor).color).toBe('rgb(0, 0, 238)');
 });
 it('does not recolor links in toolbar or host chrome',()=>{
  const f=styledLink({textColor:'red'}),toolbar=document.createElement('div'),mark=document.createElement('span');
  toolbar.className='bn-toolbar';mark.setAttribute('data-style-type','textColor');mark.setAttribute('data-value','red');
  const anchor=f.anchor.cloneNode(true) as HTMLAnchorElement;mark.append(anchor);toolbar.append(mark);f.owner.append(toolbar);
  expect(getComputedStyle(anchor).color).toBe('rgb(0, 0, 238)');
 });
});


describe('bounded native color policy',()=>{
 const scope={actorId:'owner',workspaceId:'workspace'};
 const insertion=()=>({scope:{...scope},inlineColorBlockTypes:['paragraph'],allowInlineColorHardBreaks:false});
 it('documents the native mixed-style hard-break loss behind the explicit boundary',()=>{
  const f=setup([{type:'text',text:'a',styles:{textColor:'blue'}},{type:'text',text:'\nb',styles:{textColor:'red'}}]);
  const output=fromBlockNote(f.editor.document).blocks[0]!.content;
  expect(output).toEqual([{type:'text',text:'a\n',styles:{textColor:'blue'}},{type:'text',text:'b',styles:{textColor:'red'}}]);
 });
 it('keeps unchanged and unrelated blocks while rejecting a hard break inside colored text',()=>{
  const f=setup(),policy=insertion();f.editor._tiptapEditor.registerPlugin(createNotesInlineColorPolicy(()=>({scope,insertion:policy})));
  f.select();f.editor.addStyles({textColor:'red'});const before=f.serialized();
  f.editor.setTextCursorPosition('p','end');
  let view=f.editor.prosemirrorView;view.dispatch(view.state.tr.replaceSelectionWith(view.state.schema.nodes.hardBreak!.create()));expect(f.serialized()).toBe(before);
  f.editor.setTextCursorPosition('other','end');view=f.editor.prosemirrorView;view.dispatch(view.state.tr.replaceSelectionWith(view.state.schema.nodes.hardBreak!.create()));
  expect(JSON.parse(f.serialized()).blocks[0]).toEqual(JSON.parse(before).blocks[0]);expect(f.serialized()).not.toBe(before);
 });
 it('rechecks live scope and block subset before applying colors',()=>{
  const f=setup(),policy=insertion();f.editor._tiptapEditor.registerPlugin(createNotesInlineColorPolicy(()=>({scope,insertion:policy})));f.select();const before=f.serialized();
  policy.scope.actorId='foreign';f.editor.addStyles({textColor:'red'});expect(f.serialized()).toBe(before);
  policy.scope.actorId='owner';policy.inlineColorBlockTypes=[];f.editor.addStyles({backgroundColor:'blue'});expect(f.serialized()).toBe(before);
 });
 it('does not widen a table or mixed selection and preserves unrestricted SDK defaults',()=>{
  expect(notesInlineColorSelectionAllowed(insertion(),['table'],false)).toBe(false);
  expect(notesInlineColorSelectionAllowed(insertion(),['paragraph','table'],false)).toBe(false);
  expect(notesInlineColorSelectionAllowed(insertion(),['paragraph'],true)).toBe(false);
  expect(notesInlineColorSelectionAllowed(undefined,['table'],true)).toBe(true);
 });
});
