// @vitest-environment jsdom
import { StrictMode, act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi } from 'vitest';
import type { EditorDocument } from '@hello-ai-company/editor-core';
import { agentChatScopeKey, type AgentChatRecord, type AgentChatProvider, type AgentChatEmployeeContext } from '@hello-ai-company/editor-ai';
vi.mock('@blocknote/react',()=>({createReactBlockSpec:(config:unknown,implementation:unknown)=>()=>({config,...implementation as object})}));
import { AgentChatProviderBoundary, createAgentChatBlockSpec, type AgentChatBinding } from '../src/agentChat.js';
const block={id:'chat',type:'oeAgentChat',props:{agentId:'agent',title:'Agent chat'}};
function fixture() {
  let document:EditorDocument={schemaVersion:1,blocks:[block,{id:'rich',type:'paragraph',content:[{type:'text',text:'Original rich',styles:{bold:true}}]},{id:'unknown',type:'future',props:{secret:'Opaque source'}}]};
  const employee:AgentChatEmployeeContext={profile:{agentId:'agent',name:'Agent',role:'Writer',instructions:'Full instructions\nUse the complete employee profile.',revision:'r1',fingerprint:'profile-fp',skills:['Editing']},memories:[{id:'memory1',text:'Explicit approved memory',privacy:'personal',revision:'r1',fingerprint:'memory-fp'}]};
  const records=new Map<string,AgentChatRecord>();
  const generate=vi.fn<AgentChatProvider['generate']>().mockResolvedValue({text:'A structural proposal',provider:'openai',model:'test-model',documentProposal:{title:'A reviewed heading',changes:[{op:'replace',blockId:'rich',block:{id:'rich',type:'heading',props:{level:2},content:[{type:'text',text:'Proposed heading',styles:{italic:true}}]}}]}});
  const binding:AgentChatBinding={scope:{actorId:'actor',workspaceId:'workspace',documentId:'document'},agents:[{id:'agent',name:'Agent',role:'Writer'}],connection:{provider:'openai',model:'test-model'},connectionNotice:'Ready',store:{read:vi.fn(async scope=>records.get(agentChatScopeKey(scope))),compareAndSet:vi.fn(async(scope,_revision,next)=>{records.set(agentChatScopeKey(scope),structuredClone(next));return true;})},provider:{generate},isCurrent:()=>true,getDocument:()=>({document,writable:true}),getEmployeeContext:()=>employee,applyText:vi.fn(),applyDocument:vi.fn((source,next)=>{if(JSON.stringify(document)!==source.fingerprint)throw Error('Host CAS conflict');document=structuredClone(next);}),renderActions:vi.fn((agentId,blockId)=><aside aria-label="Governed host actions">{agentId}:{blockId}<button type="button">Host review only</button></aside>)};
  return {binding,generate,employee,get document(){return document;},changeDocument:()=>{document={...document,blocks:[...document.blocks,{id:'new',type:'paragraph',content:'Newer unrelated draft'}]};}};
}
async function mount(binding:AgentChatBinding,editable=true){(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;const node=document.createElement('div');document.body.append(node);const root=createRoot(node);const Render=(createAgentChatBlockSpec() as any).render;await act(async()=>root.render(<StrictMode><AgentChatProviderBoundary binding={binding}><Render block={block} editor={{isEditable:editable,updateBlock:vi.fn()}}/></AgentChatProviderBoundary></StrictMode>));return{node,close:async()=>{await act(async()=>root.unmount());node.remove();}};}
async function click(node:HTMLElement,label:string){const button=[...node.querySelectorAll('button')].find(item=>item.textContent===label);expect(button).toBeDefined();await act(async()=>button!.click());}
async function input(node:HTMLTextAreaElement,value:string){await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}));});}
async function prepareRich(node:HTMLElement){const mode=[...node.querySelectorAll('select')].find(select=>[...select.options].some(option=>option.value==='document'))!;await act(async()=>{mode.value='document';mode.dispatchEvent(new Event('change',{bubbles:true}));});const rich=[...node.querySelectorAll('input[type="checkbox"]')].find(input=>input.parentElement?.textContent?.includes('Original rich')) as HTMLInputElement;await act(async()=>rich.click());await input(node.querySelector('textarea')!,'Improve this rich block');await click(node,'送信内容を確認');}

