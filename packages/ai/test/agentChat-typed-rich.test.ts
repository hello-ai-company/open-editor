import { describe, expect, it } from 'vitest';
import type { EditorBlock, EditorDocument } from '@hello-ai-company/editor-core';
import {
  agentChatDocumentContext, agentChatDocumentSource, agentChatDocumentTargets,
  previewAgentChatDocumentProposal, type AgentChatDocumentProposal
} from '../src/agentChatDocument.js';
import type { SuggestionChange } from '../src/suggestions.js';

const paragraph = (id: string, text = id): EditorBlock => ({ id, type: 'paragraph', content: text });
const callout = (): EditorBlock => ({
  id: 'callout', type: 'callout', props: { variant: 'warning', title: 'Review before sharing', textAlignment: 'center' },
  content: [{ type: 'text', text: 'Bounded native content', styles: { bold: true } }],
  children: [{ id: 'numbered', type: 'numberedListItem', props: { start: 7 }, content: 'Keep its explicit start' }]
});
const columns = (): EditorBlock => ({
  id: 'layout', type: 'oeColumns', props: { gap: 16 }, children: [
    { id: 'left', type: 'oeColumn', props: { width: 1.5 }, children: [paragraph('left-text')] },
    { id: 'right', type: 'oeColumn', props: { width: .5 }, children: [callout()] }
  ]
});
const opaque = (): EditorBlock => ({ type: 'future-private-widget', props: { privatePayload: { neverSend: 'preserve exact bytes' } }, id: 'opaque', children: [{ id: 'opaque-child', type: 'future-child' }] });
const document = (): EditorDocument => ({ schemaVersion: 1, blocks: [paragraph('plain'), columns(), opaque(), { id: 'chat', type: 'oeAgentChat', props: { agentId: 'private-agent', title: 'Private conversation' } }] });
function proposal(changes: SuggestionChange[], input = document(), selectedBlockIds = ['plain', 'layout']): AgentChatDocumentProposal {
  return { source: agentChatDocumentSource(input), selectedBlockIds, title: 'Review these exact typed changes', changes };
}
const invalidReplacement = (block: EditorBlock) => proposal([{ op: 'replace', blockId: 'plain', block }]);

