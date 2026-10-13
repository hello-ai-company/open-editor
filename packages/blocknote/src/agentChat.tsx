import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createReactBlockSpec } from '@blocknote/react';
import { agentChatTargets, agentChatDocumentTargets, previewAgentChatDocumentProposal, parseAgentChatEmployeeContext, createAgentChatSession, type AgentChatEmployeeContext, type AgentChatDocumentSource, type AgentChatMode, type AgentChatContext, type AgentChatDocument, type AgentChatProvider, type AgentChatRoute, type AgentChatScope, type AgentChatStore } from '@hello-ai-company/editor-ai';
import type { EditorDocument } from '@hello-ai-company/editor-core';
import { ReadableDocument, ReadableDocumentComparison } from './react/ReadableDocumentComparison.js';
import { interactiveBlockMeta } from './document/widgetInteraction.js';
import type { OpenEditorPowerFeature } from './features/types.js';

export type AgentChatBinding = {
  scope: Pick<AgentChatScope, 'actorId' | 'workspaceId' | 'documentId'>;
  agents: Array<{ id: string; name: string; role: string }>;
  connection?: { provider: string; model: string };
  connectionNotice: string;
  sendNotice?: string;
  resolveRoute?(agentId: string): AgentChatRoute | undefined;
  store: AgentChatStore; provider: AgentChatProvider;
  isCurrent(scope: AgentChatScope): boolean;
  getDocument(): AgentChatDocument;
  getEmployeeContext?(agentId: string): AgentChatEmployeeContext | undefined;
  applyDocument?(target: AgentChatDocumentSource, document: EditorDocument): void;
  applyText(target: AgentChatContext, text: string): void;
  renderIdentity?(agentId: string): ReactNode;
  /** Optional host-governed tools/jobs UI. Chat responses can never dispatch it. */
  renderActions?(agentId: string, blockId: string): ReactNode;
};
const Binding = createContext<AgentChatBinding | undefined>(undefined);
export function AgentChatProviderBoundary({ binding, children }: { binding: AgentChatBinding; children: ReactNode }) { return <Binding.Provider value={binding}>{children}</Binding.Provider>; }
type ChatBlock = { id: string; props: { agentId: string; title: string } };
type ChatEditor = { isEditable: boolean; updateBlock(id: string, change: { props: { agentId: string } }): unknown };
function ChatSurface({block, editor}: {block: ChatBlock; editor: ChatEditor}) {
  const binding = useContext(Binding);
  // Published/static/readonly surfaces never read a transcript or activate a provider.
  if (!binding || !editor.isEditable || !binding.getDocument().writable) return <aside className="oe-agent-chat" contentEditable={false}><strong>Agent chat</strong><p>Private conversation · open the editable document to chat.</p></aside>;
  return <LiveChat key={JSON.stringify([binding.scope,block.id,block.props.agentId])} block={block} editor={editor} binding={binding}/>;
}
function LiveChat({block, editor, binding}: {block: ChatBlock; editor: ChatEditor; binding: AgentChatBinding}) {
  const current = useRef(binding); current.current = binding;
  const selected = binding.agents.find(agent => agent.id === block.props.agentId);
  const [prompt,setPrompt] = useState(''), [contextId,setContextId] = useState(''), [mode,setMode] = useState<AgentChatMode>('ask'), [error,setError] = useState(''), [proposalId,setProposalId] = useState(''), [composing,setComposing] = useState(false);
  const [memoryIds,setMemoryIds] = useState<string[]>([]), [blockIds,setBlockIds] = useState<string[]>([]);
  const [session,setSession] = useState<ReturnType<typeof createAgentChatSession>>();
  useEffect(() => { if (!block.props.agentId) { setSession(undefined); return; }
    const created = createAgentChatSession({
    scope:{...binding.scope,blockId:block.id,agentId:block.props.agentId},store:binding.store,provider:binding.provider,
    host:{isCurrent:s=>current.current.isCurrent(s),getDocument:()=>current.current.getDocument(),getRoute:()=>{
      const b=current.current, agent=b.agents.find(a=>a.id===block.props.agentId);if(b.resolveRoute)return b.resolveRoute(block.props.agentId);return b.connection&&agent?{...b.connection,agentName:agent.name,agentRole:agent.role} satisfies AgentChatRoute:undefined;
    },applyText:(target,text)=>current.current.applyText(target,text), ...(binding.getEmployeeContext ? {getEmployeeContext:()=>current.current.getEmployeeContext?.(block.props.agentId)} : {}), ...(binding.applyDocument ? {applyDocument:(target:AgentChatDocumentSource,document:EditorDocument)=>{const apply=current.current.applyDocument;if(!apply)throw Error('Rich editing is unavailable');apply(target,document);}} : {})}
  }); setSession(created); void created.load(); return () => created.dispose();
  },[binding.scope.actorId,binding.scope.workspaceId,binding.scope.documentId,block.id,block.props.agentId,binding.store,binding.provider,!!binding.getEmployeeContext,!!binding.applyDocument]);
  const empty=useMemo(()=>({status:'loading' as const,messages:[]}),[]);
  const state=useSyncExternalStore(session?.subscribe??(()=>()=>{}),session?.getState??(()=>empty),session?.getState??(()=>empty));

  const run=(operation:()=>unknown)=>{try{setError('');const result=operation();if(result instanceof Promise)void result.catch(e=>setError(e instanceof Error?e.message:String(e)));}catch(e){setError(e instanceof Error?e.message:String(e));}};
  const route=binding.resolveRoute?.(block.props.agentId)??(!binding.resolveRoute&&binding.connection?binding.connection:undefined);
  const targets=agentChatTargets(binding.getDocument().document), ready=state.status==='ready'&&!!selected&&!!route&&!composing, busy=state.status==='sending'||state.status==='recovering', reviewed=state.review;
  const pending=state.messages.at(-1), recoverable=!!binding.provider.recover&&pending?.role==='user'&&!!pending.requestId&&!!pending.recovery;
  const proposalMessage=state.messages.find(message=>message.id===proposalId), proposed=proposalMessage?.proposal, richProposal=proposalMessage?.documentProposal;
  let richPreview: EditorDocument | undefined, previewError = '', employee: AgentChatEmployeeContext | undefined, employeeError = '';
  try { if (richProposal) richPreview=previewAgentChatDocumentProposal(richProposal); } catch (e) { previewError=e instanceof Error?e.message:String(e); }
  try { if (binding.getEmployeeContext && block.props.agentId) employee=parseAgentChatEmployeeContext(binding.getEmployeeContext(block.props.agentId),block.props.agentId); } catch (e) { employeeError=e instanceof Error?e.message:String(e); }
  const richTargets=agentChatDocumentTargets(binding.getDocument().document);
  const toggle=(ids:string[],id:string,checked:boolean)=>checked?[...ids,id]:ids.filter(item=>item!==id);
  return <section className="oe-agent-chat" contentEditable={false} aria-label="文書内エージェントチャット" onCompositionStart={event=>{event.stopPropagation();setComposing(true);}} onCompositionEnd={event=>{event.stopPropagation();setComposing(false);}} onKeyDown={event=>event.stopPropagation()} onMouseDown={event=>event.stopPropagation()}>
    <header>{selected?binding.renderIdentity?.(selected.id):null}<div><strong>エージェントと相談</strong><small>この端末の非公開会話</small></div></header>
    <label>担当<select aria-label="チャットする従業員" value={block.props.agentId} disabled={busy||!!reviewed} onChange={event=>run(()=>{setProposalId('');editor.updateBlock(block.id,{props:{agentId:event.target.value}});})}><option value="">従業員を選択</option>{!selected&&block.props.agentId?<option value={block.props.agentId}>従業員は利用できません</option>:null}{binding.agents.map(agent=><option key={agent.id} value={agent.id}>{agent.name} · {agent.role}</option>)}</select></label>
    <p className="oe-agent-chat-notice">{route?`${route.provider} / ${route.model}`:!block.props.agentId?'従業員を選んでください。':binding.connectionNotice}</p>
    <p className="oe-agent-chat-notice">会話はこのアカウント・ワークスペース・文書・ブロック専用です。文書の共有・複製・公開には含みません。通常の文書保存でチャット枠を保存します。</p>
    <ol className="oe-agent-chat-history" aria-label="会話履歴" aria-live="polite">{state.messages.map(message=><li key={message.id} data-role={message.role}><strong>{message.role==='user'?'あなた':selected?.name??'エージェント'}</strong><p>{message.text}</p>{message.provider?<small>{message.provider} · {message.model}{message.requestedModel?`（指定: ${message.requestedModel}）`:''}</small>:null}{message.proposal||message.documentProposal?<button type="button" disabled={!ready||!!reviewed} onClick={()=>setProposalId(message.id)}>変更案を比較</button>:null}</li>)}</ol>
    {proposed?<section className="oe-agent-chat-review" aria-label="段落の変更案"><strong>元の段落</strong><p>{proposed.target.text}</p><strong>変更案</strong><p>{proposed.text}</p><p>この段落だけを下書きに反映します。保存前に文書全体を確認してください。</p><button type="button" disabled={!ready||!!reviewed} onClick={()=>run(()=>{session?.apply(proposalId);setProposalId('');})}>比較して下書きへ反映</button><button type="button" onClick={()=>setProposalId('')}>閉じる</button></section>:null}
    {richProposal&&richPreview?<section className="oe-agent-chat-review" aria-label="文書の変更案"><strong>{richProposal.title}</strong><ReadableDocumentComparison before={richProposal.source.document} after={richPreview} beforeLabel="元の文書" afterLabel="提案後の文書"/><details><summary>構造・書式を含む変更の詳細</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(richProposal.changes,null,2)}</pre></details><p>選択した範囲だけを変更します。文書全体が生成時から変わっている場合は反映できません。通常の保存は別途必要です。</p><button type="button" disabled={!ready||!!reviewed} onClick={()=>run(()=>{session?.apply(proposalId);setProposalId('');})}>比較して文書の下書きへ反映</button><button type="button" onClick={()=>setProposalId('')}>閉じる</button></section>:null}
    {previewError?<p role="alert">{previewError}</p>:null}
    {mode==='document'?<fieldset disabled={busy||!!reviewed}><legend>AIへ渡すリッチブロックを明示的に選択</legend><p>選択した本文と書式だけを送信します。非公開チャットや未対応ブロックは選択できません。</p>{richTargets.map(target=><label key={target.id}><input type="checkbox" checked={blockIds.includes(target.id)} onChange={event=>setBlockIds(toggle(blockIds,target.id,event.target.checked))}/>{target.type} · {target.text.slice(0,100)||'本文なし'}</label>)}{!richTargets.length?<p>選択できるブロックがありません。</p>:null}</fieldset>:<label>文書の参照範囲<select aria-label="AIへ渡す段落" value={contextId} disabled={busy||!!reviewed} onChange={e=>{setContextId(e.target.value);setProposalId('');}}><option value="">文書を渡さない</option>{targets.filter(t=>mode!=='rewrite'||t.rewrite).map(t=><option key={t.id} value={t.id}>{t.text.slice(0,70)}</option>)}</select></label>}
    <label>相談の種類<select value={mode} disabled={busy||!!reviewed} onChange={e=>{setMode(e.target.value as typeof mode);setContextId('');setBlockIds([]);setProposalId('');}}><option value="ask">質問・相談</option><option value="rewrite">段落の書き換え案</option>{binding.applyDocument?<option value="document">複数ブロック・書式の変更案</option>:null}</select></label>
    {employee?<fieldset disabled={busy||!!reviewed}><legend>承認済みメモリを選択（初期値は送信なし）</legend>{employee.memories.map(memory=><label key={memory.id}><input type="checkbox" checked={memoryIds.includes(memory.id)} onChange={event=>setMemoryIds(toggle(memoryIds,memory.id,event.target.checked))}/>{memory.privacy} · {memory.text}</label>)}{!employee.memories.length?<p>利用できる承認済みメモリはありません。</p>:null}</fieldset>:null}
    {employeeError?<p role="alert">{employeeError}</p>:null}
    <label>メッセージ<textarea aria-label="エージェントへのメッセージ" value={prompt} maxLength={4000} disabled={busy||!!reviewed} onChange={e=>setPrompt(e.target.value)} placeholder="相談したいことを書いてください"/></label>
    {reviewed?<section className="oe-agent-chat-review" aria-label="AI送信の確認"><strong>{reviewed.route.provider} / {reviewed.route.model} に送る内容</strong><p>担当: {reviewed.route.agentName} ({reviewed.route.agentRole})</p><p>{reviewed.prompt}</p><details open><summary>選んだ文書の範囲</summary>{reviewed.documentContext?<><ReadableDocument document={{schemaVersion:1,blocks:reviewed.documentContext.blocks}} label="送信するブロック"/><details><summary>送信する本文・書式の全データ</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(reviewed.documentContext.blocks,null,2)}</pre></details></>:<p>{reviewed.context?.text??'文書は送りません'}</p>}</details>{reviewed.employeeContext?<><details open><summary>担当の完全な指示・プロフィール</summary><p>{reviewed.employeeContext.profile.name} · {reviewed.employeeContext.profile.role}</p><p>{reviewed.employeeContext.profile.description}</p><p style={{whiteSpace:'pre-wrap'}}>{reviewed.employeeContext.profile.instructions||'追加の指示なし'}</p><p>専門: {reviewed.employeeContext.profile.skills?.join(', ')||'なし'}</p><p>能力: {reviewed.employeeContext.profile.capabilities?.join(', ')||'なし'}</p><small>リビジョン: {reviewed.employeeContext.profile.revision}</small></details><details open><summary>明示的に選んだメモリ {reviewed.employeeContext.memories.length} 件</summary>{reviewed.employeeContext.memories.map(memory=><p key={memory.id}>{memory.id} · {memory.privacy} · {memory.text}</p>)}</details></>:null}<details><summary>同時に送る会話 {reviewed.history.length} 件</summary>{reviewed.history.map((m,i)=><p key={i}>{m.role}: {m.text}</p>)}</details><p>上の内容を設定済みAIへ送信します。利用契約に応じて料金が発生する場合があります。検索・ツール実行・他の文書取得は行いません。機密情報は送信前に確認してください。</p>{binding.sendNotice?<p>{binding.sendNotice}</p>:null}<button type="button" onClick={()=>run(()=>session?.send(reviewed.reviewId))}>この内容で送信</button><button type="button" onClick={()=>session?.dismissReview()}>戻って編集</button></section>:<button type="button" disabled={!ready||!prompt.trim()||!!employeeError||mode==='document'&&!blockIds.length} onClick={()=>run(()=>session?.prepare(prompt,mode,contextId||undefined,{memoryIds,blockIds:mode==='document'?blockIds:undefined}))}>送信内容を確認</button>}
    {selected?binding.renderActions?.(selected.id,block.id):null}
    {recoverable?<section aria-label="前の応答の復元"><p>保存済みのリクエストIDから前の応答を照会します。新しい生成や再送は行いません。</p><button type="button" disabled={busy||state.status==='loading'||!!reviewed||!selected||!route||composing||!!employeeError} onClick={()=>run(()=>session?.recover())}>前の応答を照会・復元</button></section>:null}
    {busy?<button type="button" onClick={()=>session?.cancel()}>{state.status==='recovering'?'応答の照会を取り消す':'応答待ちを取り消す'}</button>:null}
    {state.status==='error'?<button type="button" onClick={()=>run(()=>session?.load())}>保存済み会話を再読込</button>:null}
    {state.notice?<p role="status">{state.notice}</p>:null}{error?<p role="alert">{error}</p>:null}
  </section>;
}
const createInteractiveAgentChatSpec=createReactBlockSpec({type:'oeAgentChat',propSchema:{agentId:{default:''},title:{default:'Agent chat'}},content:'none'}, {
  meta:interactiveBlockMeta,
  render:({block,editor})=><ChatSurface block={block} editor={editor as unknown as ChatEditor}/>,
  // HTML/clipboard exports intentionally contain neither employee identity nor private history.
  toExternalHTML:()=> <aside>Agent chat · private conversation omitted</aside>
});
/** Override the public DOM export after React's wrapper is composed: otherwise
 * BlockNote copies data-agent-id and data-title from that wrapper into HTML. */
export function createAgentChatBlockSpec() {
  const spec=createInteractiveAgentChatSpec();
  return {...spec,implementation:{...spec.implementation,toExternalHTML:()=>{
    const dom=document.createElement('aside');dom.textContent='Agent chat · private conversation omitted';return {dom};
  }}};
}
export function createAgentChatFeature() {
  return {id:'agent-chat',blockSpecs:{oeAgentChat:createAgentChatBlockSpec()},commands:[{id:'agent-chat.insert',title:'エージェントチャット',subtitle:'文書の中で相談する',aliases:['chat','agent','AI','相談'],group:'collab',surfaces:['slash','palette'],run:({editor})=>{editor.insertBlocks([{type:'oeAgentChat',props:{agentId:'',title:'Agent chat'}}],editor.getTextCursorPosition().block,'after');}}]} satisfies OpenEditorPowerFeature;
}
