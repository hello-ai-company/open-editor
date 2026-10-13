/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NotesConflictReview } from '../src/react/NotesConflictReview.js';
import type { NotesDocumentSnapshot, NotesWorkspaceController, NotesWorkspaceState } from '../src/notes/contracts.js';

let mount: HTMLDivElement, root: Root, previous: boolean | undefined;
const globals = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
beforeEach(() => { previous = globals.IS_REACT_ACT_ENVIRONMENT; globals.IS_REACT_ACT_ENVIRONMENT = true; mount = document.createElement('div'); document.body.append(mount); root = createRoot(mount); });
afterEach(() => { act(() => root.unmount()); mount.remove(); globals.IS_REACT_ACT_ENVIRONMENT = previous; });
function fixture() {
  const document = { schemaVersion: 1 as const, blocks: [{ id: 'p', type: 'paragraph', content: 'Unchanged body' }] };
  const snapshot: NotesDocumentSnapshot = { scope: { actorId: 'actor', workspaceId: 'workspace' }, target: { kind: 'page', pageId: 'page' }, revision: 'r1', contentRevision: 'c1', title: 'Old saved title', document, metadata: {}, capabilities: ['document.save'], capabilitySemantics: { 'document.save': 'remote-committed' } };
  const latest = { ...snapshot, revision: 'r2', title: 'Latest saved title' };
  let state: NotesWorkspaceState = { status: 'conflict', snapshot, draft: document, draftTitle: 'Retained local title', dirty: true, composing: false, localDrafts: {}, pendingEditors: false, message: '' };
  const listeners = new Set<() => void>();
  const update = (patch: Partial<NotesWorkspaceState>, notify = true) => { state = { ...state, ...patch }; if (notify) for (const fn of listeners) fn(); };
  const controller: NotesWorkspaceController = {
    getState: () => state, subscribe: fn => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    open: vi.fn(), setDraft: vi.fn(), setComposing: vi.fn(), setLocalDraft: vi.fn(), save: vi.fn(), execute: vi.fn(), cancel: vi.fn(), reconcile: vi.fn(), getRecovery: vi.fn(), persistLocalDrafts: vi.fn(), dispose: vi.fn(),
    readLatest: vi.fn(async () => { update({ latest }); return latest; }),
    acceptMergedDraft: vi.fn(async () => { update({ manualSaveRequired: true }); return true; }),
  };
  act(() => root.render(<NotesConflictReview controller={controller} />));
  return { controller, update, document };
}
function button(label: string) { return [...mount.querySelectorAll('button')].find(element => element.textContent === label)!; }
async function compare() { await act(async () => { button('最新と比較する').click(); }); }

it('compares both exact titles for a title-only conflict and prepares an editable title without saving', async () => {
  const f = fixture(); await compare();
  expect(mount.querySelector('[aria-label="保持している入力のタイトル"] p')?.textContent).toBe('Retained local title');
  expect(mount.querySelector('[aria-label="最新の保存内容のタイトル"] p')?.textContent).toBe('Latest saved title');
  expect(button('確認した統合案を準備').disabled).toBe(false);
  const title = mount.querySelector<HTMLInputElement>('fieldset input')!;
  expect(title.value).toBe('Retained local title');
  act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(title, 'Human merged title'); title.dispatchEvent(new Event('input', { bubbles: true })); });
  expect(mount.querySelector('[aria-label="選んだ統合案のタイトル"] p')?.textContent).toBe('Human merged title');
  expect(f.controller.acceptMergedDraft).not.toHaveBeenCalled(); expect(f.controller.save).not.toHaveBeenCalled();
  await act(async () => { button('確認した統合案を準備').click(); });
  expect(f.controller.acceptMergedDraft).toHaveBeenCalledWith('r2', f.document, 'Human merged title');
  expect(f.controller.save).not.toHaveBeenCalled(); expect(f.controller.execute).not.toHaveBeenCalled();
  expect(mount.textContent).toContain('統合案は未保存です');
});
it('invalidates a review after a title-only local edit, preserving reviewed titles until recompare', async () => {
  const f = fixture(); await compare();
  act(() => f.update({ draftTitle: 'New local title only' }));
  expect(button('確認した統合案を準備').disabled).toBe(true);
  expect(mount.textContent).toContain('比較後に内容が変わりました');
  expect(mount.querySelector('[aria-label="保持している入力のタイトル"] p')?.textContent).toBe('Retained local title');
  await compare();
  expect(button('確認した統合案を準備').disabled).toBe(false);
  expect(mount.querySelector('[aria-label="保持している入力のタイトル"] p')?.textContent).toBe('New local title only');
  expect(f.controller.acceptMergedDraft).not.toHaveBeenCalled(); expect(f.controller.save).not.toHaveBeenCalled();
});
it('rechecks a title-only change at click entry before accepting a stale preview', async () => {
  const f = fixture(); await compare();
  f.update({ draftTitle: 'Changed before subscribers render' }, false);
  await act(async () => { button('確認した統合案を準備').click(); });
  expect(f.controller.acceptMergedDraft).not.toHaveBeenCalled(); expect(f.controller.save).not.toHaveBeenCalled();
  expect(mount.textContent).toContain('原本と入力を保持しています');
});
