import { describe, it, expect, vi } from 'vitest';
import type { EditorDocument } from '@hello-ai-company/editor-core';
import { createAgentChatSession, parseAgentChatEmployeeContext, parseAgentChatRecord, type AgentChatEmployeeContext, type AgentChatProvider, type AgentChatRecord, type AgentChatScope } from '../src/agentChat.js';
import { agentChatDocumentContext, agentChatDocumentSource, agentChatDocumentTargets, previewAgentChatDocumentProposal, type AgentChatDocumentProposal } from '../src/agentChatDocument.js';
const scope: AgentChatScope = { actorId:'actor', workspaceId:'ws', documentId:'doc', blockId:'chat', agentId:'employee' };
const clone = <T,>(value:T):T => structuredClone(value);
const richDocument = ():EditorDocument => ({schemaVersion:1,blocks:[
  {id:'chat',type:'oeAgentChat',props:{agentId:'employee',title:'Private identity'}},
  {id:'p',type:'paragraph',content:[{type:'text',text:'Original rich',styles:{bold:true}}]},
  {id:'h',type:'heading',props:{level:2},content:'Heading'},
  {id:'list',type:'bulletListItem',content:'List',children:[{id:'child',type:'checkListItem',props:{checked:false},content:'Child'}]},
  {id:'code',type:'codeBlock',props:{language:'typescript'},content:'const x = 1;'},
  {id:'table',type:'table',content:{type:'tableContent',rows:[{cells:[[{type:'text',text:'Cell',styles:{}}]]}]}},
  {type:'future-widget',props:{privatePayload:{retain:['opaque',7]}},id:'unknown',children:[{id:'opaque-child',type:'future-child',content:'Keep'}]},
  {id:'protected',type:'paragraph',props:{privacy:'protected',secret:'Never transmitted'},content:'Hidden metadata'}
]});
const profile = ():AgentChatEmployeeContext => ({profile:{agentId:'employee',name:'Agent',role:'researcher',instructions:'Full instructions\n'.repeat(400),revision:'p1',fingerprint:'profile1',description:'Expert',skills:['Writing'],capabilities:['document.read']},memories:[{id:'m1',text:'Approved memory',privacy:'personal',revision:'m1',fingerprint:'memory1'},{id:'m2',text:'Not selected',privacy:'public',revision:'m2',fingerprint:'memory2'}]});
const response:Awaited<ReturnType<AgentChatProvider['generate']>>={text:'Rich proposal',provider:'openai',model:'m',documentProposal:{title:'Improve the selected blocks',changes:[{op:'replace',blockId:'p',block:{id:'p',type:'heading',props:{level:1},content:[{type:'text',text:'Revised rich',styles:{italic:true}}]}},{op:'replace',blockId:'h',block:{id:'h',type:'paragraph',content:'Revised heading'}}]}};
function fixture() {
  let document=richDocument(), employee=profile(), stored:AgentChatRecord|undefined, n=0;
  const generate=vi.fn<AgentChatProvider['generate']>().mockResolvedValue(clone(response));
  const applyDocument=vi.fn((source:ReturnType<typeof agentChatDocumentSource>,next:EditorDocument)=>{if(JSON.stringify(document)!==source.fingerprint)throw Error('Host CAS conflict');document=clone(next);});
  const compareAndSet=vi.fn(async(_scope:AgentChatScope,revision:number,next:AgentChatRecord)=>{if((stored?.revision??0)!==revision)return false;stored=clone(next);return true;});
  const host={isCurrent:()=>true,getDocument:()=>({document,writable:true}),getRoute:()=>({provider:'openai',model:'m',agentName:'Agent',agentRole:'researcher'}),getEmployeeContext:()=>employee,applyText:vi.fn(),applyDocument};
  const make=()=>createAgentChatSession({scope,host,provider:{generate},store:{read:async()=>stored,compareAndSet},id:()=>String(++n)});
  return {make,generate,host,compareAndSet,applyDocument,get document(){return document;},set document(next){document=next;},get employee(){return employee;},set employee(next){employee=next;},get stored(){return stored;}};
}
const prepare=(session:ReturnType<typeof createAgentChatSession>)=>session.prepare('Improve these blocks','document',undefined,{blockIds:['p','h'],memoryIds:['m1']});
describe('reviewed rich document and employee context',()=>{
  it('sends only selected rich context and memories with the complete canonical profile',async()=>{
    const f=fixture(),s=f.make();await s.load();const r=prepare(s);expect(r.documentSource?.document.blocks).toHaveLength(8);expect(r.employeeContext?.profile.instructions).toBe(f.employee.profile.instructions);
    await s.send(r.reviewId);expect(s.getState().status).toBe('ready');const sent=f.generate.mock.calls[0]![0];
    expect(sent.requestId).toBe(r.reviewId);expect(f.stored?.messages.map(message=>message.requestId)).toEqual([r.reviewId,r.reviewId]);
    expect(sent.documentContext?.blocks.map(block=>block.id)).toEqual(['p','h']);expect(sent.employeeContext?.memories.map(memory=>memory.id)).toEqual(['m1']);
    expect(JSON.stringify(sent)).not.toMatch(/Private identity|privatePayload|Never transmitted|documentSource|Not selected/);expect(f.applyDocument).not.toHaveBeenCalled();
  });
  it('keeps default memory context empty and blocks implicit document context',async()=>{
    const f=fixture(),s=f.make();await s.load();const r=s.prepare('Ask','ask');expect(r.employeeContext?.memories).toEqual([]);expect(r.documentContext).toBeUndefined();expect(()=>s.prepare('Edit','document')).toThrow('Explicitly choose');expect(()=>s.prepare('Ask','ask',undefined,{blockIds:['p']})).toThrow('context mode');
  });
  it('offers rich text, headings, nested lists, code and tables but excludes unknown, protected and private blocks',()=>{
    expect(agentChatDocumentTargets(richDocument()).map(b=>b.id)).toEqual(['p','h','list','code','table']);
    for(const id of ['chat','unknown','protected','child'])expect(()=>agentChatDocumentContext(richDocument(),[id])).toThrow();
    const nested=richDocument();nested.blocks[1]!.children=[nested.blocks[6]!];expect(agentChatDocumentTargets(nested).map(b=>b.id)).not.toContain('p');
  });
  it('requires explicit apply, preserves unknown blocks byte-for-byte, and retains history on reload',async()=>{
    const f=fixture(),s=f.make(),before=clone(f.document);await s.load();await s.send(prepare(s).reviewId);const reply=s.getState().messages.at(-1)!;
    expect(f.document).toEqual(before);s.apply(reply.id);expect(f.applyDocument).toHaveBeenCalledTimes(1);expect(f.document.blocks[1]!.type).toBe('heading');
    for(const id of ['unknown','protected','chat','list','code','table'])expect(JSON.stringify(f.document.blocks.find(b=>b.id===id))).toBe(JSON.stringify(before.blocks.find(b=>b.id===id)));
    expect(()=>s.apply(reply.id)).toThrow('full document changed');s.dispose();const reopened=f.make();await reopened.load();expect(reopened.getState().messages).toHaveLength(2);expect(f.generate).toHaveBeenCalledTimes(1);
  });
  it.each(['before-send','during-provider','before-apply'])('rejects unrelated full-source edits at %s',async(stage)=>{
    const f=fixture(),s=f.make();await s.load();const review=prepare(s);const change=()=>{f.document={...f.document,blocks:[...f.document.blocks,{id:'new',type:'paragraph',content:'Unrelated newer edit'}]};};
    if(stage==='before-send'){change();await expect(s.send(review.reviewId)).rejects.toThrow('full document changed');expect(f.generate).not.toHaveBeenCalled();}
    else if(stage==='during-provider'){f.generate.mockImplementationOnce(async()=>{change();return clone(response);});await s.send(review.reviewId);expect(s.getState().status).toBe('error');expect(f.stored?.messages).toHaveLength(1);}
    else{await s.send(review.reviewId);change();expect(()=>s.apply(s.getState().messages.at(-1)!.id)).toThrow('full document changed');}
    expect(f.applyDocument).not.toHaveBeenCalled();
  });
  it.each(['profile','memory','removed-memory'])('invalidates exact review when %s changes',async(kind)=>{
    const f=fixture(),s=f.make();await s.load();const r=prepare(s);if(kind==='profile')f.employee.profile.instructions+=' newer';else if(kind==='memory')f.employee.memories[0]!.text+=' newer';else f.employee.memories=[];
    await expect(s.send(r.reviewId)).rejects.toThrow(/changed|no longer approved/);expect(f.generate).not.toHaveBeenCalled();
  });
  it('allows unselected memory changes while rejecting selected context changes after history CAS',async()=>{
    const f=fixture(),s=f.make();await s.load();const r=prepare(s);f.employee.memories[1]!.text='Different unselected memory';
    const save=f.compareAndSet.getMockImplementation()!;f.compareAndSet.mockImplementationOnce(async(...args)=>{const result=await save(...args);f.employee.profile.revision='p2';return result;});
    await s.send(r.reviewId);expect(f.generate).not.toHaveBeenCalled();expect(s.getState().notice).toContain('changed');
  });
  it('withholds late replies and stale apply after canonical context revocation',async()=>{
    const f=fixture(),s=f.make();await s.load();f.generate.mockImplementationOnce(async()=>{f.employee.memories=[];return clone(response);});await s.send(prepare(s).reviewId);expect(f.stored?.messages).toHaveLength(1);
    const other=fixture(),next=other.make();await next.load();await next.send(prepare(next).reviewId);other.employee.profile.revision='p2';expect(()=>next.apply(next.getState().messages.at(-1)!.id)).toThrow('changed');expect(other.applyDocument).not.toHaveBeenCalled();
  });
  it('freezes emitted reviews and ignores mutation of the returned review copy',async()=>{
    const f=fixture(),s=f.make();await s.load();const r=prepare(s);r.employeeContext!.profile.instructions='tampered';expect(()=>{s.getState().review!.employeeContext!.profile.instructions='tampered';}).toThrow();await s.send(r.reviewId);expect(f.generate.mock.calls[0]![0].employeeContext!.profile.instructions).toBe(f.employee.profile.instructions);
  });
  it('rejects malformed profile, protected memory, oversized instructions and duplicate memory IDs without truncation',()=>{
    for(const change of [(v:AgentChatEmployeeContext)=>{v.profile.instructions='x'.repeat(64001);},(v:AgentChatEmployeeContext)=>{v.memories[0]!.privacy='protected' as never;},(v:AgentChatEmployeeContext)=>{v.memories.push(v.memories[0]!);},(v:AgentChatEmployeeContext)=>{(v.profile as any).credentials='secret';}]){const v=profile();change(v);expect(()=>parseAgentChatEmployeeContext(v,'employee')).toThrow();}
  });
});
describe('rich proposal validation',()=>{
  function proposal():AgentChatDocumentProposal{return{source:agentChatDocumentSource(richDocument()),selectedBlockIds:['p','h','list','code','table'],title:'Rich change',changes:[{op:'replace',blockId:'p',block:{id:'p',type:'paragraph',content:[{type:'text',text:'Safe',styles:{bold:true}}]}}]};}
  it('supports bounded multi-block operations inside the selection',()=>{
    const p=proposal();p.changes=[{op:'insert',beforeId:'p',block:{id:'inserted',type:'heading',props:{level:2},content:'New heading'}},{op:'text-diff',blockId:'code',baseText:'const x = 1;',edits:[{start:10,end:11,insertText:'2'}]},{op:'update-props',blockId:'h',set:{level:3},remove:[]},{op:'delete',blockId:'list'}];const next=previewAgentChatDocumentProposal(p);expect(next.blocks.map(b=>b.id)).toContain('inserted');expect(next.blocks.find(b=>b.id==='code')?.content).toBe('const x = 2;');expect(next.blocks.some(b=>b.id==='list')).toBe(false);
  });
  it.each(['unselected','unknown','private','hidden-props','hidden-style','unsafe-link','unselected-destination','unanchored','duplicate','corrupt-source'])('rejects %s payloads without altering source',kind=>{
    const p=proposal(),before=clone(p.source);
    if(kind==='unselected')p.changes=[{op:'delete',blockId:'protected'}];
    if(kind==='unknown')p.changes=[{op:'replace',blockId:'p',block:{id:'p',type:'future-widget',content:'Untrusted'}}];
    if(kind==='private')p.changes=[{op:'replace',blockId:'p',block:{id:'p',type:'oeAgentChat',props:{agentId:'other',title:'Injected'}}}];
    if(kind==='hidden-props')p.changes=[{op:'update-props',blockId:'p',set:{secret:'Hidden'},remove:[]}];
    if(kind==='hidden-style')p.changes=[{op:'replace',blockId:'p',block:{id:'p',type:'paragraph',content:[{type:'text',text:'Visible',styles:{secret:'Hidden'}}]}}];
    if(kind==='unsafe-link')p.changes=[{op:'replace',blockId:'p',block:{id:'p',type:'paragraph',content:[{type:'link',href:'javascript:alert(1)',content:[{type:'text',text:'Unsafe'}]}]}}];
    if(kind==='unselected-destination')p.changes=[{op:'insert',parentId:'unknown',block:{id:'new',type:'paragraph',content:'Injected'}}];
    if(kind==='unanchored')p.changes=[{op:'insert',block:{id:'new',type:'paragraph',content:'Injected'}}];
    if(kind==='duplicate')p.changes=[{op:'insert',beforeId:'p',block:{id:'chat',type:'paragraph',content:'Duplicate'}}];
    if(kind==='corrupt-source')p.source.fingerprint='wrong';
    expect(()=>previewAgentChatDocumentProposal(p)).toThrow();expect(p.source.document).toEqual(before.document);
  });
  it('record parsing rejects corrupt saved proposals without overwriting private history',()=>{
    const p=proposal();p.source.fingerprint='wrong';const saved={version:1,scope,revision:1,messages:[{id:'a',role:'assistant',text:'Proposal',createdAt:'2026-10-12',documentProposal:p}]};const before=clone(saved);expect(()=>parseAgentChatRecord(saved,scope)).toThrow();expect(saved).toEqual(before);
  });
});