describe('bounded native callout and column chat proposals', () => {
  it('selects only whole native subtrees, in source order, without private data', () => {
    const input = document();
    expect(agentChatDocumentTargets(input)).toEqual([
      { id: 'plain', type: 'paragraph', text: 'plain' },
      { id: 'layout', type: 'oeColumns', text: '2 columns' }
    ]);
    const context = agentChatDocumentContext(input, ['layout', 'plain']);
    expect(context.blocks).toEqual(input.blocks.slice(0, 2));
    expect(context.fingerprint).toBe(JSON.stringify(context.blocks));
    expect(JSON.stringify(context)).not.toMatch(/neverSend|private-agent|Private conversation/);
    for (const id of ['left', 'callout', 'opaque', 'chat']) expect(() => agentChatDocumentContext(input, [id])).toThrow();
    context.blocks[1]!.children![1]!.children![0]!.props!.title = 'Detached';
    expect(input.blocks[1]!.children![1]!.children![0]!.props!.title).toBe('Review before sharing');
  });

  it('previews callout title/variant, explicit numbered start, widths and cross-column movement without mutating the source', () => {
    const input = document(), before = JSON.stringify(input);
    const pending = proposal([
      { op: 'update-props', blockId: 'callout', set: { variant: 'info', title: 'Reviewable title' }, remove: [] },
      { op: 'update-props', blockId: 'numbered', set: { start: 12 }, remove: [] },
      { op: 'update-props', blockId: 'left', set: { width: 2 }, remove: [] },
      { op: 'move', blockId: 'left-text', parentId: 'right', beforeId: 'callout' }
    ], input);
    const after = previewAgentChatDocumentProposal(pending);
    expect(JSON.stringify(input)).toBe(before);
    expect(pending.source.document).toEqual(input);
    const [left, right] = after.blocks[1]!.children!;
    expect(left).toMatchObject({ props: { width: 2 }, children: [] });
    expect(right!.children!.map(block => block.id)).toEqual(['left-text', 'callout']);
    expect(right!.children![1]).toMatchObject({ props: { variant: 'info', title: 'Reviewable title' }, children: [{ props: { start: 12 } }] });
    expect(JSON.stringify(after.blocks[2])).toBe(JSON.stringify(input.blocks[2]));
    expect(JSON.stringify(after.blocks[3])).toBe(JSON.stringify(input.blocks[3]));
  });

  it('allows new bounded columns and a nested column group as a single reviewed subtree', () => {
    const nested = columns();
    nested.id = 'nested-layout';
    nested.children = [{ id: 'nested-left', type: 'oeColumn', children: [] }, { id: 'nested-right', type: 'oeColumn', props: { width: 10 }, children: [] }];
    const pending = proposal([{ op: 'insert', parentId: 'left', block: nested }, { op: 'insert', beforeId: 'plain', block: { id: 'new-callout', type: 'callout', props: { variant: 'danger', title: 'New warning' }, content: 'Review this new content' } }]);
    const next = previewAgentChatDocumentProposal(pending);
    expect(next.blocks[0]).toMatchObject({ id: 'new-callout', type: 'callout' });
    expect(next.blocks.find(block => block.id === 'layout')!.children![0]!.children![1]).toEqual(nested);
  });

  it('permits a detached replacement column only when its final parent is a columns group', () => {
    const valid = proposal([{ op: 'replace', blockId: 'left', block: { id: 'left', type: 'oeColumn', props: { width: .1 }, children: [] } }]);
    expect(previewAgentChatDocumentProposal(valid).blocks[1]!.children![0]!.props!.width).toBe(.1);
    expect(() => previewAgentChatDocumentProposal(invalidReplacement({ id: 'plain', type: 'oeColumn', children: [] }))).toThrow('unsupported rich content');
  });

  it.each([
    ['unknown descendant', opaque()],
    ['private chat descendant', { id: 'hidden-chat', type: 'oeAgentChat', props: { agentId: 'secret' } }],
    ['private callout props', { ...callout(), props: { variant: 'info', privacy: 'protected' } }],
    ['hidden inline metadata', { id: 'hidden-inline', type: 'paragraph', content: [{ type: 'text', text: 'Public label', styles: { secret: 'hidden' } }] }]
  ] as const)('omits the entire column subtree for %s', (_label, child) => {
    const input = document();
    const hidden = structuredClone(child) as EditorBlock;
    const rename = (block: EditorBlock): void => { block.id = `hidden-${block.id}`; block.children?.forEach(rename); };
    rename(hidden);
    input.blocks[1]!.children![0]!.children = [hidden];
    expect(agentChatDocumentTargets(input).map(block => block.id)).toEqual(['plain']);
    expect(() => agentChatDocumentContext(input, ['layout'])).toThrow('unknown, private');
  });

  it.each([
    ['orphan root', { id: 'plain', type: 'oeColumn', children: [] }],
    ['one column', { id: 'plain', type: 'oeColumns', children: [{ id: 'only', type: 'oeColumn' }] }],
    ['seven columns', { id: 'plain', type: 'oeColumns', children: Array.from({ length: 7 }, (_, i) => ({ id: `c${i}`, type: 'oeColumn' })) }],
    ['non-column child', { id: 'plain', type: 'oeColumns', children: [{ id: 'col', type: 'oeColumn' }, paragraph('wrong')] }],
    ['noncanonical gap', { ...columns(), id: 'plain', props: { gap: 20 } }],
    ['hidden structural body', { ...columns(), id: 'plain', content: 'Hidden' }],
    ['hidden column prop', { ...columns(), id: 'plain', children: [{ id: 'a', type: 'oeColumn', props: { width: 1, private: 'hidden' } }, { id: 'b', type: 'oeColumn' }] }],
    ['invalid width', { ...columns(), id: 'plain', children: [{ id: 'a', type: 'oeColumn', props: { width: .09 } }, { id: 'b', type: 'oeColumn' }] }]
  ] as const)('rejects %s without partial changes', (_label, block) => {
    const input = { schemaVersion: 1, blocks: [paragraph('plain'), opaque()] };
    const pending = proposal([{ op: 'replace', blockId: 'plain', block: structuredClone(block) as EditorBlock }], input, ['plain']);
    const before = JSON.stringify(pending.source);
    expect(() => previewAgentChatDocumentProposal(pending)).toThrow();
    expect(JSON.stringify(pending.source)).toBe(before);
  });

  it.each(([
    [{ op: 'delete', blockId: 'right' }],
    [{ op: 'move', blockId: 'left', beforeId: 'plain' }],
    [{ op: 'move', blockId: 'plain', parentId: 'layout' }],
    [{ op: 'replace', blockId: 'right', block: paragraph('right') }],
    [{ op: 'update-props', blockId: 'left', set: { width: '2' }, remove: [] }],
    [{ op: 'update-props', blockId: 'layout', set: { gap: 0 }, remove: [] }]
  ] as SuggestionChange[][]).map(changes => ({ changes })))('validates final structure after every operation combination %#', ({ changes }) => {
    expect(() => previewAgentChatDocumentProposal(proposal(changes))).toThrow('unsupported rich content');
  });

  it.each(['toggleListItem', 'status', 'oePageBreak', 'divider', 'image', 'pageCard', 'oeNotesSyncedBlock', 'oeHtmlWidget', 'oeUnknownBlock'])('does not enable unsupported host or active/resource type %s', type => {
    const block: EditorBlock = { id: 'plain', type };
    expect(agentChatDocumentTargets({ schemaVersion: 1, blocks: [block] })).toEqual([]);
    expect(() => previewAgentChatDocumentProposal(invalidReplacement(block))).toThrow();
  });
});

