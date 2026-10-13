// @vitest-environment jsdom
import {StrictMode,act} from 'react';
import {createRoot} from 'react-dom/client';
import {describe,it,expect,vi} from 'vitest';
import {fromBlockNote} from '../src/adapter/fromBlockNote.js';
import {toBlockNoteForSchema} from '../src/adapter/toBlockNote.js';
import {agentChatScopeKey,createAgentChatSession,type AgentChatRecord,type AgentChatResponse} from '@hello-ai-company/editor-ai';
vi.mock('@blocknote/react',()=>({createReactBlockSpec:(config:unknown,implementation:unknown)=>()=>({config,...implementation as object})}));
import {AgentChatProviderBoundary,createAgentChatBlockSpec,type AgentChatBinding} from '../src/agentChat.js';
const block={id:'chat',type:'oeAgentChat',props:{agentId:'agent',title:'Agent chat'}};
function fixture(){const records=new Map<string,AgentChatRecord>();return {scope:{actorId:'actor',workspaceId:'workspace',documentId:'document'},agents:[{id:'agent',name:'Agent',role:'Writer'}],connection:{provider:'openai',model:'test-model'},connectionNotice:'Ready',store:{read:vi.fn(async scope=>records.get(agentChatScopeKey(scope))),compareAndSet:vi.fn(async(scope,_rev,next)=>{records.set(agentChatScopeKey(scope),next);return true;})},provider:{generate:vi.fn(async()=>({text:'Reply',provider:'openai',model:'test-model'}))},isCurrent:()=>true,getDocument:()=>({document:{schemaVersion:1 as const,blocks:[block]},writable:true}),applyText:vi.fn()} satisfies AgentChatBinding;}
async function render(binding:AgentChatBinding|undefined,editable=true){(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;const node=document.createElement('div');document.body.append(node);const root=createRoot(node);const Render=(createAgentChatBlockSpec() as any).render;const children=<Render block={block} editor={{isEditable:editable,updateBlock:vi.fn()}}/>;await act(async()=>root.render(<StrictMode>{binding?<AgentChatProviderBoundary binding={binding}>{children}</AgentChatProviderBoundary>:children}</StrictMode>));return {node,close:async()=>{await act(async()=>root.unmount());node.remove();}};}
describe('private embedded chat presentation',()=>{
 it('StrictMode replays create a live session and read storage safely',async()=>{const binding=fixture(),ui=await render(binding);expect(binding.store.read).toHaveBeenCalled();expect(ui.node.querySelector('textarea')).not.toBeNull();expect(ui.node.textContent).not.toContain('original retained');expect(binding.provider.generate).not.toHaveBeenCalled();await ui.close();});
 it('readonly and unbound surfaces never read private history or activate AI',async()=>{for(const useBinding of [false,true]){const binding=fixture(),ui=await render(useBinding?binding:undefined,false);expect(ui.node.querySelector('textarea')).toBeNull();expect(binding.store.read).not.toHaveBeenCalled();expect(binding.provider.generate).not.toHaveBeenCalled();await ui.close();}});
 it('external HTML has no identity, transcript, context, or interactive controls',()=>{const {dom}=createAgentChatBlockSpec().implementation.toExternalHTML();expect(dom.textContent).toBe('Agent chat · private conversation omitted');expect(dom.outerHTML).not.toContain('agent-id');expect(dom.querySelector('button,input,textarea')).toBeNull();});
 it('portable document conversion retains the marker exactly',()=>{const document=fromBlockNote([block]);expect(document.blocks[0]).toEqual(block);expect(toBlockNoteForSchema(document,{blockSchema:{oeAgentChat:{}}} as any)[0]).toEqual(block);});
});
it('chat IME stays inside the private widget and does not bubble to document composition tracking',async()=>{
 const binding=fixture(),ui=await render(binding);let bubbled=0;const listener=()=>bubbled++;document.body.addEventListener('compositionstart',listener);const input=ui.node.querySelector('textarea')!;
 await act(async()=>{input.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));});expect(bubbled).toBe(0);expect(ui.node.querySelector('textarea')).toBe(input);
 await act(async()=>{input.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}));});document.body.removeEventListener('compositionstart',listener);await ui.close();
});

