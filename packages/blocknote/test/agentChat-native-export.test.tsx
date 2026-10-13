// @vitest-environment jsdom
import {BlockNoteEditor} from '@blocknote/core';
import {describe,it,expect} from 'vitest';
import {createOpenEditorBlockNoteSchema} from '../src/schema/createOpenEditorBlockNoteSchema.js';
import {createAgentChatFeature} from '../src/agentChat.js';
import {fromBlockNote} from '../src/adapter/fromBlockNote.js';
describe('actual BlockNote agent chat schema and export',()=>{
 it('roundtrips persisted marker and omits private identity from external HTML',async()=>{
  const schema=createOpenEditorBlockNoteSchema({blockSpecs:createAgentChatFeature().blockSpecs});
  const editor=BlockNoteEditor.create({schema,initialContent:[{id:'chat',type:'oeAgentChat',props:{agentId:'PRIVATE_EMPLOYEE_ID',title:'PRIVATE_TITLE'}}]});
  try{expect(fromBlockNote(editor.document).blocks[0]).toMatchObject({type:'oeAgentChat',props:{agentId:'PRIVATE_EMPLOYEE_ID'}});const html=await editor.blocksToHTMLLossy(editor.document);expect(html).toContain('private conversation omitted');expect(html).not.toContain('PRIVATE_EMPLOYEE_ID');expect(html).not.toContain('PRIVATE_TITLE');expect(html).not.toMatch(/textarea|input|button/);}finally{editor._tiptapEditor.destroy();}
 });
});