describe('strict rich-property and completion boundaries', () => {
  it.each([
    ['callout', { variant: 'urgent' }], ['callout', { title: 17 }], ['callout', { title: 'x'.repeat(501) }], ['callout', { private: 'hidden' }],
    ['heading', { level: '2' }], ['heading', { level: 1.5 }], ['heading', { isToggleable: true }],
    ['checkListItem', { checked: 'false' }], ['numberedListItem', { start: 0 }], ['numberedListItem', { start: 2.5 }],
    ['paragraph', { textAlignment: 'sideways' }], ['paragraph', { textColor: false }], ['paragraph', { backgroundColor: 'red' }],
    ['codeBlock', { language: 'javascript;execute()' }]
  ] as const)('rejects wrong typed props on %s: %j', (type, props) => {
    const block = { id: 'plain', type, props, content: 'Visible' } as EditorBlock;
    expect(agentChatDocumentTargets({ schemaVersion: 1, blocks: [block] })).toEqual([]);
    expect(() => previewAgentChatDocumentProposal(invalidReplacement(block))).toThrow();
  });

  it.each([{ bold: 'true' }, { textColor: true }, { textColor: 'url(secret)' }, { unknown: false }] as Array<Record<string, string | boolean>>)('rejects hidden or mistyped style %j', styles => {
    const block: EditorBlock = { id: 'plain', type: 'callout', content: [{ type: 'text', text: 'Visible', styles }] };
    expect(() => previewAgentChatDocumentProposal(invalidReplacement(block))).toThrow();
  });

  it('never invents completion, but preserves already completed checklist state', () => {
    const input: EditorDocument = { schemaVersion: 1, blocks: [{ id: 'done', type: 'checkListItem', props: { checked: true }, content: 'Already done' }, { id: 'todo', type: 'checkListItem', props: { checked: false }, content: 'Not done' }] };
    const completed = proposal([{ op: 'replace', blockId: 'done', block: { ...input.blocks[0]!, content: 'Reviewed wording' } }], input, ['done', 'todo']);
    expect(previewAgentChatDocumentProposal(completed).blocks[0]).toMatchObject({ props: { checked: true }, content: 'Reviewed wording' });
    for (const changes of [
      [{ op: 'update-props', blockId: 'todo', set: { checked: true }, remove: [] }],
      [{ op: 'insert', beforeId: 'todo', block: { id: 'invented', type: 'checkListItem', props: { checked: true }, content: 'Inferred complete' } }]
    ] as SuggestionChange[][]) expect(() => previewAgentChatDocumentProposal(proposal(changes, input, ['done', 'todo']))).toThrow('cannot infer completed');
  });

  it('rejects duplicate source identities before exposing a partial rich selection', () => {
    const input = document();
    input.blocks.push(paragraph('left-text', 'Conflicting identity'));
    expect(agentChatDocumentTargets(input)).toEqual([]);
    expect(() => agentChatDocumentContext(input, ['plain'])).toThrow();
  });
});

