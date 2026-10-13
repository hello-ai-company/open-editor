import { describe, expect, it, vi } from 'vitest';
import type { EditorDocument } from '@hello-ai-company/editor-core';
import { createAgentChatSession, parseAgentChatRecord, type AgentChatEmployeeContext, type AgentChatProvider, type AgentChatRecord, type AgentChatResponse, type AgentChatScope } from '../src/agentChat.js';
const clone = <T,>(value: T): T => structuredClone(value);
const scope: AgentChatScope = { actorId: 'actor', workspaceId: 'workspace', documentId: 'document', blockId: 'chat', agentId: 'employee' };
const answer: AgentChatResponse = { text: 'Recovered response', provider: 'openai', model: 'model' };
const richAnswer: AgentChatResponse = { ...answer, documentProposal: { title: 'Reviewed change', changes: [{ op: 'replace', blockId: 'p', block: { id: 'p', type: 'heading', props: { level: 2 }, content: 'Recovered rich proposal' } }] } };
function fixture() {
  let n = 0, current = true, writable = true, routeAvailable = true, stored: AgentChatRecord | undefined;
  let document: EditorDocument = { schemaVersion: 1, blocks: [{ id: 'chat', type: 'oeAgentChat', props: { agentId: 'employee', title: 'Chat' } }, { id: 'p', type: 'paragraph', content: 'Original' }, { id: 'opaque', type: 'future-widget', props: { privatePayload: 'Never transmitted' } }] };
  let employee: AgentChatEmployeeContext = { profile: { agentId: 'employee', name: 'Employee', role: 'Writer', instructions: 'Canonical instructions', revision: 'p1', fingerprint: 'profile1' }, memories: [{ id: 'm1', text: 'Selected approved memory', privacy: 'personal', revision: 'r1', fingerprint: 'f1' }, { id: 'm2', text: 'Unselected memory', privacy: 'public', revision: 'r2', fingerprint: 'f2' }] };
  const generate = vi.fn<AgentChatProvider['generate']>().mockRejectedValue(Error('Lost acknowledgement; generation outcome unknown'));
  const recover = vi.fn<NonNullable<AgentChatProvider['recover']>>().mockResolvedValue(clone(answer));
  const provider: AgentChatProvider = { generate, recover };
  const applyDocument = vi.fn((source, next) => { if (JSON.stringify(document) !== source.fingerprint) throw Error('Full-source CAS failed'); document = clone(next); });
  const applyText = vi.fn();
  const compareAndSet = vi.fn(async (_scope: AgentChatScope, revision: number, next: AgentChatRecord) => { if ((stored?.revision ?? 0) !== revision) return false; stored = clone(next); return true; });
  const host = { isCurrent: () => current, getDocument: () => ({ document, writable }), getRoute: () => routeAvailable ? { provider: 'openai', model: 'model', agentName: 'Employee', agentRole: 'Writer' } : undefined, getEmployeeContext: () => employee, applyDocument, applyText };
  const make = () => createAgentChatSession({ scope, provider, host, store: { read: async () => stored, compareAndSet }, id: () => `id-${++n}` });
  const interrupt = async (rich = false) => { const session = make(); await session.load(); const review = session.prepare('Please help', rich ? 'document' : 'ask', undefined, { memoryIds: ['m1'], ...(rich ? { blockIds: ['p'] } : {}) }); await session.send(review.reviewId); expect(session.getState().status).toBe('error'); return session; };
  return { make, interrupt, generate, recover, provider, host, compareAndSet, applyDocument, applyText, get stored() { return stored; }, set stored(value) { stored = value; }, get document() { return document; }, set document(value) { document = value; }, get employee() { return employee; }, set employee(value) { employee = value; }, set current(value: boolean) { current = value; }, set writable(value: boolean) { writable = value; }, set routeAvailable(value: boolean) { routeAvailable = value; } };
}
describe('explicit durable response recovery', () => {
  it('persists exact approval before generate and recovers after reload using only the receipt callback', async () => {
    const f = fixture(); f.generate.mockImplementationOnce(async request => { expect(f.stored?.messages.at(-1)?.recovery?.request).toEqual(request); throw Error('Lost acknowledgement'); });
    const original = await f.interrupt(), pending = clone(f.stored!); original.dispose(); const reopened = f.make(); await reopened.load(); expect(f.recover).not.toHaveBeenCalled(); expect(f.generate).toHaveBeenCalledTimes(1); expect(f.stored).toEqual(pending);
    await reopened.recover(); expect(f.generate).toHaveBeenCalledTimes(1); expect(f.recover).toHaveBeenCalledTimes(1); expect(f.recover.mock.calls[0]![0]).toEqual(f.generate.mock.calls[0]![0]); expect(reopened.getState().status).toBe('ready');
    expect(f.stored?.messages.map(message => message.role)).toEqual(['user', 'assistant']); expect(f.stored?.messages[0]?.recovery).toBeUndefined(); expect(f.stored?.messages[1]?.requestId).toBe(pending.messages[0]?.requestId); expect(f.applyText).not.toHaveBeenCalled(); await expect(reopened.recover()).rejects.toThrow('No approved'); expect(f.recover).toHaveBeenCalledTimes(1);
  });
  it('recovers rich proposals with original full-source CAS and requires explicit apply', async () => {
    const f = fixture(), original = clone(f.document), session = await f.interrupt(true); session.dispose(); f.recover.mockResolvedValue(clone(richAnswer)); const reopened = f.make(); await reopened.load(); await reopened.recover(); expect(reopened.getState().status).toBe('ready');
    const sent = f.recover.mock.calls[0]![0]; expect(JSON.stringify(sent)).not.toMatch(/documentSource|privatePayload|Never transmitted|Unselected memory/); expect(sent.documentContext?.blocks.map(block => block.id)).toEqual(['p']); expect(f.document).toEqual(original); expect(f.applyDocument).not.toHaveBeenCalled();
    const reply = reopened.getState().messages.at(-1)!; expect(reply.documentProposal?.source.document).toEqual(original); reopened.apply(reply.id); expect(f.applyDocument).toHaveBeenCalledTimes(1); expect(f.document.blocks[2]).toEqual(original.blocks[2]); expect(() => reopened.apply(reply.id)).toThrow('full document changed');
  });
  it.each(['profile', 'memory', 'revoked-memory', 'full-source', 'marker-title', 'marker-employee', 'removed-marker', 'scope', 'readonly', 'route'])('withholds lookup after current %s changed', async kind => {
    const f = fixture(), session = await f.interrupt(true);
    if (kind === 'profile') f.employee.profile.revision = 'p2'; if (kind === 'memory') f.employee.memories[0]!.text = 'Changed selected memory'; if (kind === 'revoked-memory') f.employee.memories = []; if (kind === 'full-source') f.document.blocks[2]!.props = { privatePayload: 'New input' }; if (kind === 'marker-title') f.document.blocks[0]!.props!.title = 'Different title'; if (kind === 'marker-employee') f.document.blocks[0]!.props!.agentId = 'other'; if (kind === 'removed-marker') f.document.blocks.shift(); if (kind === 'scope') f.current = false; if (kind === 'readonly') f.writable = false; if (kind === 'route') f.routeAvailable = false;
    const before = clone(f.stored); await expect(session.recover()).rejects.toThrow(); expect(f.recover).not.toHaveBeenCalled(); expect(f.generate).toHaveBeenCalledTimes(1); expect(f.stored).toEqual(before);
  });
  it('allows unselected approved-memory edits', async () => { const f = fixture(), session = await f.interrupt(); f.employee.memories[1]!.text = 'New unselected data'; await session.recover(); expect(session.getState().status).toBe('ready'); });
  it('recovers paragraph rewrites against the original paragraph without applying them implicitly', async () => {
    const f = fixture(), session = f.make(); await session.load(); await session.send(session.prepare('Rewrite this', 'rewrite', 'p').reviewId); session.dispose();
    const reopened = f.make(); await reopened.load(); await reopened.recover(); const reply = reopened.getState().messages.at(-1)!; expect(reply.proposal?.target.text).toBe('Original'); expect(f.applyText).not.toHaveBeenCalled(); reopened.apply(reply.id); expect(f.applyText).toHaveBeenCalledWith(expect.objectContaining({ blockId: 'p', text: 'Original' }), answer.text);
  });
  it.each(['ask', 'rewrite'] as const)('refuses stale selected paragraphs for recovered %s responses', async mode => {
    const f = fixture(), session = f.make(); await session.load(); await session.send(session.prepare('Help with this', mode, 'p').reviewId); f.document.blocks[1]!.content = 'Newer paragraph'; await expect(session.recover()).rejects.toThrow('paragraph changed'); expect(f.recover).not.toHaveBeenCalled(); expect(f.generate).toHaveBeenCalledTimes(1);
  });
  it.each(['profile', 'memory', 'source', 'marker', 'scope', 'readonly', 'route'])('withholds late recovery when %s changes during lookup', async kind => {
    const f = fixture(), session = await f.interrupt(true), before = clone(f.stored);
    f.recover.mockImplementationOnce(async () => { if (kind === 'profile') f.employee.profile.fingerprint = 'new'; if (kind === 'memory') f.employee.memories = []; if (kind === 'source') f.document.blocks.push({ id: 'new', type: 'paragraph', content: 'New input' }); if (kind === 'marker') f.document.blocks[0]!.props!.title = 'New title'; if (kind === 'scope') f.current = false; if (kind === 'readonly') f.writable = false; if (kind === 'route') f.routeAvailable = false; return clone(richAnswer); });
    await session.recover(); expect(session.getState().status).toBe('error'); expect(session.getState().messages).toHaveLength(1); expect(f.stored).toEqual(before); expect(f.applyDocument).not.toHaveBeenCalled();
  });
  it.each(['cancel', 'dispose'])('discards %s during receipt lookup without generating again', async kind => {
    const f = fixture(), session = await f.interrupt(); let finish!: (result: AgentChatResponse) => void; f.recover.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })); const pending = session.recover(); await vi.waitFor(() => expect(f.recover).toHaveBeenCalledTimes(1));
    if (kind === 'cancel') session.cancel(); else session.dispose(); expect(f.recover.mock.calls[0]![1].aborted).toBe(true); finish(clone(answer)); await pending; expect(f.stored?.messages).toHaveLength(1); expect(f.generate).toHaveBeenCalledTimes(1); expect(f.stored?.messages[0]?.recovery).toBeDefined();
  });
  it('rejects duplicate clicks and retains unknown results for a later explicit lookup', async () => {
    const f = fixture(), session = await f.interrupt(); let fail!: (reason: Error) => void; f.recover.mockImplementationOnce(() => new Promise((_resolve, reject) => { fail = reject; })); const pending = session.recover(); await vi.waitFor(() => expect(f.recover).toHaveBeenCalledTimes(1));
    await expect(session.recover()).rejects.toThrow('Finish'); await session.load(); expect(f.recover).toHaveBeenCalledTimes(1); fail(Error('Receipt outcome_unknown')); await pending; expect(session.getState().notice).toContain('outcome_unknown'); expect(f.stored?.messages).toHaveLength(1); await session.load(); expect(f.recover).toHaveBeenCalledTimes(1); await session.recover(); expect(f.recover).toHaveBeenCalledTimes(2); expect(f.generate).toHaveBeenCalledTimes(1);
  });
  it('allows only a newly reviewed separate send after unresolved recovery and preserves the prior identity', async () => {
    const f = fixture(), session = await f.interrupt(), priorId = f.stored!.messages[0]!.requestId;
    f.recover.mockRejectedValueOnce(Error('Receipt not found; original outcome unknown')); await session.recover(); expect(f.generate).toHaveBeenCalledTimes(1); await session.load(); const review = session.prepare('Start a different question', 'ask');
    expect(review.requestId).not.toBe(priorId); expect(session.getState().notice).toContain('possible additional cost'); expect(f.generate).toHaveBeenCalledTimes(1); session.dismissReview(); expect(f.stored?.messages[0]?.recovery).toBeDefined();
    const approved = session.prepare('Start a different question', 'ask'); f.generate.mockResolvedValueOnce(clone(answer)); await session.send(approved.reviewId);
    expect(f.generate).toHaveBeenCalledTimes(2); expect(f.stored?.messages.map(message => message.requestId)).toEqual([priorId, approved.requestId, approved.requestId]); expect(f.stored?.messages[0]?.recovery).toBeUndefined(); expect(f.stored?.messages[0]?.text).toBe('Please help');
  });
  it('suppresses the original late response after cancellation and approval of a separate new request', async () => {
    const f = fixture(), session = f.make(); let finish!: (result: AgentChatResponse) => void; f.generate.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })); await session.load(); const prior = session.prepare('Original unknown request', 'ask'), pending = session.send(prior.reviewId); await vi.waitFor(() => expect(f.generate).toHaveBeenCalledTimes(1)); session.cancel(); await session.load();
    const next = session.prepare('Separately approved request', 'ask'); f.generate.mockResolvedValueOnce(clone(answer)); await session.send(next.reviewId); finish({ ...answer, text: 'Obsolete late response' }); await pending;
    expect(session.getState().status).toBe('ready'); expect(f.stored?.messages.map(message => message.text)).toEqual(['Original unknown request', 'Separately approved request', answer.text]); expect(f.stored?.messages[0]?.requestId).toBe(prior.reviewId); expect(f.generate).toHaveBeenCalledTimes(2);
  });
  it.each(['before', 'during'])('preserves competing history changes %s lookup with atomic revision checks', async stage => {
    const f = fixture(), session = await f.interrupt(), change = () => { f.stored = { ...clone(f.stored!), revision: f.stored!.revision + 1, messages: [...f.stored!.messages, { id: 'other', role: 'user', text: 'Another view', createdAt: 'now' }] }; }; if (stage === 'before') change(); else f.recover.mockImplementationOnce(async () => { change(); return clone(answer); });
    await session.recover(); expect(session.getState().status).toBe('error'); expect(f.stored?.messages.at(-1)?.text).toBe('Another view'); expect(f.stored?.messages).toHaveLength(2); expect(f.generate).toHaveBeenCalledTimes(1); expect(f.recover).toHaveBeenCalledTimes(stage === 'before' ? 0 : 1);
  });
  it.each(['provider', 'model', 'empty', 'missing-rich', 'unsafe-rich'])('applies send validation to %s receipt payloads', async kind => {
    const f = fixture(), session = await f.interrupt(true), result = clone(richAnswer); if (kind === 'provider') result.provider = 'other'; if (kind === 'model') result.model = 'other'; if (kind === 'empty') result.text = ''; if (kind === 'missing-rich') delete result.documentProposal; if (kind === 'unsafe-rich') result.documentProposal!.changes = [{ op: 'delete', blockId: 'opaque' }]; f.recover.mockResolvedValueOnce(result);
    await session.recover(); expect(session.getState().status).toBe('error'); expect(f.stored?.messages).toHaveLength(1); expect(f.applyDocument).not.toHaveBeenCalled();
  });
  it('never generates if its recovery journal cannot persist', async () => { const f = fixture(), session = f.make(); await session.load(); f.compareAndSet.mockResolvedValue(false); await session.send(session.prepare('Hello', 'ask').reviewId); expect(f.generate).not.toHaveBeenCalled(); expect(f.recover).not.toHaveBeenCalled(); expect(f.stored).toBeUndefined(); });
  it.each([undefined, 'legacy-request-id'])('preserves legacy requestId %s without inventing approved recovery context', async requestId => {
    const f = fixture(); f.stored = { version: 1, scope, revision: 1, messages: [{ id: 'legacy', role: 'user', text: 'Old incomplete message', createdAt: 'now', ...(requestId ? { requestId } : {}) }] }; const before = clone(f.stored), session = f.make(); await session.load(); expect(session.getState().status).toBe('ready'); await expect(session.recover()).rejects.toThrow('No approved'); expect(f.stored).toEqual(before); expect(f.generate).not.toHaveBeenCalled(); expect(f.recover).not.toHaveBeenCalled(); expect(f.compareAndSet).not.toHaveBeenCalled();
  });
  it('supports hosts without recovery and never falls back to generate', async () => { const f = fixture(), session = await f.interrupt(); delete f.provider.recover; await expect(session.recover()).rejects.toThrow('unavailable'); expect(f.generate).toHaveBeenCalledTimes(1); expect(f.stored?.messages[0]?.recovery).toBeDefined(); });
  it.each(['scope', 'request-id', 'prompt', 'history', 'source', 'marker', 'unknown-field', 'oversized', 'selected-memory-limit', 'revision'])('rejects malformed %s recovery without rewriting it', async kind => {
    const f = fixture(); await f.interrupt(true); const stored = clone(f.stored!), recovery = stored.messages[0]!.recovery!;
    if (kind === 'scope') recovery.request.scope.actorId = 'foreign'; if (kind === 'request-id') recovery.request.requestId = 'other'; if (kind === 'prompt') recovery.request.prompt = 'Unapproved prompt'; if (kind === 'history') recovery.request.history = [{ role: 'user', text: 'Invented context' }]; if (kind === 'source') recovery.documentSource!.document.blocks[1]!.content = 'Changed source'; if (kind === 'marker') recovery.markerFingerprint = '{}'; if (kind === 'unknown-field') (recovery.request as any).documentSource = recovery.documentSource; if (kind === 'oversized') recovery.request.prompt = 'x'.repeat(4001); if (kind === 'selected-memory-limit') recovery.request.employeeContext!.memories = Array.from({ length: 11 }, (_, i) => ({ ...recovery.request.employeeContext!.memories[0]!, id: `m${i}` })); if (kind === 'revision') recovery.recordRevision = stored.revision + 1;
    const before = clone(stored); expect(() => parseAgentChatRecord(stored, scope)).toThrow(); expect(stored).toEqual(before);
  });
});