describe('rich reviewed chat UI',()=>{
  it('keeps memories unchecked, shows full employee instructions and selected source before send',async()=>{
    const f=fixture(),ui=await mount(f.binding);expect((ui.node.querySelector('input[type="checkbox"]') as HTMLInputElement).checked).toBe(false);await prepareRich(ui.node);
    const review=ui.node.querySelector('[aria-label="AI送信の確認"]')!;expect(review.textContent).toContain(f.employee.profile.instructions);expect(review.textContent).toContain('Original rich');expect(review.textContent).toContain('明示的に選んだメモリ 0 件');expect(review.textContent).not.toContain('Opaque source');expect(f.generate).not.toHaveBeenCalled();
    await click(ui.node,'戻って編集');expect(ui.node.querySelector('[aria-label="AI送信の確認"]')).toBeNull();expect(f.generate).not.toHaveBeenCalled();await ui.close();
  });
  it('sends selected memory only after exact review and keeps proposal inert until compare and apply',async()=>{
    const f=fixture(),ui=await mount(f.binding);await act(async()=>{(ui.node.querySelector('input[type="checkbox"]') as HTMLInputElement).click();});await prepareRich(ui.node);await click(ui.node,'この内容で送信');expect(f.generate).toHaveBeenCalledTimes(1);expect(f.generate.mock.calls[0]![0].employeeContext?.memories.map(m=>m.id)).toEqual(['memory1']);expect(f.binding.applyDocument).not.toHaveBeenCalled();
    await click(ui.node,'変更案を比較');const comparison=ui.node.querySelector('[aria-label="文書の変更案"]')!;expect(comparison.textContent).toContain('Original rich');expect(comparison.textContent).toContain('Proposed heading');expect(comparison.textContent).toContain('"italic": true');await click(ui.node,'閉じる');expect(f.binding.applyDocument).not.toHaveBeenCalled();
    await click(ui.node,'変更案を比較');await click(ui.node,'比較して文書の下書きへ反映');expect(f.binding.applyDocument).toHaveBeenCalledTimes(1);expect(f.document.blocks[1]!.type).toBe('heading');expect(f.document.blocks[2]!.props?.secret).toBe('Opaque source');expect(ui.node.querySelector('[aria-label="文書の変更案"]')).toBeNull();await ui.close();
  });
  it('blocks stale full-source apply and keeps the comparison open for inspection',async()=>{
    const f=fixture(),ui=await mount(f.binding);await prepareRich(ui.node);await click(ui.node,'この内容で送信');await click(ui.node,'変更案を比較');f.changeDocument();await click(ui.node,'比較して文書の下書きへ反映');expect(f.binding.applyDocument).not.toHaveBeenCalled();expect(ui.node.querySelector('[role="alert"]')?.textContent).toContain('full document changed');expect(ui.node.querySelector('[aria-label="文書の変更案"]')).not.toBeNull();await ui.close();
  });
  it('blocks a changed employee profile after review without sending',async()=>{
    const f=fixture(),ui=await mount(f.binding);await prepareRich(ui.node);f.employee.profile.revision='r2';await click(ui.node,'この内容で送信');expect(f.generate).not.toHaveBeenCalled();expect(ui.node.querySelector('[role="alert"]')?.textContent).toContain('changed');await ui.close();
  });
  it('keeps the optional host action boundary separate and absent on readonly surfaces',async()=>{
    const f=fixture(),ui=await mount(f.binding);expect(f.binding.renderActions).toHaveBeenCalledWith('agent','chat');expect(ui.node.querySelector('[aria-label="Governed host actions"]')?.textContent).toContain('agent:chat');expect(f.generate).not.toHaveBeenCalled();await ui.close();vi.mocked(f.binding.renderActions!).mockClear();const readonly=await mount(f.binding,false);expect(f.binding.renderActions).not.toHaveBeenCalled();expect(readonly.node.querySelector('button')).toBeNull();await readonly.close();
  });
  it('does not offer richer mode or memory selection unless the host opts in',async()=>{
    const f=fixture();delete f.binding.applyDocument;delete f.binding.getEmployeeContext;delete f.binding.renderActions;const ui=await mount(f.binding);expect(ui.node.querySelector('option[value="document"]')).toBeNull();expect(ui.node.querySelector('input[type="checkbox"]')).toBeNull();await ui.close();
  });
});