describe('host-representable inline and table contracts', () => {
  const link = (href: string, text = 'Visible label'): EditorBlock => ({ id: 'plain', type: 'callout', content: [{ type: 'link', href, content: [{ type: 'text', text, styles: { italic: true } }] }] });
  it('retains a reviewed ordinary link and color tokens in callout content', () => {
    const next = previewAgentChatDocumentProposal(invalidReplacement(link('https://example.com/review?version=2')));
    expect(next.blocks[0]).toEqual(link('https://example.com/review?version=2'));
    const colored: EditorBlock = { id: 'plain', type: 'callout', content: [{ type: 'text', text: 'Visible', styles: { textColor: 'blue', backgroundColor: 'yellow' } }] };
    expect(previewAgentChatDocumentProposal(invalidReplacement(colored)).blocks[0]).toEqual(colored);
  });
  it.each(['https://user:password@example.com', 'https://example.com/\u0000hidden', 'mailto:private@example.com', 'javascript:alert(1)', 'https://example.com:65536', 'https://127.01.0.1', 'openeditor://document/private'])('rejects unbound inline link %s', href => {
    expect(() => previewAgentChatDocumentProposal(invalidReplacement(link(href)))).toThrow();
  });
  it.each(['', 'Line one\nLine two', '\ud800'])('rejects a link label that the host cannot persist losslessly: %j', text => {
    expect(() => previewAgentChatDocumentProposal(invalidReplacement(link('https://example.com', text)))).toThrow();
  });
  it('keeps plain multiline code inert, but rejects styles and child blocks', () => {
    const code: EditorBlock = { id: 'plain', type: 'codeBlock', props: { language: 'typescript' }, content: 'const a = 1;\nconsole.log(a);' };
    expect(previewAgentChatDocumentProposal(invalidReplacement(code)).blocks[0]).toEqual(code);
    for (const block of [{ ...code, content: [{ type: 'text', text: 'code', styles: { bold: true } }] }, { ...code, children: [paragraph('invisible')] }] as EditorBlock[]) {
      expect(() => previewAgentChatDocumentProposal(invalidReplacement(block))).toThrow();
    }
  });
  const tableBlock = (): EditorBlock => ({ id: 'plain', type: 'table', content: { type: 'tableContent', rows: [{ cells: [[{ type: 'text', text: 'A', styles: { bold: true } }], { type: 'tableCell', content: [{ type: 'text', text: 'B' }], props: { colspan: 1, rowspan: 1, textAlignment: 'right', backgroundColor: 'default' } }] }], columnWidths: [160, null], headerRows: 1, headerCols: 1 } });
  it('previews a complete typed table with visible spans and dimensions', () => {
    const block = tableBlock();
    expect(previewAgentChatDocumentProposal(invalidReplacement(block)).blocks[0]).toEqual(block);
  });
  it.each(['ragged', 'bad-width-count', 'fractional-header', 'excess-header', 'zero-span', 'hidden-cell', 'link-cell', 'color-run', 'oversized-run', 'child'])('rejects an unrepresentable %s table', kind => {
    const block = tableBlock(), content = block.content as any;
    if (kind === 'ragged') content.rows.push({ cells: [[]] });
    if (kind === 'bad-width-count') content.columnWidths = [100];
    if (kind === 'fractional-header') content.headerRows = .5;
    if (kind === 'excess-header') content.headerCols = 3;
    if (kind === 'zero-span') content.rows[0].cells[1].props.rowspan = 0;
    if (kind === 'hidden-cell') content.rows[0].cells[1].props.secret = 'Private';
    if (kind === 'link-cell') content.rows[0].cells[0] = [{ type: 'link', href: 'https://example.com', content: [{ type: 'text', text: 'Link' }] }];
    if (kind === 'color-run') content.rows[0].cells[0][0].styles = { textColor: 'blue' };
    if (kind === 'oversized-run') content.rows[0].cells[0][0].text = 'x'.repeat(10001);
    if (kind === 'child') block.children = [paragraph('invisible')];
    expect(() => previewAgentChatDocumentProposal(invalidReplacement(block))).toThrow();
  });
});
