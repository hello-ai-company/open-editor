import type { EditorBlock, EditorDocument } from '@hello-ai-company/editor-core';
import { agentChatDocumentContext, agentChatDocumentSource, previewAgentChatDocumentProposal, type AgentChatDocumentContext, type AgentChatDocumentSource, type AgentChatDocumentProposal, type AgentChatDocumentProposalResponse } from './agentChatDocument.js';
/** No credentials, tools, search, background runs or implicit context in this contract. */
export type AgentChatMode = 'ask' | 'rewrite' | 'document';
export type AgentChatEmployeeProfile = { agentId: string; name: string; role: string; instructions: string; revision: string; fingerprint: string; description?: string; skills?: string[]; capabilities?: string[] };
/** Hosts supply only canonical, currently approved eligible memories. The SDK defaults to none. */
export type AgentChatApprovedMemory = { id: string; text: string; privacy: 'public' | 'personal'; revision: string; fingerprint: string };
export type AgentChatEmployeeContext = { profile: AgentChatEmployeeProfile; memories: AgentChatApprovedMemory[] };
export type AgentChatPrepareOptions = { memoryIds?: string[]; blockIds?: string[] };
export const AGENT_CHAT_BLOCK_TYPE = 'oeAgentChat' as const;
export type AgentChatScope = { actorId: string; workspaceId: string; documentId: string; blockId: string; agentId: string };
export type AgentChatRoute = { provider: string; model: string; agentName: string; agentRole: string };
export type AgentChatContext = { blockId: string; text: string; fingerprint: string };
export type AgentChatMessage = { id: string; role: 'user' | 'assistant'; text: string; createdAt: string; requestId?: string; recovery?: AgentChatRecovery; provider?: string; model?: string; requestedModel?: string; proposal?: { target: AgentChatContext; text: string }; documentProposal?: AgentChatDocumentProposal; employeeContext?: AgentChatEmployeeContext };
export type AgentChatRecord = { version: 1; scope: AgentChatScope; revision: number; messages: AgentChatMessage[] };
/** CAS must be atomic across tabs; a process-local read followed by write is insufficient. */
export type AgentChatStore = { read(scope: AgentChatScope): Promise<AgentChatRecord | undefined>; compareAndSet(scope: AgentChatScope, expectedRevision: number, next: AgentChatRecord): Promise<boolean> };
export type AgentChatDocument = { document: EditorDocument; writable: boolean };
export type AgentChatRequest = { requestId?: string; scope: AgentChatScope; route: AgentChatRoute; mode: AgentChatMode; prompt: string; history: Array<{ role: 'user' | 'assistant'; text: string }>; context?: AgentChatContext; documentContext?: AgentChatDocumentContext; employeeContext?: AgentChatEmployeeContext };
export type AgentChatResponse = { text: string; provider: string; model: string; requestedModel?: string; documentProposal?: AgentChatDocumentProposalResponse };
export type AgentChatProvider = {
  generate(request: AgentChatRequest, signal: AbortSignal): Promise<AgentChatResponse>;
  /** Read-only receipt lookup for this exact approved request. Never generate, POST, retry or fall back to generate. Recheck current authorization and throw if unavailable. */
  recover?(request: AgentChatRequest, signal: AbortSignal): Promise<AgentChatResponse>;
};
/** Bounded private local journal, persisted before generation. The source and marker never enter either provider callback. */
export type AgentChatRecovery = { version: 1; request: AgentChatRequest & { requestId: string }; recordRevision: number; markerFingerprint: string; documentSource?: AgentChatDocumentSource };
export type AgentChatReview = AgentChatRequest & { reviewId: string; recordRevision: number; documentSource?: AgentChatDocumentSource };
export type AgentChatState = { status: 'loading' | 'ready' | 'sending' | 'recovering' | 'error'; messages: AgentChatMessage[]; notice?: string; review?: AgentChatReview };
export type AgentChatHost = {
  isCurrent(scope: AgentChatScope): boolean;
  getDocument(): AgentChatDocument;
  getRoute(): AgentChatRoute | undefined;
  getEmployeeContext?(): AgentChatEmployeeContext | undefined;
  /** Atomic synchronous full-source comparison + local editor transaction. Never persist automatically. */
  applyDocument?(target: AgentChatDocumentSource, document: EditorDocument): void;
  /** Guarded synchronous editor transaction. Only local draft; host owns normal save/CAS. */
  applyText(target: AgentChatContext, text: string): void;
};
export type AgentChatSession = {
  getState(): AgentChatState; subscribe(listener: () => void): () => void;
  load(): Promise<void>; prepare(prompt: string, mode: AgentChatMode, contextBlockId?: string, options?: AgentChatPrepareOptions): AgentChatReview;
  send(reviewId: string): Promise<void>; recover(): Promise<void>; cancel(): void; dismissReview(): void;
  apply(messageId: string): void; dispose(): void;
};
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
function freeze<T>(value: T): T { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
export const agentChatScopeKey = (s: AgentChatScope): string => JSON.stringify([s.actorId, s.workspaceId, s.documentId, s.blockId, s.agentId]);
function nonempty(value: unknown, max = 256): value is string { return typeof value === 'string' && value.trim().length > 0 && value.length <= max; }
function validScope(scope: AgentChatScope): boolean { return !!scope && ['actorId', 'workspaceId', 'documentId', 'blockId', 'agentId'].every(key => nonempty(scope[key as keyof AgentChatScope])); }
function validRoute(route: AgentChatRoute): boolean { return !!route && nonempty(route.provider) && route.provider !== 'stub' && nonempty(route.model) && nonempty(route.agentName) && nonempty(route.agentRole); }
function only(value: unknown, fields: string[]): boolean { return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => fields.includes(key)); }
/** Neutral marker only. Private history and context never belong in props. */
export function validateAgentChatBlock(block: EditorBlock): void {
  const p = block.props ?? {};
  if (block.type !== AGENT_CHAT_BLOCK_TYPE || block.content !== undefined || block.children?.length || Object.keys(p).some(k => !['agentId', 'title'].includes(k)) || typeof p.agentId !== 'string' || p.agentId.length > 256 || typeof p.title !== 'string' || p.title.length > 120) throw Error('Invalid agent chat marker');
}
export function agentChatTargets(document: EditorDocument): Array<{ id: string; text: string; rewrite: boolean }> {
  const result: Array<{ id: string; text: string; rewrite: boolean }> = [];
  const walk = (blocks: readonly EditorBlock[]): void => { for (const b of blocks) {
    if (['paragraph', 'heading', 'quote', 'bulletListItem', 'numberedListItem', 'checkListItem'].includes(b.type)) {
      const c = b.content;
      const plain = typeof c === 'string' || Array.isArray(c) && c.every(x => x && typeof x === 'object' && !Array.isArray(x) && x.type === 'text' && typeof x.text === 'string' && (!x.styles || typeof x.styles === 'object' && !Object.keys(x.styles).length));
      const text = typeof c === 'string' ? c : Array.isArray(c) ? c.map(x => x && typeof x === 'object' && !Array.isArray(x) && typeof x.text === 'string' ? x.text : '').join('') : '';
      if (text.trim() && text.length <= 12000) result.push({ id: b.id, text, rewrite: plain && b.type === 'paragraph' && !b.children?.length });
    }
    if (b.type !== AGENT_CHAT_BLOCK_TYPE) walk(b.children ?? []);
  } }; walk(document.blocks); return result;
}
function find(document: EditorDocument, id: string): EditorBlock | undefined {
  let found: EditorBlock | undefined, count = 0;
  const walk = (blocks: readonly EditorBlock[]): void => { for (const b of blocks) { if (b.id === id) { found = b; count++; } walk(b.children ?? []); } }; walk(document.blocks);
  if (count > 1) throw Error('Duplicate block identity'); return found;
}
export function agentChatContext(document: EditorDocument, id: string, rewrite = false): AgentChatContext {
  const choice = agentChatTargets(document).find(x => x.id === id), block = find(document, id);
  if (!choice || !block || rewrite && !choice.rewrite) throw Error('Select an eligible text paragraph; styled text is not replaced');
  return { blockId: id, text: choice.text, fingerprint: JSON.stringify(block) };
}
export function parseAgentChatEmployeeContext(value: unknown, agentId: string): AgentChatEmployeeContext {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('The employee context is unavailable');
  const v = value as AgentChatEmployeeContext, p = v.profile;
  const only = (item: object, fields: string[]) => Object.keys(item).every(key => fields.includes(key));
  if (!only(v, ['profile', 'memories']) || !p || !only(p, ['agentId', 'name', 'role', 'instructions', 'revision', 'fingerprint', 'description', 'skills', 'capabilities']) || p.agentId !== agentId || !nonempty(p.name) || !nonempty(p.role) || typeof p.instructions !== 'string' || p.instructions.length > 64000 || !nonempty(p.revision) || !nonempty(p.fingerprint, 128000) || p.description !== undefined && (typeof p.description !== 'string' || p.description.length > 16000)) throw Error('The canonical employee profile is invalid or too large');
  for (const list of [p.skills, p.capabilities]) if (list !== undefined && (!Array.isArray(list) || list.length > 100 || list.some(item => !nonempty(item, 1000)))) throw Error('The employee expertise is invalid');
  if (!Array.isArray(v.memories) || v.memories.length > 100) throw Error('The approved memory list is invalid');
  const ids = new Set<string>();
  for (const m of v.memories) {
    if (!m || !only(m, ['id', 'text', 'privacy', 'revision', 'fingerprint']) || !nonempty(m.id) || ids.has(m.id) || !nonempty(m.text, 12000) || !['public', 'personal'].includes(m.privacy) || !nonempty(m.revision) || !nonempty(m.fingerprint, 24000)) throw Error('An approved memory is invalid or protected');
    ids.add(m.id);
  }
  if (JSON.stringify(v).length > 250000) throw Error('The employee context is too large; nothing was truncated');
  return clone(v);
}
/** Validate retained approval as data, without treating it as permission to generate again. */
export function parseAgentChatRecovery(value: unknown, scope: AgentChatScope): AgentChatRecovery {
  const fail = (): never => { throw Error('Private chat recovery is invalid; original retained'); };
  if (!only(value, ['version', 'request', 'recordRevision', 'markerFingerprint', 'documentSource'])) fail();
  const recovery = value as AgentChatRecovery, request = recovery.request;
  if (recovery.version !== 1 || !Number.isSafeInteger(recovery.recordRevision) || recovery.recordRevision < 1 || JSON.stringify(recovery).length > 900000 || !nonempty(recovery.markerFingerprint, 4000)) fail();
  if (!only(request, ['requestId', 'scope', 'route', 'mode', 'prompt', 'history', 'context', 'documentContext', 'employeeContext']) || !nonempty(request.requestId) || !only(request.scope, ['actorId', 'workspaceId', 'documentId', 'blockId', 'agentId']) || !validScope(request.scope) || agentChatScopeKey(request.scope) !== agentChatScopeKey(scope) || !only(request.route, ['provider', 'model', 'agentName', 'agentRole']) || !validRoute(request.route) || !['ask', 'rewrite', 'document'].includes(request.mode) || !nonempty(request.prompt, 4000)) fail();
  if (!Array.isArray(request.history) || request.history.length > 10 || request.history.some(message => !only(message, ['role', 'text']) || !['user', 'assistant'].includes(message.role) || !nonempty(message.text, 16000))) fail();
  const marker = JSON.parse(recovery.markerFingerprint) as EditorBlock;
  if (!only(marker, ['id', 'type', 'props', 'content', 'children']) || marker.id !== scope.blockId || marker.props?.agentId !== scope.agentId || JSON.stringify(marker) !== recovery.markerFingerprint) fail();
  validateAgentChatBlock(marker);
  if (request.employeeContext !== undefined && parseAgentChatEmployeeContext(request.employeeContext, scope.agentId).memories.length > 10) fail();
  if (request.context !== undefined) {
    if (request.mode === 'document' || !only(request.context, ['blockId', 'text', 'fingerprint']) || !nonempty(request.context.blockId) || !nonempty(request.context.text, 12000) || !nonempty(request.context.fingerprint, 100000)) fail();
    const source = JSON.parse(request.context.fingerprint) as EditorBlock;
    if (JSON.stringify(agentChatContext({ schemaVersion: 1, blocks: [source] }, request.context.blockId, request.mode === 'rewrite')) !== JSON.stringify(request.context)) fail();
  }
  if (request.mode === 'rewrite' && !request.context) fail();
  if (request.mode === 'document') {
    if (!only(recovery.documentSource, ['document', 'fingerprint']) || !only(request.documentContext, ['blocks', 'fingerprint']) || !Array.isArray(request.documentContext!.blocks)) fail();
    const source = agentChatDocumentSource(recovery.documentSource!.document);
    if (source.fingerprint !== recovery.documentSource!.fingerprint || JSON.stringify(agentChatDocumentContext(source.document, request.documentContext!.blocks.map(block => block.id))) !== JSON.stringify(request.documentContext) || JSON.stringify(find(source.document, scope.blockId)) !== recovery.markerFingerprint) fail();
  } else if (request.documentContext !== undefined || recovery.documentSource !== undefined) fail();
  return clone(recovery);
}
export function parseAgentChatRecord(value: unknown, scope: AgentChatScope): AgentChatRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Private chat record is invalid; original retained');
  const r = value as AgentChatRecord;
  if (r.version !== 1 || !validScope(r.scope) || agentChatScopeKey(r.scope) !== agentChatScopeKey(scope) || !Number.isSafeInteger(r.revision) || r.revision < 0 || !Array.isArray(r.messages) || r.messages.length > 100 || JSON.stringify(r).length > 1_000_000) throw Error('Private chat record scope or size is invalid; original retained');
  const ids = new Set<string>();
  for (const [index, m] of r.messages.entries()) {
    if (!m || !nonempty(m.id) || ids.has(m.id) || !['user', 'assistant'].includes(m.role) || !nonempty(m.text, 16000) || !nonempty(m.createdAt, 100) || m.requestId !== undefined && !nonempty(m.requestId) || m.provider !== undefined && !nonempty(m.provider) || m.model !== undefined && !nonempty(m.model) || m.requestedModel !== undefined && !nonempty(m.requestedModel)) throw Error('Private chat message is invalid; original retained');
    ids.add(m.id);
    if (m.recovery !== undefined) {
      const recovery = parseAgentChatRecovery(m.recovery, scope);
      if (m.role !== 'user' || recovery.request.requestId !== m.requestId || recovery.request.prompt !== m.text || recovery.recordRevision > r.revision || JSON.stringify(recovery.request.history) !== JSON.stringify(r.messages.slice(Math.max(0, index - 10), index).map(({ role, text }) => ({ role, text })))) throw Error('Private chat recovery does not match its approved message; original retained');
    }
    if (m.employeeContext) parseAgentChatEmployeeContext(m.employeeContext, scope.agentId);
    if (m.documentProposal) {
      if (m.role !== 'assistant' || m.proposal) throw Error('Private rich proposal is invalid; original retained');
      previewAgentChatDocumentProposal(m.documentProposal);
    }
    if (m.proposal && (m.role !== 'assistant' || !nonempty(m.proposal.text, 16000) || m.proposal.text !== m.text || !m.proposal.target || !nonempty(m.proposal.target.blockId) || !nonempty(m.proposal.target.text, 12000) || !nonempty(m.proposal.target.fingerprint, 100000))) throw Error('Private chat proposal is invalid; original retained');
  }
  return clone(r);
}
export function createAgentChatSession(o: { scope: AgentChatScope; host: AgentChatHost; store: AgentChatStore; provider: AgentChatProvider; id?: () => string; now?: () => string }): AgentChatSession {
  const scope = clone(o.scope), listeners = new Set<() => void>(), id = o.id ?? (() => globalThis.crypto.randomUUID()), now = o.now ?? (() => new Date().toISOString());
  if (!validScope(scope)) throw Error('An explicit private chat scope is required');
  let record: AgentChatRecord = { version: 1, scope, revision: 0, messages: [] }, state: AgentChatState = { status: 'loading', messages: [] }, active = true, epoch = 0, abort: AbortController | undefined;
  const emit = (next: AgentChatState): void => { if (!active) return; state = freeze(clone(next)); listeners.forEach(f => f()); };
  const check = (): AgentChatDocument => {
    if (!active || !o.host.isCurrent(scope)) throw Error('Account, workspace or document changed');
    const d = o.host.getDocument(), b = find(d.document, scope.blockId);
    if (!b || b.type !== AGENT_CHAT_BLOCK_TYPE || b.props?.agentId !== scope.agentId) throw Error('Chat block was removed or its employee changed');
    validateAgentChatBlock(b); if (!d.writable) throw Error('The document is read-only or has unresolved input'); return d;
  };
  const route = (): AgentChatRoute => { const r = o.host.getRoute(); if (!r || !validRoute(r)) throw Error('A verified AI connection and employee are required'); return clone(r); };
  const employeeContext = (memoryIds: string[] = []): AgentChatEmployeeContext | undefined => {
    if (!Array.isArray(memoryIds) || memoryIds.length > 10 || new Set(memoryIds).size !== memoryIds.length) throw Error('Select at most ten distinct approved memories');
    if (!o.host.getEmployeeContext) { if (memoryIds.length) throw Error('Approved memories are unavailable'); return undefined; }
    const context = parseAgentChatEmployeeContext(o.host.getEmployeeContext(), scope.agentId);
    if (memoryIds.some(id => !context.memories.some(memory => memory.id === id))) throw Error('A selected memory is no longer approved or available');
    return { profile: context.profile, memories: context.memories.filter(memory => memoryIds.includes(memory.id)).sort((a, b) => a.id.localeCompare(b.id)) };
  };
  const validateContext = (review: Pick<AgentChatReview, 'employeeContext' | 'documentSource' | 'context' | 'mode'>): void => {
    if (JSON.stringify(employeeContext(review.employeeContext?.memories.map(memory => memory.id))) !== JSON.stringify(review.employeeContext)) throw Error('Employee instructions or selected memories changed. Review again');
    const d = check();
    if (review.context && JSON.stringify(agentChatContext(d.document, review.context.blockId, review.mode === 'rewrite')) !== JSON.stringify(review.context)) throw Error('The selected paragraph changed. Review the send again');
    if (review.documentSource && JSON.stringify(d.document) !== review.documentSource.fingerprint) throw Error('The full document changed. Review the proposal again');
  };
  const validateReview = (review: AgentChatReview): void => {
    check(); if (JSON.stringify(route()) !== JSON.stringify(review.route) || record.revision !== review.recordRevision) throw Error('Connection or conversation changed. Review the send again');
    validateContext(review);
  };
  const save = async (messages: AgentChatMessage[], generation: number): Promise<void> => {
    check(); const next = parseAgentChatRecord({ ...record, revision: record.revision + 1, messages }, scope);
    if (!await o.store.compareAndSet(scope, record.revision, next)) throw Error('This chat changed in another view. Reload it before sending again');
    if (!active || epoch !== generation || !o.host.isCurrent(scope)) return; record = next;
  };
  const requestFor = (review: AgentChatReview): AgentChatRecovery['request'] => ({ requestId: review.reviewId, scope: clone(review.scope), route: clone(review.route), mode: review.mode, prompt: review.prompt, history: clone(review.history), ...(review.context ? { context: clone(review.context) } : {}), ...(review.documentContext ? { documentContext: clone(review.documentContext) } : {}), ...(review.employeeContext ? { employeeContext: clone(review.employeeContext) } : {}) });
  const validateRecovery = (recovery: AgentChatRecovery): void => {
    const d = check(), pending = record.messages.at(-1);
    if (record.revision !== recovery.recordRevision || pending?.role !== 'user' || pending.requestId !== recovery.request.requestId || JSON.stringify(pending.recovery) !== JSON.stringify(recovery)) throw Error('The saved conversation changed. Reload before recovering');
    if (JSON.stringify(route()) !== JSON.stringify(recovery.request.route)) throw Error('Employee or AI connection changed. The reply was not adopted');
    if (JSON.stringify(find(d.document, scope.blockId)) !== recovery.markerFingerprint) throw Error('The chat marker changed. The reply was not adopted');
    validateContext({ ...recovery.request, documentSource: recovery.documentSource });
  };
  const withoutRecovery = (messages: AgentChatMessage[]): AgentChatMessage[] => messages.map(({ recovery: _recovery, ...message }) => message);
  // Generation and receipt recovery share all response validation and local proposal adoption.
  const adoptResponse = async (response: AgentChatResponse, recovery: AgentChatRecovery, generation: number, signal: AbortSignal): Promise<void> => {
    if (!active || generation !== epoch || signal.aborted) return;
    validateRecovery(recovery);
    const request = recovery.request;
    if (!response || response.provider !== request.route.provider || !nonempty(response.model) || response.model !== request.route.model && response.requestedModel !== `${request.route.provider}:${request.route.model}` || !nonempty(response.text, 16000)) throw Error('The provider returned an invalid or unexpected response');
    let documentProposal: AgentChatDocumentProposal | undefined;
    if (response.documentProposal) {
      if (request.mode !== 'document' || !recovery.documentSource || !request.documentContext) throw Error('The provider returned an unrequested rich document proposal');
      if (Object.keys(response.documentProposal).some(key => !['title', 'changes'].includes(key))) throw Error('The rich proposal contains unexpected fields');
      documentProposal = { ...clone(response.documentProposal), source: clone(recovery.documentSource), selectedBlockIds: request.documentContext.blocks.map(block => block.id) };
      previewAgentChatDocumentProposal(documentProposal);
    }
    if (request.mode === 'document' && !documentProposal) throw Error('The provider did not return a structured rich document proposal');
    await save([...withoutRecovery(record.messages), { id: id(), role: 'assistant', text: response.text, createdAt: now(), requestId: request.requestId, provider: response.provider, model: response.model, ...(response.model !== request.route.model ? { requestedModel: request.route.model } : {}), ...(request.mode === 'rewrite' && request.context ? { proposal: { target: request.context, text: response.text } } : {}), ...(documentProposal ? { documentProposal } : {}), ...(request.employeeContext ? { employeeContext: request.employeeContext } : {}) }], generation);
    if (!active || generation !== epoch || signal.aborted) return;
    check();
    if (JSON.stringify(route()) !== JSON.stringify(request.route) || JSON.stringify(find(check().document, scope.blockId)) !== recovery.markerFingerprint) throw Error('Employee, connection or chat marker changed. The reply was withheld');
    validateContext({ ...request, documentSource: recovery.documentSource });
    emit({ status: 'ready', messages: clone(record.messages) });
  };
  const session: AgentChatSession = {
    getState: () => state, subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    async load() {
      if (state.status === 'sending' || state.status === 'recovering') return; const generation = ++epoch; emit({status:'loading',messages:[]});
      try { check(); const saved = await o.store.read(scope); if (!active || generation !== epoch) return; check();
        record = saved ? parseAgentChatRecord(saved, scope) : { version: 1, scope, revision: 0, messages: [] };
        emit({ status: 'ready', messages: clone(record.messages), ...(record.messages.at(-1)?.role === 'user' ? { notice: 'The previous request has no saved reply and may still be running or have incurred cost. It will not be resent automatically.' } : {}) });
      } catch (error) { if (active && generation === epoch) emit({ status: 'error', messages: [], notice: error instanceof Error ? error.message : 'Unable to load private chat' }); }
    },
    prepare(prompt, mode, contextBlockId, options = {}) {
      if (state.status !== 'ready') throw Error('Finish or reload the current chat first');
      const d = check(); if (!nonempty(prompt.trim(), 4000)) throw Error('Enter a message of 1–4000 characters');
      if (record.messages.length >= 98) throw Error('This chat reached its local limit. Insert a new chat block');
      if (!['ask', 'rewrite', 'document'].includes(mode)) throw Error('Unsupported chat mode');
      if (mode === 'document' && !o.host.applyDocument) throw Error('Rich document editing is not enabled by this host');
      if (mode === 'document' && contextBlockId || mode !== 'document' && options.blockIds?.length) throw Error('Choose one explicit document context mode');
      const richContext = mode === 'document' ? agentChatDocumentContext(d.document, options.blockIds ?? []) : undefined;
      const source = richContext ? agentChatDocumentSource(d.document) : undefined;
      const employee = employeeContext(options.memoryIds);
      const context = contextBlockId ? agentChatContext(d.document, contextBlockId, mode === 'rewrite') : undefined;
      if (mode === 'rewrite' && !context) throw Error('Choose a paragraph to rewrite');
      const reviewId = id();
      if (!nonempty(reviewId) || record.messages.some(message => message.requestId === reviewId)) throw Error('A fresh request identity is required for a new send');
      const review: AgentChatReview = { requestId: reviewId, scope, route: route(), mode, prompt: prompt.trim(), history: record.messages.slice(-10).map(({role, text}) => ({role, text})), ...(context ? { context } : {}), ...(richContext ? { documentContext: richContext, documentSource: source } : {}), ...(employee ? { employeeContext: employee } : {}), reviewId, recordRevision: record.revision };
      emit({ status: 'ready', messages: clone(record.messages), review: clone(review), ...(record.messages.at(-1)?.role === 'user' ? { notice: 'The prior request has no saved reply and may still be running or have incurred cost. Approving this message starts a separate AI request with a new ID and possible additional cost. It does not recover or cancel the prior request. After approving this new send, the previous reply can no longer be recovered through this chat UI; its request ID remains in history.' } : {}) }); return clone(review);
    },
    async send(reviewId) {
      const review = state.review; if (state.status !== 'ready' || !review || review.reviewId !== reviewId) throw Error('Review this exact request before sending');
      validateReview(review);
      const recovery = parseAgentChatRecovery({ version: 1, request: requestFor(review), recordRevision: record.revision + 1, markerFingerprint: JSON.stringify(find(check().document, scope.blockId)), ...(review.documentSource ? { documentSource: clone(review.documentSource) } : {}) }, scope);
      const generation = ++epoch; abort = new AbortController(); const signal = abort.signal;
      emit({ status: 'sending', messages: clone(record.messages) });
      try {
        await save([...withoutRecovery(record.messages), { id: id(), role: 'user', text: review.prompt, createdAt: now(), requestId: review.reviewId, recovery }], generation);
        if (!active || generation !== epoch || signal.aborted) return;
        emit({ status: 'sending', messages: clone(record.messages) });
        validateRecovery(recovery);
        const response = await o.provider.generate(clone(recovery.request), signal);
        await adoptResponse(response, recovery, generation, signal);
      } catch (error) { if (active && generation === epoch) emit({ status: 'error', messages: clone(state.messages), notice: error instanceof Error ? error.message : 'AI request failed; no automatic retry' }); }
    },
    async recover() {
      if (!['ready', 'error'].includes(state.status) || state.review) throw Error('Finish the current review or request before recovering');
      if (!o.provider.recover) throw Error('Read-only response recovery is unavailable');
      const pending = record.messages.at(-1);
      if (pending?.role !== 'user' || !pending.recovery || !pending.requestId) throw Error('No approved prior request is available to recover');
      const recovery = parseAgentChatRecovery(pending.recovery, scope);
      validateRecovery(recovery);
      const generation = ++epoch; abort = new AbortController(); const signal = abort.signal;
      emit({ status: 'recovering', messages: clone(record.messages), notice: 'Looking up the prior response. No new AI request will be sent.' });
      try {
        // A read before lookup avoids displaying an obsolete request; final adoption still uses atomic CAS.
        const saved = await o.store.read(scope);
        if (!active || generation !== epoch || signal.aborted) return;
        if (!saved || JSON.stringify(parseAgentChatRecord(saved, scope)) !== JSON.stringify(record)) throw Error('This chat changed in another view. Reload before recovering');
        validateRecovery(recovery);
        const response = await o.provider.recover(clone(recovery.request), signal);
        await adoptResponse(response, recovery, generation, signal);
      } catch (error) { if (active && generation === epoch) emit({ status: 'error', messages: clone(state.messages), notice: error instanceof Error ? error.message : 'The prior response is unavailable. No new AI request was sent.' }); }
    },
    cancel() { if (!active) return; const recovering = state.status === 'recovering'; ++epoch; abort?.abort(); emit({ status: 'error', messages: clone(state.messages), notice: recovering ? 'Stopped looking up the prior response. No new AI request was sent. The original request may still be running.' : 'Stopped waiting. A request already sent may still run or incur cost. Reload the saved history before sending again.' }); },
    dismissReview() { if (state.status === 'ready') emit({ status: 'ready', messages: clone(record.messages) }); },
    apply(messageId) {
      if (state.status !== 'ready' || state.review) throw Error('Finish the current send review first');
      const message = record.messages.find(x => x.id === messageId);
      if (!message || !message.proposal && !message.documentProposal) throw Error('No reviewed document proposal exists');
      if (JSON.stringify(employeeContext(message.employeeContext?.memories.map(memory => memory.id))) !== JSON.stringify(message.employeeContext)) throw Error('Employee instructions or selected memories changed. Generate a new proposal');
      if (message.documentProposal) {
        const p = message.documentProposal;
        if (!o.host.applyDocument) throw Error('Rich document editing is no longer available');
        if (JSON.stringify(check().document) !== p.source.fingerprint) throw Error('The full document changed. This proposal cannot overwrite it');
        const next = previewAgentChatDocumentProposal(p);
        o.host.applyDocument(clone(p.source), next);
        emit({ status: 'ready', messages: clone(record.messages), notice: 'Applied the reviewed rich proposal to the local document draft. Use the document save action to persist it.' });
        return;
      }
      const p = message.proposal!;
      if (JSON.stringify(agentChatContext(check().document, p.target.blockId, true)) !== JSON.stringify(p.target)) throw Error('The paragraph changed. This proposal cannot overwrite it');
      o.host.applyText(clone(p.target), p.text);
      emit({ status: 'ready', messages: clone(record.messages), notice: 'Applied to the local document draft. Use the document save action to persist it.' });
    },
    dispose() { active = false; ++epoch; abort?.abort(); listeners.clear(); }
  }; return session;
}