async function interruptedBinding() {
 const binding:AgentChatBinding=fixture(),generate=vi.mocked(binding.provider.generate),recover=vi.fn(async()=>({text:'Recovered earlier response',provider:'openai',model:'test-model'}));
 binding.provider.recover=recover;generate.mockRejectedValueOnce(Error('Lost acknowledgement'));
 const session=createAgentChatSession({scope:{...binding.scope,blockId:'chat',agentId:'agent'},store:binding.store,provider:binding.provider,host:{isCurrent:binding.isCurrent,getDocument:binding.getDocument,getRoute:()=>({...binding.connection!,agentName:'Agent',agentRole:'Writer'}),applyText:binding.applyText}});
 await session.load();await session.send(session.prepare('Earlier question','ask').reviewId);session.dispose();return{binding,generate,recover};
}
it('reload shows explicit prior-response recovery and performs only the receipt lookup',async()=>{
 const f=await interruptedBinding(),ui=await render(f.binding);expect(f.generate).toHaveBeenCalledTimes(1);expect(f.recover).not.toHaveBeenCalled();expect(ui.node.textContent).toContain('Earlier question');
 const button=Array.from(ui.node.querySelectorAll('button')).find(button=>button.textContent==='前の応答を照会・復元')!;expect(button.disabled).toBe(false);
 await act(async()=>button.click());expect(f.recover).toHaveBeenCalledTimes(1);expect(f.generate).toHaveBeenCalledTimes(1);expect(ui.node.textContent).toContain('Recovered earlier response');expect(ui.node.textContent).not.toContain('前の応答を照会・復元');expect(f.binding.applyText).not.toHaveBeenCalled();await ui.close();
});
it('cancels lookup, ignores late replies, and still offers GET-only recovery after remount',async()=>{
 const f=await interruptedBinding();let finish!:(value:AgentChatResponse)=>void;f.recover.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));const ui=await render(f.binding);
 await act(async()=>Array.from(ui.node.querySelectorAll('button')).find(button=>button.textContent==='前の応答を照会・復元')!.click());
 expect(Array.from(ui.node.querySelectorAll('button')).find(button=>button.textContent==='前の応答を照会・復元')!.disabled).toBe(true);
 await act(async()=>Array.from(ui.node.querySelectorAll('button')).find(button=>button.textContent==='応答の照会を取り消す')!.click());await act(async()=>finish({text:'Late ignored reply',provider:'openai',model:'test-model'}));expect(ui.node.textContent).not.toContain('Late ignored reply');await ui.close();
 const reopened=await render(f.binding);expect(reopened.node.textContent).toContain('前の応答を照会・復元');expect(f.recover).toHaveBeenCalledTimes(1);expect(f.generate).toHaveBeenCalledTimes(1);await reopened.close();
});
it('legacy and unsupported hosts do not offer or infer recovery, and readonly does not look up receipts',async()=>{
 const f=await interruptedBinding();const readonly=await render(f.binding,false);expect(readonly.node.textContent).not.toContain('前の応答を照会・復元');expect(f.recover).not.toHaveBeenCalled();await readonly.close();
 delete f.binding.provider.recover;const unsupported=await render(f.binding);expect(unsupported.node.textContent).not.toContain('前の応答を照会・復元');await unsupported.close();
 const binding=fixture();binding.store.read.mockResolvedValue({version:1,scope:{...binding.scope,blockId:'chat',agentId:'agent'},revision:1,messages:[{id:'old',role:'user',text:'Legacy pending',createdAt:'now',requestId:'legacy'}]});(binding.provider as AgentChatBinding['provider']).recover=vi.fn();const legacy=await render(binding);expect(legacy.node.textContent).toContain('Legacy pending');expect(legacy.node.textContent).not.toContain('前の応答を照会・復元');await legacy.close();
});
it('warns before a separately approved new request after an unknown prior outcome',async()=>{
 const f=await interruptedBinding(),ui=await render(f.binding),input=ui.node.querySelector('textarea')!;
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(input,'A separate new question');input.dispatchEvent(new Event('input',{bubbles:true}));});
 await act(async()=>Array.from(ui.node.querySelectorAll('button')).find(button=>button.textContent==='送信内容を確認')!.click());expect(ui.node.querySelector('[aria-label="AI送信の確認"]')).not.toBeNull();expect(ui.node.textContent).toContain('possible additional cost');expect(ui.node.textContent).toContain('can no longer be recovered through this chat UI');expect(f.generate).toHaveBeenCalledTimes(1);expect(f.recover).not.toHaveBeenCalled();
 await act(async()=>Array.from(ui.node.querySelectorAll('button')).find(button=>button.textContent==='戻って編集')!.click());expect(Array.from(ui.node.querySelectorAll('button')).find(button=>button.textContent==='前の応答を照会・復元')!.disabled).toBe(false);expect(f.generate).toHaveBeenCalledTimes(1);await ui.close();
});
